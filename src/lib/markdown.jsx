/*
  markdown — a small, dependency-free renderer for Hermes's replies.
  Builds real React elements (never dangerouslySetInnerHTML) so there's no
  HTML-injection surface: only the patterns we explicitly recognise below
  ever become markup, everything else stays plain text.

  Supports what a coding agent's replies actually use: fenced code blocks,
  inline code, bold, italic, links, and (un)ordered lists. Not a full
  CommonMark implementation — headings/tables/nested lists are out of
  scope until something actually needs them.
*/

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g;

function parseInline(text, keyPrefix) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="md-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[")) {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m && /^https?:\/\//i.test(m[2])) {
        nodes.push(
          <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer" className="md-link">
            {m[1]}
          </a>
        );
      } else {
        nodes.push(m ? m[1] : token);
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const FENCE_RE = /^```(\w*)\s*$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d+[.)]\s+(.*)$/;

function parseBlocks(text) {
  const blocks = [];
  const lines = text.split("\n");
  let para = [];
  let list = null;
  let i = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join("\n") });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(FENCE_RE);
    if (fence) {
      flushPara();
      flushList();
      const lang = fence[1];
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; /* skip the closing fence (or run off the end mid-stream — fine) */
      blocks.push({ type: "code", lang, text: codeLines.join("\n") });
      continue;
    }
    const ul = line.match(UL_RE);
    const ol = !ul && line.match(OL_RE);
    if (ul || ol) {
      flushPara();
      const ordered = Boolean(ol);
      const itemText = (ul || ol)[1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: "list", ordered, items: [] };
      }
      list.items.push(itemText);
      i++;
      continue;
    }
    flushList();
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  flushList();
  return blocks;
}

/* Renders `text` as a sequence of block elements — caller wraps it (see
   HermesMessage, which puts this inside the same bubble the streaming
   caret is appended to). */
export function Markdown({ text }) {
  const blocks = parseBlocks(text || "");
  return (
    <>
      {blocks.map((b, bi) => {
        if (b.type === "code") {
          return (
            <pre key={bi} className="md-pre">
              {b.lang && <span className="md-pre-lang mono">{b.lang}</span>}
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={bi} className="md-list">
              {b.items.map((item, ii) => (
                <li key={ii}>{parseInline(item, `${bi}-${ii}`)}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={bi} className="md-p">
            {parseInline(b.text, `${bi}`)}
          </p>
        );
      })}
    </>
  );
}
