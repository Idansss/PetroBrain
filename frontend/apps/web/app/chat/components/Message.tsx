import { Banner, Badge, CitationChip } from '@petrobrain/ui';

import type { AssistantMessage, Message as MessageType } from '@/lib/chat/types';

import { WorkingPanel } from './WorkingPanel';

const FLAG_BANNERS: Record<string, { tone: 'danger' | 'warn' | 'info'; title: string }> = {
  safety_bypass: {
    tone: 'danger',
    title: "I can't help with bypassing a safety system.",
  },
  live_event: {
    tone: 'danger',
    title: 'IMMEDIATE ACTION FIRST',
  },
  unverified_numbers: {
    tone: 'warn',
    title: 'Unverified numbers — confirm before acting.',
  },
  missing_safety_banner: {
    tone: 'warn',
    title: 'Safety banner missing — verify with the competent person.',
  },
  domain_lock: {
    tone: 'info',
    title: 'Question outside the oil & gas domain.',
  },
  llm_configuration_error: {
    tone: 'danger',
    title: 'LLM provider is not configured.',
  },
};

export function Message({ message }: { message: MessageType }) {
  if (message.role === 'user') {
    return (
      <article aria-label="Your message" className="ml-auto max-w-[80%] rounded-lg bg-primary-50 px-4 py-3 text-primary-800">
        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-primary-700">
          <span>You</span>
          <Badge tone="neutral">{message.module}</Badge>
          {message.assetContext ? <Badge tone="neutral">asset: {message.assetContext}</Badge> : null}
        </div>
        <p className="whitespace-pre-wrap text-sm text-neutral-800">{message.text}</p>
      </article>
    );
  }
  return <AssistantMessageView message={message} />;
}

function AssistantMessageView({ message }: { message: AssistantMessage }) {
  const safetyToolResult = message.toolResults.find(
    (tr) =>
      isObject(tr.result) &&
      (typeof tr.result['banner'] === 'string' || tr.result['safety_critical'] === true),
  );
  const banners = collectBanners(message, safetyToolResult);
  const isSafetyCritical = Boolean(safetyToolResult);

  return (
    <article
      aria-label="PetroBrain response"
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
        <span>PetroBrain</span>
        {message.streaming ? <Badge tone="info">streaming</Badge> : null}
        {message.error ? <Badge tone="danger">error</Badge> : null}
      </header>

      {banners.map((b) => (
        <Banner key={b.key} tone={b.tone} title={b.title}>
          {b.body}
        </Banner>
      ))}

      {message.text ? (
        <p className="whitespace-pre-wrap text-sm text-neutral-800">{message.text}</p>
      ) : message.streaming ? (
        <p className="text-sm italic text-neutral-500">Working…</p>
      ) : null}

      {message.toolResults.length > 0 ? (
        <section aria-label="Working" className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Working</h3>
          {message.toolResults.map((tr, i) => (
            <WorkingPanel
              key={`${tr.tool}-${i}`}
              tool={tr.tool}
              input={tr.input}
              result={tr.result}
              defaultOpen={isSafetyCritical}
            />
          ))}
        </section>
      ) : null}

      {message.citations.length > 0 ? (
        <section aria-label="Citations" className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Cited:</span>
          {message.citations.map((c, i) => (
            <CitationChip key={`${c.title ?? ''}-${c.clause ?? ''}-${i}`} citation={c} />
          ))}
        </section>
      ) : null}

      {message.error ? (
        <p role="alert" className="text-xs text-danger-fg">
          {message.error}
        </p>
      ) : null}
    </article>
  );
}

interface BannerSpec {
  key: string;
  tone: 'safe' | 'info' | 'warn' | 'danger';
  title: string;
  body: string;
}

function collectBanners(message: AssistantMessage, safetyToolResult: { result: unknown } | undefined): BannerSpec[] {
  const out: BannerSpec[] = [];
  if (safetyToolResult && isObject(safetyToolResult.result) && typeof safetyToolResult.result['banner'] === 'string') {
    out.push({
      key: 'verification',
      tone: 'info',
      title: 'DECISION SUPPORT ONLY',
      body: safetyToolResult.result['banner'] as string,
    });
  }
  for (const flag of message.flags) {
    const spec = FLAG_BANNERS[flag];
    if (!spec) continue;
    out.push({ key: `flag-${flag}`, tone: spec.tone, title: spec.title, body: '' });
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
