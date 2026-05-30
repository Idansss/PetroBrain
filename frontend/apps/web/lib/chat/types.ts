import type { Citation, Module, ToolResult } from '@petrobrain/types';

export type MessageRole = 'user' | 'assistant';

/**
 * One on-screen turn. ``streaming=true`` means tokens are still arriving;
 * the renderer keeps the message visible and appends as events flow in.
 *
 * ``flags`` carries safety guardrail signals (``safety_bypass``,
 * ``unverified_numbers``, ``missing_safety_banner`` …). They drive the
 * top Banner; on safety-critical answers the Banner stays inline.
 */
export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  module: Module;
  assetContext: string | null;
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  text: string;
  citations: Citation[];
  toolResults: ToolResult[];
  flags: string[];
  streaming: boolean;
  error?: string;
  createdAt: number;
}

export type Message = UserMessage | AssistantMessage;
