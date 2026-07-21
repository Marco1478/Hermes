import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { claudeUsagePlugin } from "./vite-plugins/claudeUsage.js";
import { hermesBridgePlugin } from "./vite-plugins/hermesBridge.js";
import { activityBridgePlugin } from "./vite-plugins/activityBridge.js";
import { missionBridgePlugin } from "./vite-plugins/missionBridge.js";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gatewayTarget = env.VITE_GATEWAY_BASE_URL || "http://192.168.2.11:8642";
  /*
    Dashboard credentials are deliberately NOT VITE_-prefixed: loadEnv's 3rd
    arg ("") loads every var (not just VITE_*) into `env` for use HERE, in
    Node, but only VITE_-prefixed ones ever get statically replaced into
    client bundle code. Keeping these unprefixed is what keeps the password
    out of the browser entirely.
  */
  const dashboardBaseUrl = env.HERMES_DASHBOARD_BASE_URL || "http://192.168.2.11:9119";
  const dashboardUsername = env.HERMES_DASHBOARD_USERNAME || "";
  const dashboardPassword = env.HERMES_DASHBOARD_PASSWORD || "";
  /*
    Kanban has no HTTP surface (see vite-plugins/kanbanBridge.js) — it's
    reached by SSH-exec'ing the real `hermes kanban` CLI inside the
    container, over the same bridge documented in this repo's CLAUDE.md.
    Server-only (not VITE_-prefixed): never sent to the client bundle.
  */
  const sshHost = env.HERMES_SSH_HOST || "root@192.168.2.11";
  const sshKeyPath = env.HERMES_SSH_KEY_PATH || "";

  return {
    plugins: [
      react(),
      claudeUsagePlugin(),
      hermesBridgePlugin({
        gatewayBaseUrl: gatewayTarget,
        gatewayApiKey: env.VITE_GATEWAY_API_KEY || "",
        dashboardBaseUrl,
        dashboardUsername,
        dashboardPassword,
        sshHost,
        sshKeyPath,
      }),
      activityBridgePlugin({ projectRoot: process.cwd() }),
      missionBridgePlugin({ projectRoot: process.cwd() }),
    ],
    server: {
      proxy: {
        /*
          Dev-only CORS workaround: the Hermes gateway's API server
          doesn't send Access-Control-Allow-* headers, so the browser
          blocks cross-origin requests before a response ever comes
          back (confirmed: curl reaches it fine, fetch() from the page
          doesn't). Routing through Vite's own proxy keeps the browser
          on same-origin (localhost:5199) — Vite's Node process makes
          the real request server-side, where CORS doesn't apply.
          This only exists in `npm run dev`; a production build would
          need the gateway to send real CORS headers, or its own proxy.
        */
        "/gw": {
          target: gatewayTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gw/, ""),
          /*
            The gateway 403s browser-originated requests specifically
            (health check GET mostly succeeds, POST chat/completions
            always 403s) while an identical request from curl/PowerShell
            succeeds. The one thing a browser always adds that those
            don't: Origin (and Referer). Likely an anti-CSRF check on
            the server rejecting an Origin it doesn't recognise — strip
            both so the proxied request looks like the tools that work.
          */
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("origin");
              proxyReq.removeHeader("referer");
            });
          },
        },
      },
    },
  };
});
