import type { Viewport } from 'next';
import styles from '../page.module.css';
import SignForm from '@/components/SignForm/SignForm';
import prisma from '@/lib/prisma';
import { CARD_BACKGROUND_COLOR, MAX_MESSAGES } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Android Chrome then resizes the page for the on-screen keyboard, so the form stays visible.
export const viewport: Viewport = { interactiveWidget: 'resizes-content' };

async function isCardFull(): Promise<boolean> {
  try {
    return (await prisma.message.count()) >= MAX_MESSAGES;
  } catch (error) {
    // The API enforces the limit regardless, so fail open here.
    console.error('Error counting messages:', error);
    return false;
  }
}

export default async function Home() {
  const isFull = await isCardFull();

  return (
    <div className={styles.container} style={{ backgroundColor: CARD_BACKGROUND_COLOR }}>
      <SignForm isFull={isFull} />
    </div>
  );
}
