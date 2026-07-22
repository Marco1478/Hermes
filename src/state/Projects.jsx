import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchObsidianStatus, fetchVaultProjects, writeVaultProject, archiveVaultProject, unarchiveVaultProject } from "../lib/obsidianBridge.js";

/*
  Projects — Obsidian-vault-backed when configured, local-storage-backed as
  an honest fallback otherwise. Same architecture as state/Notes.jsx (see
  its header comment for the full reasoning); each project maps to
  `<OBSIDIAN_PROJECTS_DIR>/<name>/overview.md`. `id` is that folder's name
  once vault-backed, or a random uid in local-only mode — assigned once at
  creation, not renamed on later edits to `name`.
*/

const ProjectsContext = createContext(null);
const STORE_KEY = "hermes-ui.projects.v1";
const WRITE_DEBOUNCE_MS = 700;

// "archived" is deliberately not a status value — it's a location (moved
// under OBSIDIAN_ARCHIVE_DIR), same as Notes, tracked via the `archived`
// boolean and toggleArchiveProject/deleteProject below.
export const STATUSES = ["planning", "active", "on_hold", "done"];
export const PRIORITIES = ["low", "medium", "high"];

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyProject(overrides = {}) {
  const now = Date.now();
  return {
    id: uid(),
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    color: null,
    archived: false,
    tags: [],
    dueDate: null,
    milestones: [],
    linkedNoteIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function loadLocalProjects() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data)) return [];
    return data.map((p) => ({ ...emptyProject(), ...p }));
  } catch {
    return [];
  }
}

