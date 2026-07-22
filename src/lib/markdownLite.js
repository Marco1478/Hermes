/*
  markdownLite — a small hand-rolled Markdown-ish renderer, not a dependency.
  Notes are local-only content this same browser typed (see state/Notes.jsx)
  so there's no untrusted-author threat model here, but input is still HTML-
  escaped before any tag is generated — this renders styled text, not a
  templating engine. Supports: headers, bold/italic, inline code, fenced
  code blocks, links, blockquotes, horizontal rules, unordered/ordered
  lists, and GitHub-style task list checkboxes.
*/

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

export function renderMarkdownLite(source) {
  const lines = (source || "").split("\n");
  const html = [];
  let i = 0;
  let listBuffer = null; // { tag: "ul"|"ol", items: [] }

  const flushList = () => {
    if (!listBuffer) return;
    html.push(`<${listBuffer.tag}>${listBuffer.items.join("")}</${listBuffer.tag}>`);
    listBuffer = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      flushList();
      html.push(`<pre class="md-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ""}><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      html.push(`<h${level} class="md-heading">${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^(---|\*\*\*)\s*$/.test(line.trim())) {
      flushList();
      html.push("<hr />");
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushList();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    const task = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
    const bullet = !task && line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = !task && !bullet && line.match(/^\s*\d+\.\s+(.*)$/);

    if (task) {
      if (!listBuffer || listBuffer.tag !== "ul") {
        flushList();
        listBuffer = { tag: "ul", items: [] };
      }
      const checked = task[1].toLowerCase() === "x";
      listBuffer.items.push(
        `<li class="md-task"><input type="checkbox" disabled ${checked ? "checked" : ""} /> ${inline(task[2])}</li>`
      );
      i++;
      continue;
    }
    if (bullet) {
      if (!listBuffer || listBuffer.tag !== "ul") {
        flushList();
        listBuffer = { tag: "ul", items: [] };
      }
      listBuffer.items.push(`<li>${inline(bullet[1])}</li>`);
      i++;
      continue;
    }
    if (ordered) {
      if (!listBuffer || listBuffer.tag !== "ol") {
        flushList();
        listBuffer = { tag: "ol", items: [] };
      }
      listBuffer.items.push(`<li>${inline(ordered[1])}</li>`);
      i++;
      continue;
    }

    flushList();
    if (line.trim() === "") {
      i++;
      continue;
    }
    html.push(`<p>${inline(line)}</p>`);
    i++;
  }
  flushList();
  return html.join("\n");
}

export function plainTextPreview(source, maxLen = 140) {
  const stripped = (source || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`_[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen)}…` : stripped;
}

export function wordCount(source) {
  const stripped = (source || "").trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).length;
}
