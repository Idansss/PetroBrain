'use client';

import { useState } from 'react';
import clsx from 'clsx';

import { Badge } from '@petrobrain/ui';

export interface WorkingPanelProps {
  tool: string;
  input: unknown;
  result: unknown;
  defaultOpen?: boolean;
}

/**
 * Collapsible per-tool detail. Renders, in order: a row of headline numbers
 * from the result (everything that's not an array / object / banner), then
 * the working steps array, then the raw input + result as JSON for
 * engineers who want to audit a specific line.
 *
 * Stays expanded by default for safety-critical tools (kill_sheet,
 * MAASP …) so the working is not hidden behind a click.
 */
export function WorkingPanel({ tool, input, result, defaultOpen = false }: WorkingPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-md border border-neutral-200 bg-neutral-50"
    >
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-neutral-800">
          <Badge tone="info">tool</Badge>
          <code className="font-mono">{tool}</code>
        </span>
        <span className="text-xs text-neutral-500">{open ? 'Hide working' : 'Show working'}</span>
      </summary>
      <div className="space-y-3 px-3 pb-3">
        <HeadlineNumbers result={result} />
        <Steps result={result} />
        <RawBlocks tool={tool} input={input} result={result} />
      </div>
    </details>
  );
}

function HeadlineNumbers({ result }: { result: unknown }) {
  if (!isObject(result)) return null;
  const entries = Object.entries(result).filter(
    ([k, v]) =>
      k !== 'banner' &&
      k !== 'working' &&
      k !== 'notes' &&
      (typeof v === 'number' || typeof v === 'string'),
  );
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-md border border-neutral-200 bg-white p-2">
          <dt className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">{k}</dt>
          <dd className="font-semibold text-neutral-800">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Steps({ result }: { result: unknown }) {
  if (!isObject(result)) return null;
  const working = result['working'];
  if (!Array.isArray(working) || working.length === 0) return null;
  return (
    <ol className={clsx('list-decimal space-y-1 pl-5 text-xs text-neutral-700')}>
      {working.map((step, i) => (
        <li key={i} className="font-mono">
          {typeof step === 'string' ? step : JSON.stringify(step)}
        </li>
      ))}
    </ol>
  );
}

function RawBlocks({ tool, input, result }: { tool: string; input: unknown; result: unknown }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <RawBlock label={`${tool} input`} value={input} />
      <RawBlock label={`${tool} result`} value={result} />
    </div>
  );
}

function RawBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="rounded-md border border-neutral-200 bg-white">
      <summary className="cursor-pointer px-2 py-1 text-xs text-neutral-600">{label}</summary>
      <pre className="overflow-x-auto px-2 pb-2 text-[11px] text-neutral-700">
        {value === undefined ? '(none)' : JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
