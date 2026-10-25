import styles from './page.module.css';

import Envelope from '@/components/Card/EnvelopedCard'
import { getMessages } from '@/utils/messages'
import type { Message } from '@/utils/messages'
import { CARD_BACKGROUND_COLOR } from '@/lib/config'

export const dynamic = 'force-dynamic'

interface HomeProps {
  searchParams: Promise<{ signed?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  let messages: Message[];
  try {
    messages = await getMessages();
  } catch (error) {
    console.error('Error loading messages:', error);
    return (
      <div className={styles.container} style={{ backgroundColor: CARD_BACKGROUND_COLOR }}>
        <div className={styles.loadError} role="alert">
          <p>The card could not be loaded.</p>
          {/* A full reload, not a client navigation, so the database is queried again. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Try again</a>
        </div>
      </div>
    );
  }

  // Set by the sign form's "See your message" link: open the card on that message.
  const { signed } = await searchParams;
  const signedId = typeof signed === 'string' && /^\d{1,9}$/.test(signed) ? Number(signed) : null;
  const highlightId =
    signedId !== null && messages.some((message) => message.id === signedId) ? signedId : null;

  return (
    <div className={styles.container} style={{ backgroundColor: CARD_BACKGROUND_COLOR }}>
      <Envelope messages={messages} highlightId={highlightId} />
    </div>
  );
}
