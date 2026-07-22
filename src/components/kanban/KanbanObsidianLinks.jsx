import { useState } from "react";
import { useNotes } from "../../state/Notes.jsx";
import { commentKanbanTask } from "../../lib/kanbanBridge.js";

const wikilink = (note) => note.id.replace(/\.md$/, "");

/*
  KanbanObsidianLinks — Kanban is the action layer, the vault is the
  knowledge layer. There's no `linked_notes` field on a real Kanban task
  (verified against the CLI's actual create/update args) and this
  deliberately doesn't invent one — the relation is persisted the same way
  any other durable task fact is: a real comment, via the same
  commentKanbanTask the rest of KanbanTaskActions already uses. It shows up
  in the drawer's existing Comments section with everything else, and
  survives a refresh because it's a real comment row from the backend, not
  local component state.
*/
export function KanbanObsidianLinks({ task, onChanged }) {
  const { notes, createNote, vaultStatus } = useNotes();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createdNoteId, setCreatedNoteId] = useState(null);

  const linkNote = async (note) => {
    setBusy(true);
    setError(null);
    try {
      await commentKanbanTask(task.id, `Linked Obsidian note: [[${wikilink(note)}]]`, "custom-ui");
      setPickerOpen(false);
      setQuery("");
      await onChanged();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const createFromTask = async () => {
    if (createdNoteId || busy) return; // guard: one note per task per session, not one per click
    setBusy(true);
    setError(null);
    try {
      const id = await createNote({
        title: task.title,
        body: `${task.body || ""}\n\nLinked Kanban task: ${task.id}`.trim(),
        tags: ["kanban"],
      });
      if (!id) throw new Error("Note creation failed.");
      setCreatedNoteId(id);
      await commentKanbanTask(task.id, `Linked Obsidian note: [[${id.replace(/\.md$/, "")}]]`, "custom-ui");
      await onChanged();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  if (vaultStatus !== "connected") {
    return (
      <div className="panel-section kanban-actions">
        <p className="panel-section-title">Obsidian</p>
        <p className="panel-empty">
          {vaultStatus === "not_configured" ? "Vault not configured — see docs/OBSIDIAN_VAULT_SETUP.md." : "Vault unavailable right now."}
        </p>
      </div>
    );
  }

  const filtered = query.trim() ? notes.filter((n) => (n.title || "").toLowerCase().includes(query.toLowerCase())) : notes;

  return (
    <div className="panel-section kanban-actions">
      <p className="panel-section-title">Obsidian</p>
      {error && <p className="panel-error">{error}</p>}
      <div className="kanban-action-row">
        <button type="button" className="btn-pill" disabled={busy || Boolean(createdNoteId)} onClick={createFromTask}>
          {createdNoteId ? "note created ✓" : busy ? "working…" : "+ create note from task"}
        </button>
        <button type="button" className="btn-pill" disabled={busy} onClick={() => setPickerOpen((v) => !v)}>
          + link existing note
        </button>
      </div>
      {pickerOpen && (
        <div className="kanban-action-row kanban-action-row--stack">
          <input
            className="kanban-action-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${notes.length} notes…`}
            autoFocus
          />
          <div className="obsidian-link-picker">
            {filtered.length === 0 && <p className="panel-empty">No matching notes.</p>}
            {filtered.map((n) => (
              <button key={n.id} type="button" className="obsidian-link-picker-item" disabled={busy} onClick={() => linkNote(n)}>
                {n.title || "Untitled"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
