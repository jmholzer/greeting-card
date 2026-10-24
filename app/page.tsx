import styles from './page.module.css';

import Envelope from '@/components/Card/EnvelopedCard'
import { getMessages } from '@/utils/messages'
import { CARD_BACKGROUND_COLOR } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const messages = await getMessages();

  return (
    <div className={styles.container} style={{ backgroundColor: CARD_BACKGROUND_COLOR }}>
      <Envelope messages={messages} />
    </div>
  );
}