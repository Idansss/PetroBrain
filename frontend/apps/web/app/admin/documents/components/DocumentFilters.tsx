'use client';

import { Select } from '@petrobrain/ui';

import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  type DocumentStatus,
  type DocumentType,
} from '@/lib/admin-documents/types';

export interface DocumentFilterState {
  status: DocumentStatus | 'all';
  type: DocumentType | 'all';
  asset: string | 'all';
}

export interface DocumentFiltersProps {
  value: DocumentFilterState;
  onChange: (next: DocumentFilterState) => void;
  assetOptions: { value: string; label: string }[];
}

export function DocumentFilters({ value, onChange, assetOptions }: DocumentFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Select
        label="Status"
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value as DocumentFilterState['status'] })}
        options={[
          { value: 'all', label: 'All statuses' },
          ...DOCUMENT_STATUSES.map((s) => ({ value: s, label: s })),
        ]}
      />
      <Select
        label="Type"
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value as DocumentFilterState['type'] })}
        options={[
          { value: 'all', label: 'All types' },
          ...DOCUMENT_TYPES.map((t) => ({ value: t, label: t })),
        ]}
      />
      <Select
        label="Asset"
        value={value.asset}
        onChange={(e) => onChange({ ...value, asset: e.target.value })}
        options={[{ value: 'all', label: 'All assets' }, ...assetOptions]}
      />
    </div>
  );
}
