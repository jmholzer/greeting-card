import prisma from '@/lib/prisma';
import { MAX_MESSAGES, MESSAGE_ORDER } from '@/lib/config';

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  try {
    const messages = await prisma.message.findMany({
      orderBy: MESSAGE_ORDER,
      take: MAX_MESSAGES,
    });

    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    return new Response('Failed to retrieve messages', {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
    });
  }
}