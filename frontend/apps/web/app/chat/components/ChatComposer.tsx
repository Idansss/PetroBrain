'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import type { MessageAttachment } from '@/lib/chat/types';
import { usePendingPromptStore } from '@/lib/chat/pendingPrompt';
import { useSettingsStore } from '@/lib/chat/settings';
import { useChatStore, type ThinkingMode } from '@/lib/chat/store';

import { ComposerMenu } from './ComposerMenu';

const THINKING_MODES: Array<{ key: ThinkingMode; label: string; title: string }> = [
  { key: 'instant', label: 'Instant', title: 'Fast Haiku model, short answers' },
  { key: 'default', label: 'Default', title: 'Standard Sonnet, no extended thinking' },
  { key: 'extended', label: 'Extended', title: 'Sonnet with extended thinking for hard problems' },
];

const ACCEPTED = '.txt,.md,.markdown,.csv,.json,.pdf,.docx,image/*';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file
const MAX_FILES = 6;

export interface ChatComposerProps {
  onSubmit: (text: string, attachments: MessageAttachment[]) => void;
  /** Hard-disabled (no auth / no backend). Distinct from ``sending`` so the user
   *  can keep typing the next prompt while an answer is streaming. */
  disabled?: boolean;
  /** True while an assistant turn is streaming. Swaps the send button for a
   *  Stop button that calls ``onStop`` to abort the in-flight fetch. */
  sending?: boolean;
  onStop?: () => void;
}

