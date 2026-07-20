/*
  exportChat — turns a chat's message history into a plain-text
  transcript and triggers a client-side download. No server involved:
  a Blob + a throwaway <a download> click, same pattern any static page
  uses to "save" something the browser already has in memory.
*/
export function chatToMarkdown(chat) {
  const lines = [`# ${chat.title || "Untitled chat"}`, ""];
  for (const m of chat.messages || []) {
    const who = m.role === "user" ? "You" : "Hermes";
    lines.push(`**${who}:**`, "", m.text || "(empty)", "");
  }
  return lines.join("\n");
}

export function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugify(title) {
  return (
    (title || "chat")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "chat"
  );
}
