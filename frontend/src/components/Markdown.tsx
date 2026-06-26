/** Lightweight markdown renderer — no dependencies needed */

interface MDProps {
  content: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  // code
  text = text.replace(/`([^`]+)`/g, "<code style=\"background:var(--hover-bg, rgba(255,255,255,0.08));padding:1px 5px;border-radius:3px;font-size:0.9em\">$1</code>");
  // bold+italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // italic
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // strikethrough
  text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline">$1</a>');
  return text;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isTableSeparator(line: string): boolean {
  // A separator row like |---|---| has only dashes, pipes, colons, spaces
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  // Strip leading/trailing pipe, split on pipe
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function renderTable(tableLines: string[], startIndex: number): JSX.Element {
  // First line is header, second is separator, rest are body rows
  const headers = parseTableCells(tableLines[0]);
  const bodyRows = tableLines.slice(2);

  return (
    <div key={`tbl-${startIndex}`} style={{ overflowX: "auto", margin: "8px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  border: "1px solid var(--border)",
                  padding: "8px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  background: "var(--hover-bg, rgba(255,255,255,0.05))",
                  color: "var(--text-primary)",
                }}
                dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(h)) }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri}>
              {parseTableCells(row).map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    border: "1px solid var(--border)",
                    padding: "6px 12px",
                    color: "var(--text-secondary)",
                  }}
                  dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(cell)) }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Markdown({ content }: MDProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let codeIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`cb-${codeIndex}`} style={{
            background: "var(--hover-bg, rgba(255,255,255,0.05))",
            borderRadius: 8, padding: "12px 16px", margin: "8px 0",
            overflowX: "auto", fontSize: "13px", lineHeight: 1.5
          }}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        codeIndex++;
        inCodeBlock = false;
        codeLang = "";
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table — detect by checking if this line and the next form a table
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines: string[] = [line];
      let j = i + 1;
      // Collect all consecutive table rows (skip the separator)
      while (j < lines.length && isTableRow(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }
      elements.push(renderTable(tableLines, i));
      i = j - 1; // skip consumed lines
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`e-${i}`} style={{ height: 8 }} />);
      continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const size = [28, 22, 18, 16, 14, 13][level - 1];
      elements.push(
        <div key={`h-${i}`} style={{
          fontSize: size, fontWeight: 600, margin: "12px 0 6px",
          color: "var(--text-primary)", lineHeight: 1.3
        }}>
          <span dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(hMatch[2])) }} />
        </div>
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (ulMatch) {
      elements.push(
        <div key={`li-${i}`} style={{ display: "flex", gap: 8, paddingLeft: 20, margin: "2px 0" }}>
          <span style={{ color: "var(--text-muted)" }}>•</span>
          <span style={{ color: "var(--text-primary)" }} dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(ulMatch[2])) }} />
        </div>
      );
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
    if (olMatch) {
      elements.push(
        <div key={`li-${i}`} style={{ display: "flex", gap: 8, paddingLeft: 20, margin: "2px 0" }}>
          <span style={{ color: "var(--text-muted)", minWidth: 20, textAlign: "right" }}>{olMatch[2]}.</span>
          <span style={{ color: "var(--text-primary)" }} dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(olMatch[3])) }} />
        </div>
      );
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^>\s+(.+)/);
    if (bqMatch) {
      elements.push(
        <div key={`bq-${i}`} style={{
          borderLeft: "3px solid var(--text-muted)", paddingLeft: 12, margin: "6px 0",
          color: "var(--text-secondary)", fontStyle: "italic"
        }}>
          <span dangerouslySetInnerHTML={{ __html: renderInline(escapeHtml(bqMatch[1])) }} />
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      elements.push(<div key={`hr-${i}`} style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />);
      continue;
    }

    // Regular paragraph
    const escaped = escapeHtml(line);

    elements.push(
      <div key={`p-${i}`} style={{ margin: "4px 0", lineHeight: 1.6, color: "var(--text-primary)" }}>
        <span dangerouslySetInnerHTML={{ __html: renderInline(escaped) }} />
      </div>
    );
  }

  // Unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre key={`cb-end`} style={{
        background: "var(--hover-bg, rgba(255,255,255,0.05))",
        borderRadius: 8, padding: "12px 16px", margin: "8px 0",
        overflowX: "auto", fontSize: "13px"
      }}>
        <code>{codeLines.join("\n")}</code>
      </pre>
    );
  }

  return <>{elements}</>;
}
