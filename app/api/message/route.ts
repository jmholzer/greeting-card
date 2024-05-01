import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const messageData = await request.json();



  try {
    if (!messageData.text || !messageData.fontFamily) {
      throw new Error;
    }

    if (messageData.text.length > 100) {
      throw new Error;
    }

    await prisma.message.create({
      data: {
        text: messageData.text,
        fontFamily: messageData.fontFamily,
      },
    });

    return new Response('Message saved successfully', { status: 200 });
  } catch (error) {
    console.error('Error saving message:', error);
    return new Response('Failed to save message', { status: 500 });
  }
}