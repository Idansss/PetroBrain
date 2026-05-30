import type { Message as MessageType } from '@/lib/chat/types';

import { Message } from './Message';

export function MessageList({ messages }: { messages: MessageType[] }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
    </div>
  );
}
