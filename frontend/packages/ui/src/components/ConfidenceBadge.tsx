import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import type { ConfidenceLabel } from '@petrobrain/types';

export interface ConfidenceBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  label: ConfidenceLabel;
  reason?: string;
}

const labelClasses: Record<ConfidenceLabel, string> = {
  high: 'bg-safe-bg text-safe-fg border-safe-border',
  medium: 'bg-info-bg text-info-fg border-info-border',
  low: 'bg-warn-bg text-warn-fg border-warn-border',
  unknown: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

const labelText: Record<ConfidenceLabel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  unknown: 'Confidence unknown',
};

/**
 * Confidence/uncertainty must be rendered visibly per the engineering spec —
 * never hidden inside a tooltip. Keep the label on the surface; the optional
 * ``reason`` shows on hover for engineers who want detail.
 */
export function ConfidenceBadge({ label, reason, className, ...rest }: ConfidenceBadgeProps) {
  return (
    <span
      title={reason ?? undefined}
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-medium',
        labelClasses[label],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">●</span>
      <span>{labelText[label]}</span>
    </span>
  );
}
