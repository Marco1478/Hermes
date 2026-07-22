import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchObsidianStatus, fetchVaultNotes, writeVaultNote, archiveVaultNote, unarchiveVaultNote } from "../lib/obsidianBridge.js";

/*
  Notes — Obsidian-vault-backed when configured (see
  docs/OBSIDIAN_VAULT_SETUP.md), local-storage-backed as an honest fallback
  when it isn't. `vaultStatus` tells the UI which mode is actually active
  ("connected" / "not_configured" / "error") rather than silently
  presenting localStorage as if it were the durable store once a vault
  exists — that was the whole problem with the original prototype.

  Once connected, `notes` is populated straight from the vault and every
  mutation writes through: instantly to local React state (so typing feels
  immediate) and, per-note debounced, to a real markdown file over the
  bridge (src/lib/obsidianBridge.js -> vite-plugins/obsidianBridge.js).
  localStorage becomes cache/offline-fallback only, refreshed after every
  successful vault read.

  Note identity: `id` is the vault-relative filename (e.g. "Some Note.md")
  once vault-backed, or a random uid in local-only mode. A note's filename
  is assigned once at creation and never renamed on later title edits —
  frontmatter `title` is the editable display value, independent of the
  stable filename, so links into a note (from Projects, later Kanban)
  never go stale just because its title changed.
*/

const NotesContext = createContext(null);
const STORE_KEY = "hermes-ui.notes.v1";
const FOLDERS_KEY = "hermes-ui.notes.folders.v1";
const WRITE_DEBOUNCE_MS = 700;

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyNote(overrides = {}) {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    body: "",
    tags: [],
    folder: null,
    color: null,
    pinned: false,
    archived: false,
    checklist: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function loadLocalNotes() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data)) return [];
    return data.map((n) => ({ ...emptyNote(), ...n }));
  } catch {
    return [];
  }
}

