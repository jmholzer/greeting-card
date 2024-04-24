import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  const messageData = await request.json();
  console.log(messageData);

  try {
    // Create a new message in the database using Prisma
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

    // Send a response back to the client
    return new Response('Message saved successfully', { status: 200 });
  } catch (error) {
    console.error('Error saving message:', error);
    // Send an error response back to the client
    return new Response('Failed to save message', { status: 500 });
  }
}