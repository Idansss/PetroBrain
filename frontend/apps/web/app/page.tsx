import { Banner, Button, Card } from '@petrobrain/ui';

/**
 * B1 placeholder home. B2 wires the chat shell; this page exists so the
 * scaffold builds and a smoke test of the design system can be eyeballed.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-neutral-800">PetroBrain — Office</h1>
        <p className="text-sm text-neutral-500">
          Scaffold only. Chat, MRV dashboard, and document upload land in B2–B4.
        </p>
      </header>

      <Banner tone="info" title="DECISION SUPPORT ONLY">
        Verify all kill-sheet numbers with the competent person before acting.
      </Banner>

      <Card title="Next step" description="Wire chat with streaming + citations (B2).">
        <Button variant="primary">Open chat (B2)</Button>
      </Card>
    </main>
  );
}
