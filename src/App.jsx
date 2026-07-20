import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ViewModeProvider, useViewMode } from "./state/ViewMode.jsx";
import { GatewayHealthProvider } from "./state/GatewayHealth.jsx";
import { UsageProvider } from "./state/Usage.jsx";
import { ChatProvider } from "./state/Chat.jsx";
import { Hero } from "./components/Hero.jsx";
import { ChatContainer } from "./components/chat/ChatContainer.jsx";

function Stage() {
  const { mode } = useViewMode();
  return (
    <LayoutGroup>
      <AnimatePresence mode="wait">
        {mode === "hero" ? (
          <motion.div
            key="hero"
            className="view view--hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <Hero />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            className="view view--chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <ChatContainer />
          </motion.div>
        )}
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
