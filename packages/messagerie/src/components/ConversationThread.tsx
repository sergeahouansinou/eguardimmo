'use client';

import { useEffect, useRef } from 'react';
import type { Attachment, Message, Participant } from '../data/schemas';
import { MessageBubble } from './MessageBubble';

export interface ConversationThreadProps {
  messages: Message[];
  participants: Participant[];
  viewerId: string;
  label?: string;
  onOpenAttachment?: (attachment: Attachment) => void;
}

export function ConversationThread({ messages, participants, viewerId, label = 'Fil de la conversation', onOpenAttachment }: ConversationThreadProps) {
  const endRef = useRef<HTMLLIElement>(null);
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lastId]);

  return (
    <ol aria-label={label} className="flex min-w-0 flex-col gap-3">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          author={participants.find((participant) => participant.id === message.authorId)}
          own={message.authorId === viewerId}
          {...(onOpenAttachment ? { onOpenAttachment } : {})}
        />
      ))}
      <li ref={endRef} aria-hidden="true" className="h-0" />
    </ol>
  );
}
