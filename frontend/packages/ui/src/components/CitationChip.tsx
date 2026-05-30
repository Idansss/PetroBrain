import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import type { Citation } from '@petrobrain/types';

export interface CitationChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  citation: Citation;
}

/**
 * Compact, click-to-open citation reference.
 *
 * On safety-critical answers the parent surface must NOT hide the chip
 * behind a click; render it inline next to the sentence it supports.
 */
export function CitationChip({ citation, className, ...rest }: CitationChipProps) {
  const label = formatLabel(citation);
  return (
    <button
      type="button"
      title={label}
      aria-label={`Citation: ${label}`}
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill border border-primary-200 bg-primary-50',
        'px-2 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">📑</span>
      <span>{label}</span>
    </button>
  );
}

function formatLabel(c: Citation): string {
  const parts: string[] = [];
  if (c.title) parts.push(c.title);
  if (c.revision) parts.push(c.revision);
  if (c.clause) parts.push(`§${c.clause}`);
  return parts.join(' · ') || 'source';
}