let attachCounter = 0;
function nextAttachId(): string {
  attachCounter += 1;
  return `att-${Date.now()}-${attachCounter}`;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function classifyKind(file: File): MessageAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (['txt', 'md', 'markdown', 'csv', 'json'].includes(ext)) return 'text';
  return 'document';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ThinkingModePicker({
  value,
  onChange,
  disabled,
}: {
  value: ThinkingMode;
  onChange: (m: ThinkingMode) => void;
  disabled?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const current = THINKING_MODES.find((m) => m.key === value) ?? THINKING_MODES[1]!;

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative ml-0.5 mr-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        title={current.title}
        className={`group inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-900 ${
          open
            ? 'border-primary-300 text-primary-700 dark:border-primary-600 dark:text-primary-300'
            : 'border-neutral-200/80 text-neutral-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-primary-600 dark:hover:bg-primary-900/30 dark:hover:text-primary-300'
        }`}
      >
        <span>{current.label}</span>
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 20 20"
          fill="none"
          className={`text-neutral-500 transition-transform dark:text-neutral-400 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          aria-label="Thinking mode"
          className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-[0_18px_36px_-12px_rgba(15,23,42,0.20),0_4px_10px_-3px_rgba(15,23,42,0.10)] dark:border-neutral-700 dark:bg-neutral-900"
        >
          {THINKING_MODES.map((m) => {
            const selected = m.key === value;
            return (
              <li key={m.key}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(m.key);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className={`flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-primary-50/70 dark:bg-primary-900/30'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800'
                    }`}
                  >
                    {selected ? (
                      <svg width="8" height="8" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M5 10.5L8.5 14L15 7"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold ${
                        selected
                          ? 'text-primary-800 dark:text-primary-200'
                          : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {m.label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                      {m.title}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function ChatComposer({ onSubmit, disabled, sending, onStop }: ChatComposerProps) {
  const thinkingMode = useChatStore((s) => s.thinkingMode);
  const setThinkingMode = useChatStore((s) => s.setThinkingMode);
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Drain any pending prompt the user picked from the Customize directory.
  // Runs once on mount and clears the store so refresh doesn't replay it.
  const consumePending = usePendingPromptStore((s) => s.consume);
  useEffect(() => {
    const next = consumePending();
    if (next) {
      setValue(next);
      window.setTimeout(() => {
        textareaRef.current?.focus();
        const el = textareaRef.current;
        if (el) el.setSelectionRange(el.value.length, el.value.length);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl+U opens the file picker (matches the shortcut shown in the +menu row).
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Browser screen capture into the attachments tray. User picks a screen,
  // window, or tab; we grab one frame, encode it as PNG, drop it in as an
  // image attachment, then release the stream.
  async function takeScreenshot() {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen capture not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No video track');
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      track.stop();
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not encode screenshot');
      const filename = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      await addFiles([file]);
    } catch (err) {
      if ((err as { name?: string }).name === 'NotAllowedError') return; // user dismissed
      setError(err instanceof Error ? err.message : 'Could not capture screenshot.');
    }
  }

  // Auto-grow the textarea up to ~6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  async function addFiles(files: FileList | File[]) {
    setError(null);
    const incoming = Array.from(files);
    if (attachments.length + incoming.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} attachments per message.`);
      return;
    }

    const next: MessageAttachment[] = [];
    for (const file of incoming) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over the ${formatBytes(MAX_BYTES)} limit.`);
        continue;
      }
      const kind = classifyKind(file);
      let preview: string | null = null;
      try {
        if (kind === 'image') preview = await readAsDataURL(file);
        else if (kind === 'text') preview = await readAsText(file);
      } catch {
        // Don't drop the whole batch on one read failure - just attach a stub.
        preview = null;
      }
      next.push({
        id: nextAttachId(),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        kind,
        preview,
      });
    }
    setAttachments((curr) => [...curr, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((curr) => curr.filter((a) => a.id !== id));
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void addFiles(e.target.files);
      e.target.value = '';
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void addFiles(e.dataTransfer.files);
    }
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.currentTarget === e.target) setDragOver(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    // Block submit while another turn is streaming so the user's draft isn't
    // silently cleared and the parent's send() no-op isn't surprising.
    if ((!trimmed && attachments.length === 0) || disabled || sending) return;
    onSubmit(trimmed, attachments);
    setValue('');
    setAttachments([]);
    setError(null);
  }

  // Send behavior follows the user's setting:
  //   'enter'        → Enter sends, Shift+Enter newline (default - like ChatGPT/Claude)
  //   'shift_enter'  → Shift+Enter sends, plain Enter newline
  const sendShortcut = useSettingsStore((s) => s.sendShortcut);
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key !== 'Enter') return;
    const shouldSend =
      sendShortcut === 'enter' ? !e.shiftKey : e.shiftKey;
    if (shouldSend) {
      e.preventDefault();
      submit(e as unknown as FormEvent);
    }
  }

  function applyAction(prompt: string) {
    setValue((v) => (v ? `${v}\n\n${prompt}` : prompt));
    textareaRef.current?.focus();
  }

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled;

  return (
    <form
      onSubmit={submit}
      className="relative z-10 bg-transparent px-4 py-3"
      aria-label="Ask PetroBrain"
    >
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border bg-white p-2 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.10),0_1px_2px_rgba(15,23,42,0.04)] transition-all focus-within:border-primary-400 focus-within:shadow-[0_10px_28px_-10px_rgba(234,88,12,0.30),0_2px_4px_rgba(15,23,42,0.05)] focus-within:ring-2 focus-within:ring-primary-200 dark:bg-neutral-900 dark:focus-within:border-primary-500 dark:focus-within:ring-primary-800 ${
          dragOver
            ? 'border-primary-400 bg-primary-50/40 ring-2 ring-primary-200 dark:bg-primary-900/20 dark:ring-primary-700'
            : 'border-neutral-200 dark:border-neutral-700'
        }`}
      >
        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-1 pt-1" aria-label="Attached files">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="group relative flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/60 py-1 pl-1 pr-2 dark:border-neutral-700 dark:bg-neutral-800/60"
              >
                {a.kind === 'image' && a.preview ? (
                  <img
                    src={a.preview}
                    alt={a.name}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      a.kind === 'text'
                        ? 'bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600 dark:from-primary-900/40 dark:to-primary-800/40 dark:text-primary-300'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                    aria-hidden
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M6 3h6l4 4v9a1.5 1.5 0 01-1.5 1.5h-8.5A1.5 1.5 0 014.5 16V4.5A1.5 1.5 0 016 3z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                <div className="flex max-w-[12rem] flex-col leading-tight">
                  <span className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-200" title={a.name}>
                    {a.name}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {formatBytes(a.sizeBytes)}
                    {a.kind === 'document' ? ' · use Documents tab to ingest' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Remove ${a.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 opacity-0 shadow-sm transition-opacity hover:bg-neutral-100 hover:text-neutral-700 group-hover:opacity-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          ref={textareaRef}
          id="chat-input"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question grounded in your SOPs, or build a kill sheet…"
          className="scrollbar-hide max-h-40 min-h-[28px] resize-none border-0 bg-transparent px-2.5 py-1.5 text-[15px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          disabled={disabled}
        />

        <div className="flex items-center justify-between gap-2 pl-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              onChange={onFileInputChange}
              className="sr-only"
              aria-label="Attach files"
            />
            <ComposerMenu
              onAttachFiles={() => fileInputRef.current?.click()}
              onTakeScreenshot={takeScreenshot}
              onApplyPrompt={applyAction}
              disabled={disabled}
            />
            <ThinkingModePicker
              value={thinkingMode}
              onChange={setThinkingMode}
              disabled={disabled}
            />
          </div>

          {sending ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="group relative isolate flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-neutral-800 to-neutral-900 text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all hover:from-neutral-700 hover:to-neutral-800 dark:from-neutral-200 dark:to-neutral-100 dark:text-neutral-900 dark:hover:from-neutral-100 dark:hover:to-white"
            >
              <span aria-hidden className="block h-3 w-3 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className="group relative isolate flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-primary-500 to-primary-700 text-white shadow-[0_6px_14px_-6px_rgba(234,88,12,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] transition-all hover:from-primary-400 hover:to-primary-600 hover:shadow-[0_10px_24px_-8px_rgba(234,88,12,0.55)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-[0_6px_14px_-6px_rgba(234,88,12,0.55),inset_0_1px_0_rgba(255,255,255,0.28)]"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 16V4M4 10l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-danger-fg dark:text-danger-bg">
          {error}
        </p>
      ) : null}

      <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-neutral-400 dark:text-neutral-500">
        PetroBrain is decision support - verify safety-critical numbers with the competent person.{' '}
        {sendShortcut === 'enter'
          ? 'Enter to send · Shift+Enter for newline.'
          : 'Shift+Enter to send · Enter for newline.'}
      </p>
    </form>
  );
}
