import { describe, expect, it } from 'vitest';

import { consumeSse, type StreamEvent } from './streamChat.js';

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('consumeSse', () => {
  it('parses one event per record', async () => {
    const stream = makeStream([
      'event: token\ndata: {"text":"hello"}\n\n',
      'event: done\ndata: {"answer":"hi","tool_results":[],"flags":[],"audit":{}}\n\n',
    ]);

    const out: StreamEvent[] = [];
    await consumeSse(stream, (e) => out.push(e));

    expect(out.map((e) => e.event)).toEqual(['token', 'done']);
    expect(out[0]).toEqual({ event: 'token', data: { text: 'hello' } });
  });

  it('handles records split across chunks', async () => {
    // The token record is split mid-data; the parser must wait for the blank line.
    const stream = makeStream([
      'event: tok',
      'en\ndata: {"text":"par',
      't1"}\n\nevent: token\ndata: ',
      '{"text":"part2"}\n\n',
    ]);
    const out: StreamEvent[] = [];
    await consumeSse(stream, (e) => out.push(e));
    expect(out).toEqual([
      { event: 'token', data: { text: 'part1' } },
      { event: 'token', data: { text: 'part2' } },
    ]);
  });

  it('parses tool_call, tool_result, citation, flag, done in order', async () => {
    const records = [
      'event: tool_call\ndata: {"tool":"build_kill_sheet","id":"t1","input":{"tvd_ft":10000}}',
      'event: tool_result\ndata: {"tool":"build_kill_sheet","result":{"kill_mud_weight_ppg":10.37}}',
      'event: citation\ndata: {"title":"Kick SOP","revision":"Rev 1","clause":"2.1"}',
      'event: flag\ndata: {"flag":"missing_safety_banner"}',
      'event: done\ndata: {"answer":"ok","tool_results":[],"flags":[],"audit":{}}',
    ];
    const stream = makeStream([records.join('\n\n') + '\n\n']);
    const out: StreamEvent[] = [];
    await consumeSse(stream, (e) => out.push(e));
    expect(out.map((e) => e.event)).toEqual([
      'tool_call',
      'tool_result',
      'citation',
      'flag',
      'done',
    ]);
  });

  it('ignores malformed records without throwing', async () => {
    const stream = makeStream(['event: token\ndata: not-json\n\n', 'event: token\ndata: {"text":"ok"}\n\n']);
    const out: StreamEvent[] = [];
    await consumeSse(stream, (e) => out.push(e));
    expect(out).toEqual([{ event: 'token', data: { text: 'ok' } }]);
  });
});
