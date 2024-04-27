import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const messages = await prisma.message.findMany();

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
      },
    });
  }
}