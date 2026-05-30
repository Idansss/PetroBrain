import Link from 'next/link';

import { Banner, Card } from '@petrobrain/ui';

/**
 * Office app landing. Links to the shipped surfaces: chat (B2), emissions
 * MRV (B4), and document upload (B3).
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-800">PetroBrain — Office</h1>
        <p className="text-sm text-neutral-500">
          Domain-locked oil &amp; gas operations console.
        </p>
      </header>

      <Banner tone="info" title="DECISION SUPPORT ONLY">
        Verify all safety-critical numbers with the competent person before acting.
      </Banner>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link href="/chat" className="block">
          <Card title="Chat" description="Guardrailed domain chat with streaming answers + citations.">
            <span className="text-sm font-medium text-primary-700">Open chat →</span>
          </Card>
        </Link>
        <Link href="/emissions" className="block">
          <Card title="Emissions MRV" description="NUPRC Tier-3 inventory dashboard.">
            <span className="text-sm font-medium text-primary-700">Open MRV →</span>
          </Card>
        </Link>
        <Link href="/admin/documents" className="block">
          <Card title="Documents" description="Upload + track SOP ingestion.">
            <span className="text-sm font-medium text-primary-700">Open documents →</span>
          </Card>
        </Link>
      </section>
    </main>
  );
}
