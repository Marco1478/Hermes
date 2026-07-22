import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { useNotes } from "../../../state/Notes.jsx";
import { fetchVaultCanvases, fetchVaultWorkflows, writeVaultWorkflow, archiveVaultWorkflow } from "../../../lib/obsidianBridge.js";
import "./ProjectWorkflows.css";

const OWNERS = ["marco", "hermes", "claude", "external"];
const STEP_STATUSES = ["todo", "active", "blocked", "done"];
const WORKFLOW_STATUSES = ["draft", "active", "done"];

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newStep() {
  return { id: uid(), title: "", description: "", owner: "marco", status: "todo", linkedNoteId: null, linkedCanvasId: null, linkedTaskId: "", command: "" };
}

function StepCard({ step, notes, canvases, onChange, onRemove }) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={step.id} dragListener={false} dragControls={controls} className="workflow-step">
      {/* The whole header is the drag handle (per the brief: a real target,
          not a tiny grip) — which means it can't contain an editable input;
          a pointerdown on a text field starts native text selection and
          (correctly) stops propagation before controls.start() ever fires.
          Title editing lives in the body below instead, where every field
          already stops propagation for the same reason. */}
      <div className="workflow-step-head" onPointerDown={(e) => controls.start(e)} title="Drag to reorder">
        <span className={`status-badge status-badge--${step.status === "done" ? "ok" : step.status === "blocked" ? "bad" : step.status === "active" ? "info" : ""}`}>{step.status}</span>
        <span className="workflow-step-title-display">{step.title || "Untitled step"}</span>
        <button type="button" className="workflow-step-remove" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} aria-label="Remove step">
          ×
        </button>
      </div>
      <div className="workflow-step-body" onPointerDown={(e) => e.stopPropagation()}>
        <input className="job-modal-input workflow-step-title-input" value={step.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Step title" />
        <textarea
          className="notes-body-textarea mono workflow-step-desc"
          value={step.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What does this step involve?"
          rows={2}
        />
        <div className="project-drawer-row">
          <label className="notes-meta-label mono">
            owner
            <select className="notes-meta-select mono" value={step.owner} onChange={(e) => onChange({ owner: e.target.value })}>
              {OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-meta-label mono">
            status
            <select className="notes-meta-select mono" value={step.status} onChange={(e) => onChange({ status: e.target.value })}>
              {STEP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="project-drawer-row">
          <label className="notes-meta-label mono">
            linked note
            <select className="notes-meta-select mono" value={step.linkedNoteId || ""} onChange={(e) => onChange({ linkedNoteId: e.target.value || null })}>
              <option value="">none</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title || "Untitled"}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-meta-label mono">
            linked canvas
            <select className="notes-meta-select mono" value={step.linkedCanvasId || ""} onChange={(e) => onChange({ linkedCanvasId: e.target.value || null })}>
              <option value="">none</option>
              {canvases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="project-drawer-row">
          <label className="notes-meta-label mono">
            kanban task id
            <input className="notes-meta-select mono" value={step.linkedTaskId} onChange={(e) => onChange({ linkedTaskId: e.target.value })} placeholder="t_xxxxxxxx" />
          </label>
        </div>
        <label className="job-modal-label mono">
          command / action
          <input className="job-modal-input mono" value={step.command} onChange={(e) => onChange({ command: e.target.value })} placeholder="Optional — e.g. a slash command or shell action" />
        </label>
      </div>
    </Reorder.Item>
  );
}

function WorkflowEditor({ projectId, workflow, notes, canvases, onBack, onSaved }) {
  const [steps, setSteps] = useState(workflow.steps || []);
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [status, setStatus] = useState(workflow.status);
  const saveTimer = useRef(null);

  const scheduleSave = useCallback(
    (patch) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await writeVaultWorkflow(projectId, workflow.id, { name, description, status, steps, ...patch });
          onSaved(res.data);
        } catch {
          /* transient — next edit retries */
        }
      }, 600);
    },
    [projectId, workflow.id, name, description, status, steps, onSaved, saveTimer]
  );

  const updateSteps = (next) => {
    setSteps(next);
    scheduleSave({ steps: next });
  };

  // Reorder.Group tracks item position by the identity of this array
  // across renders — a fresh .map() inline on every render defeats that
  // (framer-motion's gesture/layout tracking loses continuity mid-drag
  // when the values array is a new reference on every re-render), so it's
  // memoized and only changes reference when the actual step list does.
  const stepIds = useMemo(() => steps.map((s) => s.id), [steps]);

  return (
    <div className="project-canvas-editor">
      <div className="project-section-head">
        <button type="button" className="btn-pill" onClick={onBack}>
          ← workflows
        </button>
        <input
          className="workflow-name-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            scheduleSave({ name: e.target.value });
          }}
        />
        <select
          className="notes-meta-select mono"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            scheduleSave({ status: e.target.value });
          }}
        >
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="notes-body-textarea mono"
        rows={2}
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          scheduleSave({ description: e.target.value });
        }}
        placeholder="What is this workflow for?"
      />

      <Reorder.Group as="div" axis="y" values={stepIds} onReorder={(order) => updateSteps(order.map((id) => steps.find((s) => s.id === id)))} className="workflow-steps">
        <AnimatePresence initial={false}>
          {steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              notes={notes}
              canvases={canvases}
              onChange={(patch) => updateSteps(steps.map((s) => (s.id === step.id ? { ...s, ...patch } : s)))}
              onRemove={() => updateSteps(steps.filter((s) => s.id !== step.id))}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      {steps.length === 0 && <p className="panel-empty">No steps yet.</p>}
      <button type="button" className="btn-pill" onClick={() => updateSteps([...steps, newStep()])}>
        + add step
      </button>
    </div>
  );
}

