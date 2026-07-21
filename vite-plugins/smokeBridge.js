/*
  smokeBridge — lets the Backend Test Center UI trigger the real
  scripts/smoke-backend.mjs (same script `npm run smoke` runs) and read its
  result, instead of the UI re-implementing the checks itself.
*/
import { execFile } from "node:child_process";

export function smokeBridgePlugin({ projectRoot }) {
  return {
    name: "smoke-bridge",
    configureServer(server) {
      server.middlewares.use("/local/smoke/run", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: "POST only" }));
          return;
        }
        execFile(
          process.execPath,
          ["scripts/smoke-backend.mjs"],
          { cwd: projectRoot, timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
          (err, stdout) => {
            const marker = "SMOKE_RESULT_JSON:";
            const line = stdout.split("\n").find((l) => l.startsWith(marker));
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            if (line) {
              res.end(line.slice(marker.length));
              return;
            }
            res.end(JSON.stringify({ ok: false, error: err?.message || "smoke script produced no parseable result", raw: stdout.slice(-2000) }));
          }
        );
      });
    },
  };
}
