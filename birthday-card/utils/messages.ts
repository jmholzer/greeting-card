export interface Message {
  id: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export async function getMessages(): Promise<Message[]> {
  console.log
  try {
    const response = await fetch(`${process.env.HOST}/api/messages`, { cache: 'no-store' });
    const data = await response.json();
    return data;
  } catch (error) {
    // TODO: probably shouldn't return no messages to someone in any case
    console.error(error)
    return [];
  }
}
