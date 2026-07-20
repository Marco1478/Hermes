import "./UserMessage.css";

export function UserMessage({ text, files }) {
  return (
    <div className="msg msg--user">
      <div className="msg-user-stack">
        {files && files.length > 0 && (
          <div className="msg-files">
            {files.map((f, i) => (
              <span key={i} className="msg-file-chip mono">
                <span className="msg-file-clip" aria-hidden="true">
                  ⎘
                </span>
                {f.name}
              </span>
            ))}
          </div>
        )}
        {text && <p className="msg-bubble">{text}</p>}
      </div>
    </div>
  );
}
