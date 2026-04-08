import { eq, and, desc, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { chatMessages } from '../../db/schema';

export type ChatMessageType = 'normal' | 'whisper' | 'system' | 'emote';

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string | null;
  content: string;
  type: ChatMessageType;
  createdAt: Date;
}

/**
 * Send a message (global or whisper)
 */
export async function sendMessage(
  db: any,
  senderId: string,
  content: string,
  type: ChatMessageType = 'normal',
  recipientId?: string,
): Promise<ChatMessage> {
  const id = randomUUID();
  const now = new Date();

  await db.insert(chatMessages).values({
    id,
    senderId,
    recipientId: recipientId || null,
    content,
    type,
    createdAt: now,
  });

  return { id, senderId, recipientId: recipientId || null, content, type, createdAt: now };
}

/**
 * Get recent global messages
 */
export async function getMessages(
  db: any,
  limit: number = 50,
  offset: number = 0,
): Promise<ChatMessage[]> {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(and(
      isNull(chatMessages.recipientId),
      eq(chatMessages.type, 'normal'),
    ))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit)
    .offset(offset);

  return messages.reverse();
}

/**
 * Get whisper thread between two users
 */
export async function getWhispers(
  db: any,
  userId1: string,
  userId2: string,
  limit: number = 50,
): Promise<ChatMessage[]> {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(
      eq(chatMessages.type, 'whisper'),
      // Either (sender=userId1 AND recipient=userId2) OR (sender=userId2 AND recipient=userId1)
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  // Filter manually since Drizzle doesn't have great OR support here
  return messages
    .filter(
      (m: ChatMessage) =>
        (m.senderId === userId1 && m.recipientId === userId2) ||
        (m.senderId === userId2 && m.recipientId === userId1),
    )
    .reverse();
}
