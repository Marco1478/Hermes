/*
  FileVault — exactly what the composer's clip button can and can't send,
  and why. No mystery partial behavior: every unsupported class names its
  real cause (confirmed against gateway/platforms/api_server.py and this
  session's own testing), not a generic "unsupported file type".
*/
const SUPPORT_MATRIX = [
  { label: "Images (PNG/JPEG/WEBP/GIF, ≤8MB)", state: "supported", detail: "Sent as a real multimodal image_url content part on the Runs API — verified live, Hermes describes actual image content." },
  { label: "Text / code / Markdown / JSON", state: "supported", detail: "Read client-side and appended to the prompt as context (truncated past 100KB, marked when it is)." },
  { label: "PDF", state: "unsupported", detail: "Gateway file_input unsupported — gateway/platforms/api_server.py rejects file/input_file content parts before they reach the agent." },
  { label: "DOC / DOCX", state: "unsupported", detail: "Gateway file_input unsupported — same rejection as PDF; no extraction endpoint exists to fall back to." },
  { label: "Other binary files", state: "blocked", detail: "MIME type blocked — not offered in the file picker at all, to avoid sending garbled bytes as fake text context." },
];

const STATE_LABEL = { supported: "supported", unsupported: "unsupported", blocked: "blocked" };

export function FileVault({ onClose }) {
  return (
    <div className="file-vault glass-card">
      <div className="file-vault-head">
        <span className="panel-section-title">File support</span>
        <button type="button" className="btn-pill btn-pill--icon" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {SUPPORT_MATRIX.map((row) => (
        <div key={row.label} className="file-vault-row">
          <div className="file-vault-row-head">
            <span className="file-vault-row-label">{row.label}</span>
            <span className={`status-badge ${row.state === "supported" ? "status-badge--ok" : row.state === "unsupported" ? "status-badge--warn" : "status-badge--bad"}`}>
              {STATE_LABEL[row.state]}
            </span>
          </div>
          <p className="file-vault-row-detail">{row.detail}</p>
        </div>
      ))}
    </div>
  );
}
