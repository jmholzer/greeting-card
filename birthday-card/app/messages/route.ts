import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Retrieve all messages from the database using Prisma
    const messages = await prisma.message.findMany();

    console.log('Retrieved messages:', messages);

    // Send the messages as a response
    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    // Send an error response if unable to retrieve messages
    return new Response('Failed to retrieve messages', {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}