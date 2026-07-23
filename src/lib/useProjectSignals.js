import { useEffect, useState } from "react";
import { fetchVaultCanvases, fetchVaultWorkflows, fetchProjectAssets } from "./obsidianBridge.js";
import { fetchKanbanTask } from "./kanbanBridge.js";

/*
  useProjectSignals — the one place that fetches a project's canvases/
  workflows/assets/linked-Kanban-tasks, shared by ProjectOverviewPanel (the
  Home dashboard), ProjectIntelligencePanel, and ProjectChatPanel (the
  "Analyze in Chat" context message) so all three read the exact same data
  instead of each running its own independent fetch of the same things.
  Assets failing to list (e.g. vault not connected) degrades to an empty
  array rather than failing the whole hook — every OTHER signal here is
  still real and worth showing even if that one call comes back empty.
*/
export function useProjectSignals(project) {
  const [canvases, setCanvases] = useState(null);
  const [workflows, setWorkflows] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [assets, setAssets] = useState(null);
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
      try {
        const assetsRes = await fetchProjectAssets(project.id);
        if (!cancelled) setAssets(assetsRes.data || []);
      } catch {
        if (!cancelled) setAssets([]);
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

  const loading = canvases === null || workflows === null || tasks === null || assets === null;
  return { canvases: canvases || [], workflows: workflows || [], tasks: tasks || [], assets: assets || [], loading, error };
}
