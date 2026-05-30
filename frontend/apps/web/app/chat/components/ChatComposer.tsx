'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '@petrobrain/ui';

export interface ChatComposerProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSubmit, disabled }: ChatComposerProps) {
  const [value, setValue] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value.trim());
    setValue('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter sends; plain Enter keeps newline so engineers can paste blocks of context.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit(e as unknown as FormEvent);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t border-neutral-200 bg-white p-4"
      aria-label="Ask PetroBrain"
    >
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-input"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask a question grounded in your SOPs or build a kill sheet…"
        className="flex-1 resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary-400"
        disabled={disabled}
      />
      <Button type="submit" variant="primary" size="md" disabled={!value.trim() || disabled}>
        Send
      </Button>
    </form>
  );
}
