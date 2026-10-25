import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import styles from '../../page.module.css';
import SignForm from '@/components/SignForm/SignForm';
import { getMessages } from '@/utils/messages';
import { CARD_BACKGROUND_COLOR } from '@/lib/config';

export const dynamic = 'force-dynamic';

// This page is only linked from the card, for the person who wrote the message.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const viewport: Viewport = { interactiveWidget: 'resizes-content' };

interface EditProps {
  params: Promise<{ id: string }>;
}

export default async function Edit({ params }: EditProps) {
  const { id: rawId } = await params;
  if (!/^\d{1,9}$/.test(rawId)) notFound();
  const id = Number(rawId);

  // Only the text and font are read. Whether the browser may change it is decided by the API.
  // Only the text, font and place are shown. Whether the browser may change it is decided by the API.
  const messages = await getMessages();
  const message = messages.find((candidate) => candidate.id === id);
  if (!message) notFound();
  const others = messages.filter((candidate) => candidate.id !== id);

  return (
    <div className={styles.container} style={{ backgroundColor: CARD_BACKGROUND_COLOR }}>
      <SignForm editing={message} messages={others} />
    </div>
  );
}
