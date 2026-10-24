import styles from './page.module.css';

import Envelope from '@/components/Card/EnvelopedCard'
import { getMessages } from '@/utils/messages'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const messages = await getMessages();

  return (
    <div className={styles.container}>
      <Envelope messages={messages} />
    </div>
  );
}