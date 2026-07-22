import { lazy, Suspense } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ViewModeProvider, useViewMode } from "./state/ViewMode.jsx";
import { GatewayHealthProvider } from "./state/GatewayHealth.jsx";
import { UsageProvider } from "./state/Usage.jsx";
import { ChatProvider } from "./state/Chat.jsx";
import { NotesProvider } from "./state/Notes.jsx";
import { ProjectsProvider } from "./state/Projects.jsx";
import { RailCollapseProvider } from "./state/RailCollapse.jsx";
import { Hero } from "./components/Hero.jsx";
import { ChatContainer } from "./components/chat/ChatContainer.jsx";
import { CommandPaletteModeProvider } from "./state/CommandPaletteMode.jsx";
import { CommandPalette } from "./components/commands/CommandPalette.jsx";
import { ViewSkeleton } from "./components/ui/ViewSkeleton.jsx";

// Hero and Chat are what every session sees first — kept in the main
// bundle. Everything else is a real, separate chunk fetched on first
// visit to that section, per instruction file 006's CLAUDE-006 (the
// "chunks larger than 500kB" build warning was one bundle for the
// entire app; Projects alone pulls in Canvas/Workflows/Kanban-panel/
// Intelligence, which only ever run together, so splitting at the
// page level is the natural boundary rather than inside Projects).
const JobsPage = lazy(() => import("./components/jobs/JobsPage.jsx").then((m) => ({ default: m.JobsPage })));
const HermesPage = lazy(() => import("./components/hermes/HermesPage.jsx").then((m) => ({ default: m.HermesPage })));
const ToolsPage = lazy(() => import("./components/tools/ToolsPage.jsx").then((m) => ({ default: m.ToolsPage })));
const SystemOverviewPage = lazy(() => import("./components/system/SystemOverviewPage.jsx").then((m) => ({ default: m.SystemOverviewPage })));
const KanbanPage = lazy(() => import("./components/kanban/KanbanPage.jsx").then((m) => ({ default: m.KanbanPage })));
const NotesPage = lazy(() => import("./components/notes/NotesPage.jsx").then((m) => ({ default: m.NotesPage })));
const ProjectsPage = lazy(() => import("./components/projects/ProjectsPage.jsx").then((m) => ({ default: m.ProjectsPage })));
const SafetyCenter = lazy(() => import("./components/safety/SafetyCenter.jsx").then((m) => ({ default: m.SafetyCenter })));
const MissionPipeline = lazy(() => import("./components/missions/MissionPipeline.jsx").then((m) => ({ default: m.MissionPipeline })));

const VIEWS = {
  hero: Hero,
  chat: ChatContainer,
  jobs: JobsPage,
  hermes: HermesPage,
  tools: ToolsPage,
  system: SystemOverviewPage,
  kanban: KanbanPage,
  notes: NotesPage,
  projects: ProjectsPage,
  safety: SafetyCenter,
  missions: MissionPipeline,
};

// Hero/Chat never suspend (they're eager, not lazy), so wrapping them
// in Suspense too is harmless and keeps this one path for every view.
function Stage() {
  const { mode } = useViewMode();
  const ViewComponent = VIEWS[mode] || Hero;
  return (
    <LayoutGroup>
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className={`view view--${mode}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <Suspense fallback={<ViewSkeleton />}>
            <ViewComponent />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </LayoutGroup>
  );
}

export function App() {
  return (
    <GatewayHealthProvider>
      <UsageProvider>
        <ViewModeProvider>
          <ChatProvider>
            <NotesProvider>
              <ProjectsProvider>
                <RailCollapseProvider>
                  <CommandPaletteModeProvider>
                    <Stage />
                    <CommandPalette />
                  </CommandPaletteModeProvider>
                </RailCollapseProvider>
              </ProjectsProvider>
            </NotesProvider>
          </ChatProvider>
        </ViewModeProvider>
      </UsageProvider>
    </GatewayHealthProvider>
  );
}
