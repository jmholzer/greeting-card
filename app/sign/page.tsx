import type { Viewport } from 'next';
import styles from '../page.module.css';
import SignForm from '@/components/SignForm/SignForm';
import { CARD_BACKGROUND_COLOR } from '@/lib/config';
import { hasRoomForMinimumBox } from '@/lib/geometry';
import { getMessages } from '@/utils/messages';
import type { Message } from '@/utils/messages';

export const dynamic = 'force-dynamic';

// Android Chrome then resizes the page for the on-screen keyboard, so the form stays visible.
export const viewport: Viewport = { interactiveWidget: 'resizes-content' };

export default async function Home() {
  let messages: Message[];
  try {
    messages = await getMessages();
  } catch (error) {
    // Placing a message needs to know what is already on the card, so there is nothing to show without it.
    console.error('Error loading messages:', error);
    return (
      <div className={styles.container} style={{ backgroundColor: CARD_BACKGROUND_COLOR }}>
        <div className={styles.loadError} role="alert">
          <p>The card could not be loaded.</p>
          {/* A full reload, not a client navigation, so the database is queried again. */}
          <a href="/sign">Try again</a>
        </div>
      </div>
    );
  }

  const isFull = !hasRoomForMinimumBox(messages.map((message) => message.box));

  return (
    <div className={styles.container} style={{ backgroundColor: CARD_BACKGROUND_COLOR }}>
      <SignForm isFull={isFull} messages={messages} />
    </div>
  );
}
