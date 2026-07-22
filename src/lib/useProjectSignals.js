import { useEffect, useState } from "react";
import { fetchVaultCanvases, fetchVaultWorkflows } from "./obsidianBridge.js";
import { fetchKanbanTask } from "./kanbanBridge.js";

/*
  useProjectSignals — the one place that fetches a project's canvases/
  workflows/linked-Kanban-tasks, shared by ProjectIntelligencePanel
  (deterministic summary) and ProjectChatPanel (the "Analyze in Chat"
  context message) so both read the exact same data instead of each
  running its own independent fetch of the same three things.
*/
export function useProjectSignals(project) {
  const [canvases, setCanvases] = useState(null);
  const [workflows, setWorkflows] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cvRes, wfRes] = await Promise.all([fetchVaultCanvases(project.id), fetchVaultWorkflows(project.id)]);
        if (cancelled) return;
        setCanvases(cvRes.data || []);
        setWorkflows(wfRes.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      }
      const taskEntries = await Promise.all(
        (project.linkedKanbanIds || []).map(async (id) => {
          try {
            const res = await fetchKanbanTask(id);
            return res.data.task;
          } catch {
            return null; // deleted/inaccessible — excluded, not faked
          }
        })
      );
      if (!cancelled) setTasks(taskEntries.filter(Boolean));
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, project.linkedKanbanIds]);

  const loading = canvases === null || workflows === null || tasks === null;
  return { canvases: canvases || [], workflows: workflows || [], tasks: tasks || [], loading, error };
}