function loadFolders() {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// A note whose id isn't a vault filename (no .md) predates any vault
// connection — it's a local-only note the vault has never seen.
const isVaultId = (id) => typeof id === "string" && id.endsWith(".md");

export function NotesProvider({ children }) {
  const [vaultStatus, setVaultStatus] = useState("unknown"); // unknown | checking | connected | not_configured | error
  const [vaultError, setVaultError] = useState(null);
  const [notes, setNotes] = useState(loadLocalNotes);
  const [folders, setFolders] = useState(loadFolders);
  const [orphanedLocalNotes, setOrphanedLocalNotes] = useState([]);
  const [migrating, setMigrating] = useState(false);

  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const writeTimers = useRef({});
  const vaultStatusRef = useRef(vaultStatus);
  useEffect(() => {
    vaultStatusRef.current = vaultStatus;
  }, [vaultStatus]);

  const loadFromVault = useCallback(async () => {
    const [active, archived] = await Promise.all([fetchVaultNotes(false), fetchVaultNotes(true)]);
    const merged = [...(active.data || []), ...(archived.data || [])];
    setNotes(merged);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(merged));
    } catch {
      /* best effort cache */
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setVaultStatus("checking");
      try {
        const st = await fetchObsidianStatus();
        if (!mounted) return;
        if (!st.configured) {
          setVaultStatus("not_configured");
          return;
        }
        if (!st.vaultOk) {
          setVaultStatus("error");
          setVaultError(st.error || "Vault path not reachable.");
          return;
        }
        const preVaultLocal = loadLocalNotes();
        await loadFromVault();
        if (!mounted) return;
        setVaultStatus("connected");
        setOrphanedLocalNotes(preVaultLocal.filter((n) => !isVaultId(n.id)));
      } catch (err) {
        if (!mounted) return;
        setVaultStatus("error");
        setVaultError(err.message || String(err));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadFromVault]);

  // localStorage cache write — local-only mode this is the real store;
  // vault mode it's just an offline mirror refreshed on every vault load.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(notes));
      } catch {
        /* quota — best effort */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    } catch {
      /* best effort */
    }
  }, [folders]);

  const flushNoteToVault = useCallback(async (id) => {
    const note = notesRef.current.find((n) => n.id === id);
    if (!note) return;
    try {
      const res = await writeVaultNote(isVaultId(note.id) ? note.id : null, note);
      if (res.data.id !== note.id) {
        // First-ever vault write of a locally-created note: swap the temp
        // uid for the real assigned filename.
        setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...res.data } : n)));
      }
    } catch {
      /* transient network/SSH failure — the note stays correct in local
         state and localStorage cache; next edit retries the write. */
    }
  }, []);

  const scheduleVaultWrite = useCallback(
    (id) => {
      if (vaultStatusRef.current !== "connected") return;
      clearTimeout(writeTimers.current[id]);
      writeTimers.current[id] = setTimeout(() => flushNoteToVault(id), WRITE_DEBOUNCE_MS);
    },
    [flushNoteToVault]
  );

  const createNote = useCallback(
    async (overrides) => {
      const note = emptyNote(overrides);
      if (vaultStatusRef.current === "connected") {
        try {
          const res = await writeVaultNote(null, note);
          setNotes((prev) => [res.data, ...prev]);
          return res.data.id;
        } catch (err) {
          setVaultError(err.message || String(err));
          return null;
        }
      }
      setNotes((prev) => [note, ...prev]);
      return note.id;
    },
    []
  );

  const updateNote = useCallback(
    (id, patch) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...(typeof patch === "function" ? patch(n) : patch), updatedAt: Date.now() } : n))
      );
      scheduleVaultWrite(id);
    },
    [scheduleVaultWrite]
  );

  const deleteNote = useCallback(
    async (id) => {
      // Filesystem access is archive-instead-of-delete by design (see
      // vite-plugins/obsidianBridge.js) — once vault-connected, "delete"
      // in the UI really performs a safe, reversible archive.
      if (vaultStatusRef.current === "connected" && isVaultId(id)) {
        try {
          await archiveVaultNote(id);
          setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, archived: true } : n)));
          return;
        } catch (err) {
          setVaultError(err.message || String(err));
          return;
        }
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    []
  );

  const duplicateNote = useCallback(async (id) => {
    const src = notesRef.current.find((n) => n.id === id);
    if (!src) return null;
    const copy = emptyNote({
      ...src,
      id: uid(),
      title: src.title ? `${src.title} (copy)` : "",
      pinned: false,
      checklist: src.checklist.map((c) => ({ ...c, id: uid() })),
    });
    if (vaultStatusRef.current === "connected") {
      try {
        const res = await writeVaultNote(null, copy);
        setNotes((prev) => {
          const idx = prev.findIndex((n) => n.id === id);
          return [...prev.slice(0, idx + 1), res.data, ...prev.slice(idx + 1)];
        });
        return res.data.id;
      } catch (err) {
        setVaultError(err.message || String(err));
        return null;
      }
    }
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
    return copy.id;
  }, []);

  const togglePin = useCallback(
    (id) => {
      updateNote(id, (n) => ({ pinned: !n.pinned }));
    },
    [updateNote]
  );

  const toggleArchive = useCallback(async (id) => {
    const note = notesRef.current.find((n) => n.id === id);
    if (!note) return;
    const nextArchived = !note.archived;
    if (vaultStatusRef.current === "connected" && isVaultId(id)) {
      try {
        if (nextArchived) await archiveVaultNote(id);
        else await unarchiveVaultNote(id);
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, archived: nextArchived } : n)));
        return;
      } catch (err) {
        setVaultError(err.message || String(err));
        return;
      }
    }
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, archived: nextArchived, updatedAt: Date.now() } : n)));
  }, []);

  // ---- Checklist -------------------------------------------------------------
  const addChecklistItem = useCallback(
    (noteId, text) => {
      const item = { id: uid(), text, done: false };
      updateNote(noteId, (n) => ({ checklist: [...n.checklist, item] }));
    },
    [updateNote]
  );

  const toggleChecklistItem = useCallback(
    (noteId, itemId) => {
      updateNote(noteId, (n) => ({ checklist: n.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) }));
    },
    [updateNote]
  );

  const removeChecklistItem = useCallback(
    (noteId, itemId) => {
      updateNote(noteId, (n) => ({ checklist: n.checklist.filter((c) => c.id !== itemId) }));
    },
    [updateNote]
  );

  // ---- Folders — genuine local UI preference, not vault-backed data ---------
  const createFolder = useCallback((name) => {
    const clean = name.trim();
    if (!clean) return;
    setFolders((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  }, []);

  const renameFolder = useCallback((oldName, newName) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    setFolders((prev) => prev.map((f) => (f === oldName ? clean : f)));
    setNotes((prev) => prev.map((n) => (n.folder === oldName ? { ...n, folder: clean } : n)));
  }, []);

  const deleteFolder = useCallback((name) => {
    setFolders((prev) => prev.filter((f) => f !== name));
    setNotes((prev) => prev.map((n) => (n.folder === name ? { ...n, folder: null } : n)));
  }, []);

  // ---- Migration: notes created before the vault was ever connected --------
  const migrateLocalNotesToVault = useCallback(async () => {
    if (vaultStatusRef.current !== "connected" || orphanedLocalNotes.length === 0) return;
    setMigrating(true);
    try {
      const migrated = [];
      for (const local of orphanedLocalNotes) {
        try {
          const res = await writeVaultNote(null, local);
          migrated.push({ oldId: local.id, note: res.data });
        } catch {
          /* leave this one in the orphan list, retry available next click */
        }
      }
      if (migrated.length) {
        setNotes((prev) => {
          const withoutOld = prev.filter((n) => !migrated.some((m) => m.oldId === n.id));
          return [...migrated.map((m) => m.note), ...withoutOld];
        });
        setOrphanedLocalNotes((prev) => prev.filter((n) => !migrated.some((m) => m.oldId === n.id)));
      }
    } finally {
      setMigrating(false);
    }
  }, [orphanedLocalNotes]);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const n of notes) for (const t of n.tags || []) set.add(t);
    return [...set].sort();
  }, [notes]);

  const value = useMemo(
    () => ({
      notes,
      folders,
      allTags,
      vaultStatus,
      vaultError,
      orphanedLocalNotes,
      migrating,
      migrateLocalNotesToVault,
      createNote,
      updateNote,
      deleteNote,
      duplicateNote,
      togglePin,
      toggleArchive,
      addChecklistItem,
      toggleChecklistItem,
      removeChecklistItem,
      createFolder,
      renameFolder,
      deleteFolder,
    }),
    [
      notes,
      folders,
      allTags,
      vaultStatus,
      vaultError,
      orphanedLocalNotes,
      migrating,
      migrateLocalNotesToVault,
      createNote,
      updateNote,
      deleteNote,
      duplicateNote,
      togglePin,
      toggleArchive,
      addChecklistItem,
      toggleChecklistItem,
      removeChecklistItem,
      createFolder,
      renameFolder,
      deleteFolder,
    ]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
