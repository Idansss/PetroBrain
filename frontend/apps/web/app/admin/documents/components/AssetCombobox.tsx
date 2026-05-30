'use client';

import { useId, useMemo, useState } from 'react';
import clsx from 'clsx';

import type { AssetNode } from '@petrobrain/types';

export interface AssetComboboxProps {
  label: string;
  value: string | null;
  onChange: (assetId: string | null) => void;
  assets: AssetNode[];
  hint?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Lightweight asset autocomplete (B3).
 *
 * Intentionally not a real combobox primitive — that lands in the shared
 * UI package once the field app needs one too. For now: an Input filters
 * the loaded asset list by substring and a small dropdown lets the admin
 * pick by mouse or keyboard.
 */
export function AssetCombobox({
  label,
  value,
  onChange,
  assets,
  hint,
  error,
  disabled,
}: AssetComboboxProps) {
  const listId = useId();
  const inputId = `${listId}-input`;

  const selected = useMemo(() => assets.find((a) => a.id === value) ?? null, [assets, value]);
  const [query, setQuery] = useState(selected ? formatAsset(selected) : '');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return assets.slice(0, 8);
    return assets
      .filter(
        (a) =>
          a.name.toLowerCase().includes(trimmed) ||
          a.id.toLowerCase().includes(trimmed) ||
          a.type.toLowerCase().includes(trimmed),
      )
      .slice(0, 8);
  }, [assets, query]);

  function pick(asset: AssetNode | null) {
    onChange(asset?.id ?? null);
    setQuery(asset ? formatAsset(asset) : '');
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            // Free-text edits clear the bound id until the user re-picks.
            if (value !== null) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          placeholder="No asset context"
          className={clsx(
            'h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base',
            'focus:outline-none focus:ring-2 focus:ring-primary-400',
            error && 'border-danger-border focus:ring-danger-border',
          )}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg"
          >
            <li
              role="option"
              aria-selected={value === null}
              className="cursor-pointer px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(null);
              }}
            >
              — No asset context —
            </li>
            {filtered.map((asset) => (
              <li
                key={asset.id}
                role="option"
                aria-selected={asset.id === value}
                className={clsx(
                  'cursor-pointer px-3 py-2 text-sm hover:bg-primary-50',
                  asset.id === value && 'bg-primary-50',
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(asset);
                }}
              >
                <div className="font-medium text-neutral-800">{asset.name}</div>
                <div className="font-mono text-xs text-neutral-500">
                  {asset.type} · {asset.id}
                </div>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-neutral-500">No assets match.</li>
            ) : null}
          </ul>
        ) : null}
      </div>
      {hint && !error ? <p className="text-xs text-neutral-500">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formatAsset(a: AssetNode): string {
  return `${a.name} (${a.type})`;
}
