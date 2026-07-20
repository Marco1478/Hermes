import { createContext, useContext } from "react";
import { useGatewayHealth } from "../hooks/useGatewayHealth.js";

const GatewayHealthContext = createContext(null);

/*
  One real polling loop, shared by the terminal (which just displays it)
  and the chat composer (which reads it for the placeholder reply). Two
  independent pollers would double-hit the gateway and could disagree.
*/
export function GatewayHealthProvider({ children }) {
  const value = useGatewayHealth();
  return <GatewayHealthContext.Provider value={value}>{children}</GatewayHealthContext.Provider>;
}

export function useGateway() {
  const ctx = useContext(GatewayHealthContext);
  if (!ctx) throw new Error("useGateway must be used within GatewayHealthProvider");
  return ctx;
}
