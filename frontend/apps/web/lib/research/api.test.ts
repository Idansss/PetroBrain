import { describe, expect, it } from 'vitest';

import { consumeResearchEvents } from './api';
import type { ResearchEvent } from './types';

function stream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('consumeResearchEvents', () => {
  it('parses progress and completion records split across network chunks', async () => {
    const events: ResearchEvent[] = [];
    await consumeResearchEvents(
      stream([
        'event: step_started\ndata: {"step_id":"step-1","title":"Scope',
        '"}\n\nevent: source_found\ndata: {"title":"NUPRC"}\n\n',
        'event: completed\ndata: {"research_id":"r1"}\n\n',
      ]),
      (event) => events.push(event),
    );

    expect(events.map((event) => event.event)).toEqual([
      'step_started',
      'source_found',
      'completed',
    ]);
    expect(events[0]?.data['title']).toBe('Scope');
  });

  it('ignores malformed event data and keeps parsing', async () => {
    const events: ResearchEvent[] = [];
    await consumeResearchEvents(
      stream([
        'event: warning\ndata: not-json\n\n',
        'event: stopped\ndata: {"status":"stopped"}\n\n',
      ]),
      (event) => events.push(event),
    );
    expect(events).toEqual([{ event: 'stopped', data: { status: 'stopped' } }]);
  });
});
