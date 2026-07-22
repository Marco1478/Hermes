import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/*
  Notes — local-first, deliberately. There is no `hermes notes` CLI or API
  anywhere on the real backend (unlike Kanban, which exists as a real SQLite
  board over SSH — see kanbanBridge.js). Building a fake bridge for
  something with no server-side counterpart would be the "empty board that
  looks like nothing to do" problem this codebase explicitly avoids
  elsewhere. Notes are Marco's own scratch space, persisted the same honest
  way chat history is (state/Chat.jsx): real localStorage, not a stand-in
  for a backend that doesn't exist.
*/

const NotesContext = createContext(null);
const STORE_KEY = "hermes-ui.notes.v1";
const FOLDERS_KEY = "hermes-ui.notes.folders.v1";

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

function loadNotes() {
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

export function NotesProvider({ children }) {
  const [notes, setNotes] = useState(loadNotes);
  const [folders, setFolders] = useState(loadFolders);

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

  const createNote = useCallback((overrides) => {
    const note = emptyNote(overrides);
    setNotes((prev) => [note, ...prev]);
    return note.id;
  }, []);

  const updateNote = useCallback((id, patch) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...(typeof patch === "function" ? patch(n) : patch), updatedAt: Date.now() } : n))
    );
  }, []);

  const deleteNote = useCallback((id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const duplicateNote = useCallback((id) => {
    let newId = null;
    setNotes((prev) => {
      const src = prev.find((n) => n.id === id);
      if (!src) return prev;
      const copy = emptyNote({
        ...src,
        id: uid(),
        title: src.title ? `${src.title} (copy)` : "",
        pinned: false,
        checklist: src.checklist.map((c) => ({ ...c, id: uid() })),
      });
      newId = copy.id;
      const idx = prev.findIndex((n) => n.id === id);
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
    return newId;
  }, []);

  const togglePin = useCallback((id) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n)));
  }, []);

  const toggleArchive = useCallback((id) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, archived: !n.archived, updatedAt: Date.now() } : n)));
  }, []);

  // ---- Checklist -----------------------------------------------------------
  const addChecklistItem = useCallback((noteId, text) => {
    const item = { id: uid(), text, done: false };
    updateNote(noteId, (n) => ({ checklist: [...n.checklist, item] }));
  }, [updateNote]);

  const toggleChecklistItem = useCallback((noteId, itemId) => {
    updateNote(noteId, (n) => ({ checklist: n.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) }));
  }, [updateNote]);

  const removeChecklistItem = useCallback((noteId, itemId) => {
    updateNote(noteId, (n) => ({ checklist: n.checklist.filter((c) => c.id !== itemId) }));
  }, [updateNote]);

  // ---- Folders ---------------------------------------------------------------
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
