import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

export function Card({ title, description, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-neutral-200 bg-white p-4 shadow-sm',
        className,
      )}
      {...rest}
    >
      {title ? (
        <header className="mb-3">
          <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  );
}
