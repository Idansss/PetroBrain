import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export type BannerTone = 'safe' | 'info' | 'warn' | 'danger';

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  tone?: BannerTone;
  title?: string;
  icon?: ReactNode;
}

const toneClasses: Record<BannerTone, string> = {
  safe: 'bg-safe-bg text-safe-fg border-safe-border',
  info: 'bg-info-bg text-info-fg border-info-border',
  warn: 'bg-warn-bg text-warn-fg border-warn-border',
  danger: 'bg-danger-bg text-danger-fg border-danger-border',
};

/**
 * Banner is the safety-critical surface. It is reserved for the verification
 * banner on kill-sheet output, live-event immediate-action notices, and
 * guardrail refusals — render it inline at the top of the message, never
 * collapse it behind a click.
 */
export function Banner({
  tone = 'info',
  title,
  icon,
  className,
  children,
  ...rest
}: BannerProps) {
  return (
    <div
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      className={clsx(
        'flex items-start gap-3 rounded-md border-l-4 border p-3 text-sm',
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
