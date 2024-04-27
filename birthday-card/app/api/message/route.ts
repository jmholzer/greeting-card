import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const messageData = await request.json();
  console.log(messageData);

  try {
    const newMessage = await prisma.message.create({
      data: {
        text: messageData.text,
        fontSize: messageData.fontSize,
        fontFamily: messageData.fontFamily,
        positionX: messageData.position.x,
        positionY: messageData.position.y,
        width: messageData.position.width,
        height: messageData.position.height,
      },
    });

    console.log('New message created:', newMessage);

    return new Response('Message saved successfully', { status: 200 });
  } catch (error) {
    console.error('Error saving message:', error);
    return new Response('Failed to save message', { status: 500 });
  }
}