export function ProjectsProvider({ children }) {
  const [vaultStatus, setVaultStatus] = useState("unknown");
  const [vaultError, setVaultError] = useState(null);
  const [projects, setProjects] = useState(loadLocalProjects);
  const [orphanedLocalProjects, setOrphanedLocalProjects] = useState([]);
  const [migrating, setMigrating] = useState(false);

  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  const writeTimers = useRef({});
  const vaultStatusRef = useRef(vaultStatus);
  useEffect(() => {
    vaultStatusRef.current = vaultStatus;
  }, [vaultStatus]);
  // ids confirmed to exist in the vault (vs. still-local-only) — a Set of
  // strings, not the WeakSet above (that one's unused; ids are strings).
  const vaultBackedIds = useRef(new Set());

  const loadFromVault = useCallback(async () => {
    const [active, archived] = await Promise.all([fetchVaultProjects(false), fetchVaultProjects(true)]);
    const merged = [...(active.data || []), ...(archived.data || [])];
    vaultBackedIds.current = new Set(merged.map((p) => p.id));
    setProjects(merged);
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
        const preVaultLocal = loadLocalProjects();
        await loadFromVault();
        if (!mounted) return;
        setVaultStatus("connected");
        setOrphanedLocalProjects(preVaultLocal.filter((p) => !vaultBackedIds.current.has(p.id)));
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

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(projects));
      } catch {
        /* quota — best effort */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [projects]);

  const flushProjectToVault = useCallback(async (id) => {
    const project = projectsRef.current.find((p) => p.id === id);
    if (!project) return;
    try {
      const res = await writeVaultProject(vaultBackedIds.current.has(id) ? id : null, project);
      vaultBackedIds.current.add(res.data.id);
      if (res.data.id !== project.id) {
        setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...res.data } : p)));
      }
    } catch {
      /* transient failure — local state/cache stays correct, next edit retries */
    }
  }, []);

  const scheduleVaultWrite = useCallback(
    (id) => {
      if (vaultStatusRef.current !== "connected") return;
      clearTimeout(writeTimers.current[id]);
      writeTimers.current[id] = setTimeout(() => flushProjectToVault(id), WRITE_DEBOUNCE_MS);
    },
    [flushProjectToVault]
  );

  const createProject = useCallback(async (overrides) => {
    const project = emptyProject(overrides);
    if (vaultStatusRef.current === "connected") {
      try {
        const res = await writeVaultProject(null, project);
        vaultBackedIds.current.add(res.data.id);
        setProjects((prev) => [res.data, ...prev]);
        return res.data.id;
      } catch (err) {
        setVaultError(err.message || String(err));
        return null;
      }
    }
    setProjects((prev) => [project, ...prev]);
    return project.id;
  }, []);

  const updateProject = useCallback(
    (id, patch) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...(typeof patch === "function" ? patch(p) : patch), updatedAt: Date.now() } : p))
      );
      scheduleVaultWrite(id);
    },
    [scheduleVaultWrite]
  );

  const deleteProject = useCallback(async (id) => {
    // Archive-instead-of-delete once vault-connected, same reasoning as
    // Notes — the filesystem bridge has no hard-delete by design.
    if (vaultStatusRef.current === "connected" && vaultBackedIds.current.has(id)) {
      try {
        await archiveVaultProject(id);
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived: true } : p)));
        return;
      } catch (err) {
        setVaultError(err.message || String(err));
        return;
      }
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleArchiveProject = useCallback(async (id) => {
    const project = projectsRef.current.find((p) => p.id === id);
    if (!project) return;
    const nextArchived = !project.archived;
    if (vaultStatusRef.current === "connected" && vaultBackedIds.current.has(id)) {
      try {
        if (nextArchived) await archiveVaultProject(id);
        else await unarchiveVaultProject(id);
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived: nextArchived } : p)));
        return;
      } catch (err) {
        setVaultError(err.message || String(err));
        return;
      }
    }
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived: nextArchived, updatedAt: Date.now() } : p)));
  }, []);

  // ---- Milestones ------------------------------------------------------------
  const addMilestone = useCallback(
    (projectId, text) => {
      const item = { id: uid(), text, done: false };
      updateProject(projectId, (p) => ({ milestones: [...p.milestones, item] }));
    },
    [updateProject]
  );

  const toggleMilestone = useCallback(
    (projectId, itemId) => {
      updateProject(projectId, (p) => ({ milestones: p.milestones.map((m) => (m.id === itemId ? { ...m, done: !m.done } : m)) }));
    },
    [updateProject]
  );

  const removeMilestone = useCallback(
    (projectId, itemId) => {
      updateProject(projectId, (p) => ({ milestones: p.milestones.filter((m) => m.id !== itemId) }));
    },
    [updateProject]
  );

  // ---- Note linking ------------------------------------------------------------
  const linkNote = useCallback(
    (projectId, noteId) => {
      updateProject(projectId, (p) => (p.linkedNoteIds.includes(noteId) ? p : { linkedNoteIds: [...p.linkedNoteIds, noteId] }));
    },
    [updateProject]
  );

  const unlinkNote = useCallback(
    (projectId, noteId) => {
      updateProject(projectId, (p) => ({ linkedNoteIds: p.linkedNoteIds.filter((id) => id !== noteId) }));
    },
    [updateProject]
  );

  // ---- Migration: projects created before the vault was ever connected -----
  const migrateLocalProjectsToVault = useCallback(async () => {
    if (vaultStatusRef.current !== "connected" || orphanedLocalProjects.length === 0) return;
    setMigrating(true);
    try {
      const migrated = [];
      for (const local of orphanedLocalProjects) {
        try {
          const res = await writeVaultProject(null, local);
          vaultBackedIds.current.add(res.data.id);
          migrated.push({ oldId: local.id, project: res.data });
        } catch {
          /* leave in orphan list, retry available */
        }
      }
      if (migrated.length) {
        setProjects((prev) => {
          const withoutOld = prev.filter((p) => !migrated.some((m) => m.oldId === p.id));
          return [...migrated.map((m) => m.project), ...withoutOld];
        });
        setOrphanedLocalProjects((prev) => prev.filter((p) => !migrated.some((m) => m.oldId === p.id)));
      }
    } finally {
      setMigrating(false);
    }
  }, [orphanedLocalProjects]);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const p of projects) for (const t of p.tags || []) set.add(t);
    return [...set].sort();
  }, [projects]);

  const value = useMemo(
    () => ({
      projects,
      allTags,
      vaultStatus,
      vaultError,
      orphanedLocalProjects,
      migrating,
      migrateLocalProjectsToVault,
      createProject,
      updateProject,
      deleteProject,
      toggleArchiveProject,
      addMilestone,
      toggleMilestone,
      removeMilestone,
      linkNote,
      unlinkNote,
    }),
    [
      projects,
      allTags,
      vaultStatus,
      vaultError,
      orphanedLocalProjects,
      migrating,
      migrateLocalProjectsToVault,
      createProject,
      updateProject,
      deleteProject,
      toggleArchiveProject,
      addMilestone,
      toggleMilestone,
      removeMilestone,
      linkNote,
      unlinkNote,
    ]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
