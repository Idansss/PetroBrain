import type { Conversation } from './conversations';
import type { AssistantMessage, Message, UserMessage } from './types';

const ISO = (n: number) => new Date(n).toISOString();
const SAFE_FILENAME_RE = /[^a-z0-9-_]+/gi;

export function conversationToMarkdown(conv: Conversation): string {
  const lines: string[] = [];
  lines.push(`# ${conv.title}`);
  lines.push('');
  lines.push(`> Exported from PetroBrain - ${new Date().toISOString()}`);
  lines.push(`> Created: ${ISO(conv.createdAt)} - Updated: ${ISO(conv.updatedAt)}`);
  if (conv.messages.length === 0) {
    lines.push('');
    lines.push('_(empty conversation)_');
    return lines.join('\n');
  }
  lines.push('');
  lines.push('---');
  for (const m of conv.messages) {
    lines.push('');
    if (m.role === 'user') {
      lines.push(...renderUser(m));
    } else {
      lines.push(...renderAssistant(m));
    }
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    'PetroBrain is decision support - verify safety-critical numbers with the competent person before acting.',
  );
  return lines.join('\n');
}

function renderUser(m: UserMessage): string[] {
  const out: string[] = [`## You - ${ISO(m.createdAt)}`, ''];
  if (m.module && m.module !== 'general') {
    out.push(`_Module: ${m.module}${m.assetContext ? ` - Asset: ${m.assetContext}` : ''}_`);
    out.push('');
  } else if (m.assetContext) {
    out.push(`_Asset: ${m.assetContext}_`);
    out.push('');
  }
  if (m.text.trim()) {
    out.push(m.text.trim());
  }
  if (m.attachments && m.attachments.length > 0) {
    out.push('');
    out.push('**Attachments:**');
    for (const a of m.attachments) {
      out.push(`- ${a.name} (${a.kind}, ${formatBytes(a.sizeBytes)})`);
    }
  }
  return out;
}

function renderAssistant(m: AssistantMessage): string[] {
  const out: string[] = [`## PetroBrain - ${ISO(m.createdAt)}`, ''];
  if (m.error) {
    out.push(`> Error: ${m.error}`);
    out.push('');
  }
  if (m.text.trim()) {
    out.push(m.text.trim());
  }
  if (m.citations.length > 0) {
    out.push('');
    out.push('**Citations:**');
    for (const c of m.citations) {
      const parts = [c.title, c.revision, c.clause].filter(Boolean).join(' - ');
      out.push(`- ${parts}${c.url ? ` (${c.url})` : ''}`);
    }
  }
  if (m.flags.length > 0) {
    out.push('');
    out.push(`**Flags:** ${m.flags.join(', ')}`);
  }
  return out;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function downloadMarkdown(filename: string, content: string): void {
  const safe = (filename.replace(SAFE_FILENAME_RE, '-').replace(/-+/g, '-').slice(0, 80) || 'conversation') + '.md';
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportConversation(conv: Conversation): void {
  downloadMarkdown(conv.title, conversationToMarkdown(conv));
}

export function exportConversationPdf(conv: Conversation): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=960,height=1200');
  if (!win) {
    window.print();
    return;
  }
  const title = conv.title || 'PetroBrain conversation';
  win.document.write(renderConversationPrintHtml(conv, title));
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    win.print();
  }, 250);
}

export function isExportable(messages: Message[]): boolean {
  return messages.length > 0 && messages.some((m) => m.text.trim().length > 0);
}

function renderConversationPrintHtml(conv: Conversation, title: string): string {
  const messages = conv.messages.map(renderPrintMessage).join('');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #171717;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      line-height: 1.55;
    }
    header {
      border-bottom: 2px solid #ea580c;
      margin-bottom: 22px;
      padding-bottom: 14px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 24px;
      line-height: 1.2;
    }
    .meta {
      color: #666;
      font-size: 11px;
    }
    .message {
      break-inside: avoid;
      border: 1px solid #ddd;
      border-radius: 10px;
      margin: 0 0 14px;
      overflow: hidden;
    }
    .role {
      align-items: center;
      background: #f7f7f7;
      border-bottom: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
      font-weight: 700;
      color: #555;
    }
    .message.user .role {
      background: #fff7ed;
      color: #9a3412;
    }
    .message.assistant .role {
      background: #f5f5f5;
      color: #262626;
    }
    .body {
      padding: 12px;
      white-space: pre-wrap;
    }
    .attachments, .sources, .flags {
      border-top: 1px solid #eee;
      color: #555;
      font-size: 11px;
      padding: 8px 12px;
    }
    footer {
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 11px;
      margin-top: 24px;
      padding-top: 10px;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      Exported from PetroBrain on ${escapeHtml(new Date().toLocaleString())}<br />
      Created ${escapeHtml(new Date(conv.createdAt).toLocaleString())} · Updated ${escapeHtml(new Date(conv.updatedAt).toLocaleString())}
    </div>
  </header>
  <main>${messages || '<p>This conversation is empty.</p>'}</main>
  <footer>PetroBrain is decision support. Verify safety-critical numbers with the competent person before acting.</footer>
</body>
</html>`;
}

function renderPrintMessage(m: Message): string {
  const role = m.role === 'user' ? 'You' : 'PetroBrain';
  const created = new Date(m.createdAt).toLocaleString();
  const body = m.text.trim() || (m.role === 'assistant' && m.streaming ? 'Response in progress.' : '');
  const attachments =
    m.role === 'user' && m.attachments && m.attachments.length > 0
      ? `<div class="attachments"><strong>Attachments:</strong> ${m.attachments
          .map((a) => `${escapeHtml(a.name)} (${escapeHtml(a.kind)}, ${formatBytes(a.sizeBytes)})`)
          .join('; ')}</div>`
      : '';
  const sources =
    m.role === 'assistant' && m.citations.length > 0
      ? `<div class="sources"><strong>Sources:</strong> ${m.citations
          .map((c) => escapeHtml([c.title, c.revision, c.clause, c.url].filter(Boolean).join(' - ')))
          .join('; ')}</div>`
      : '';
  const flags =
    m.role === 'assistant' && m.flags.length > 0
      ? `<div class="flags"><strong>Flags:</strong> ${escapeHtml(m.flags.join(', '))}</div>`
      : '';
  return `<section class="message ${m.role}">
    <div class="role"><span>${role}</span><span>${escapeHtml(created)}</span></div>
    <div class="body">${escapeHtml(body)}</div>
    ${attachments}${sources}${flags}
  </section>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
