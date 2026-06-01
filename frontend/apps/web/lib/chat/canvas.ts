/**
 * Canvas detection: which assistant messages are "document-shaped" enough
 * that the user benefits from a side-panel re-render?
 *
 * Two ways an assistant message qualifies:
 *   - it called a structured tool (kill sheet / GHGEMP report / PTW template
 *     - things that exist to produce a *document*, not a number), OR
 *   - the answer prose itself crosses a length threshold (long SOP summary,
 *     multi-step procedure, etc.).
 */
import type { AssistantMessage } from './types';

const STRUCTURED_TOOLS: ReadonlySet<string> = new Set([
  'build_kill_sheet',
  'build_ghgemp_report',
  'build_ptw_template',
]);

const LONG_TEXT_WORDS = 500;

function wordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isStructuredToolMessage(m: AssistantMessage): boolean {
  return m.toolResults.some((tr) => STRUCTURED_TOOLS.has(tr.tool));
}

export function isLongMessage(m: AssistantMessage): boolean {
  return wordCount(m.text) >= LONG_TEXT_WORDS;
}

export function isCanvasWorthy(m: AssistantMessage): boolean {
  if (m.streaming) return false;
  return isStructuredToolMessage(m) || isLongMessage(m);
}
