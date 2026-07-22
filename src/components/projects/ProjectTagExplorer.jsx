import { useEffect, useMemo, useState } from "react";
import { fetchVaultCanvases, fetchVaultWorkflows } from "../../lib/obsidianBridge.js";

/*
  ProjectTagExplorer — tags as a real cross-object navigation layer:
  aggregates tags from the project itself, its linked notes, canvases, and
  workflows into one clickable strip. Selecting a tag filters every panel
  in the workspace that has one (Notes/Canvas/Workflows) via the lifted
  `activeTag` state in ProjectWorkspace — not just this component's own
  list. Kanban tasks are deliberately not included: no real tag field
  exists on a Kanban task (verified against the CLI's actual schema), and
  this codebase doesn't invent local-only fields the backend can't persist.
*/
export function ProjectTagExplorer({ project, notes, activeTag, onSelectTag }) {
  const [canvases, setCanvases] = useState([]);
  const [workflows, setWorkflows] = useState([]);

  useEffect(() => {
    fetchVaultCanvases(project.id)
      .then((res) => setCanvases(res.data || []))
      .catch(() => setCanvases([]));
    fetchVaultWorkflows(project.id)
      .then((res) => setWorkflows(res.data || []))
      .catch(() => setWorkflows([]));
  }, [project.id]);

  const linkedNotes = project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);

  const tagCounts = useMemo(() => {
    const map = new Map();
    const bump = (tag, key) => {
      if (!map.has(tag)) map.set(tag, { notes: 0, canvases: 0, workflows: 0 });
      map.get(tag)[key] += 1;
    };
    for (const t of project.tags || []) if (!map.has(t)) map.set(t, { notes: 0, canvases: 0, workflows: 0 });
    for (const n of linkedNotes) for (const t of n.tags || []) bump(t, "notes");
    for (const c of canvases) for (const t of c.tags || []) bump(t, "canvases");
    for (const w of workflows) for (const t of w.tags || []) bump(t, "workflows");
    return map;
  }, [project.tags, linkedNotes, canvases, workflows]);

  if (tagCounts.size === 0) return null;

  return (
    <div className="project-tag-explorer">
      {[...tagCounts.entries()].map(([tag, counts]) => (
        <button
          key={tag}
          type="button"
          className={`tag-badge notes-tag-pill${activeTag === tag ? " notes-tag-pill--active" : ""}`}
          onClick={() => onSelectTag(activeTag === tag ? null : tag)}
          title={`${counts.notes} note${counts.notes === 1 ? "" : "s"} · ${counts.canvases} canvas${counts.canvases === 1 ? "" : "es"} · ${counts.workflows} workflow${counts.workflows === 1 ? "" : "s"}`}
        >
          #{tag}
        </button>
      ))}
      {activeTag && (
        <button type="button" className="btn-pill" onClick={() => onSelectTag(null)}>
          clear filter
        </button>
      )}
    </div>
  );
}
