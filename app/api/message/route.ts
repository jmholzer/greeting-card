import prisma from '@/lib/prisma';
import { MAX_MESSAGES } from '@/lib/config';

// Arbitrary constant key for a Postgres advisory lock that serialises message
// creation, so concurrent requests cannot push the card past MAX_MESSAGES.
const CREATE_MESSAGE_LOCK_ID = 4242001;

class CardFullError extends Error {}

export async function POST(request: Request) {
  const messageData = await request.json();

  try {
    if (!messageData.text || !messageData.fontFamily) {
      throw new Error;
    }

    if (messageData.text.length > 100) {
      throw new Error;
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CREATE_MESSAGE_LOCK_ID})`;

      const count = await tx.message.count();
      if (count >= MAX_MESSAGES) {
        throw new CardFullError();
      }

      await tx.message.create({
        data: {
          text: messageData.text,
          fontFamily: messageData.fontFamily,
        },
      });
    });

    return new Response('Message saved successfully', { status: 200 });
  } catch (error) {
    if (error instanceof CardFullError) {
      return Response.json(
        { error: 'card_full', message: 'The card is full and cannot accept any more messages.' },
        { status: 409 },
      );
    }
    console.error('Error saving message:', error);
    return new Response('Failed to save message', { status: 500 });
  }
}
