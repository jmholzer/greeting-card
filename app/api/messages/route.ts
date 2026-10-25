import { getMessages } from '@/utils/messages';

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  try {
    const messages = await getMessages();

    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    return Response.json(
      { error: 'server_error', message: 'Failed to retrieve messages' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}