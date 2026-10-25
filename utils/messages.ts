import prisma from '@/lib/prisma';
import { MAX_MESSAGES, MESSAGE_ORDER } from '@/lib/config';

export interface Message {
  id: number;
  text: string;
  fontFamily: string;
  createdAt: string;
  updatedAt: string;
}

/** Reads the card's messages straight from the database. Throws if the database is unreachable. */
export async function getMessages(): Promise<Message[]> {
  const rows = await prisma.message.findMany({
    orderBy: MESSAGE_ORDER,
    take: MAX_MESSAGES,
  });

  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    fontFamily: row.fontFamily,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}
