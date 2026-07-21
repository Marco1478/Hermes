import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ViewModeProvider, useViewMode } from "./state/ViewMode.jsx";
import { GatewayHealthProvider } from "./state/GatewayHealth.jsx";
import { UsageProvider } from "./state/Usage.jsx";
import { ChatProvider } from "./state/Chat.jsx";
import { Hero } from "./components/Hero.jsx";
import { ChatContainer } from "./components/chat/ChatContainer.jsx";
import { JobsPage } from "./components/jobs/JobsPage.jsx";
import { HermesPage } from "./components/hermes/HermesPage.jsx";
import { ToolsPage } from "./components/tools/ToolsPage.jsx";

const VIEWS = {
  hero: Hero,
  chat: ChatContainer,
  jobs: JobsPage,
  hermes: HermesPage,
  tools: ToolsPage,
};

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
          <ViewComponent />
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
            <Stage />
          </ChatProvider>
        </ViewModeProvider>
      </UsageProvider>
    </GatewayHealthProvider>
  );
}