/*
  ProjectWorkflows — structured execution maps, one step at a time, saved
  to Hermes/Projects/<Name>/workflows/<slug>.workflow.json (same bridge
  shape as canvases — see vite-plugins/obsidianBridge.js). Steps drag-
  reorder from a real header bar, not a tiny handle, per the brief.
*/
export function ProjectWorkflows({ project }) {
  const { notes } = useNotes();
  const [canvases, setCanvases] = useState([]);
  const [workflows, setWorkflows] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    try {
      const [wfRes, cvRes] = await Promise.all([fetchVaultWorkflows(project.id), fetchVaultCanvases(project.id)]);
      setWorkflows(wfRes.data || []);
      setCanvases(cvRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openWorkflow = workflows?.find((w) => w.id === openId) || null;

  const onCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await writeVaultWorkflow(project.id, null, { name: newName.trim(), steps: [] });
      setNewName("");
      await load();
      setOpenId(res.data.id);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const onArchive = async (id) => {
    try {
      await archiveVaultWorkflow(project.id, id);
      await load();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  if (openWorkflow) {
    return (
      <WorkflowEditor
        projectId={project.id}
        workflow={openWorkflow}
        notes={notes}
        canvases={canvases}
        onBack={() => {
          setOpenId(null);
          load();
        }}
        onSaved={(data) => setWorkflows((prev) => prev.map((w) => (w.id === data.id ? data : w)))}
      />
    );
  }

  return (
    <div className="panel-section">
      <div className="project-section-head">
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          Workflows
        </p>
        <input className="job-modal-input canvas-new-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New workflow name…" onKeyDown={(e) => e.key === "Enter" && onCreate()} />
        <button type="button" className="btn-pill" onClick={onCreate}>
          + create
        </button>
      </div>
      {error && <p className="panel-error">{error}</p>}
      {!workflows && !error && <p className="panel-empty">Loading…</p>}
      {workflows && workflows.length === 0 && <p className="panel-empty">No workflows yet — create one above.</p>}
      <div className="canvas-list">
        {workflows?.map((w) => (
          <div key={w.id} className="canvas-list-item">
            <button type="button" className="canvas-list-open" onClick={() => setOpenId(w.id)}>
              <span className="canvas-list-name">
                {w.name} <span className="tag-badge">{w.status}</span>
              </span>
              <span className="mono canvas-list-meta">{w.steps?.length || 0} steps</span>
            </button>
            <button type="button" className="btn-pill" onClick={() => onArchive(w.id)}>
              archive
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
