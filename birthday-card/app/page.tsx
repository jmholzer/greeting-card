import styles from './page.module.css';

import Envelope from '@/components/EnvelopedCard'
import { getMessages } from '@/utils/messages'

export default async function Home() {
  const messages = await getMessages();

  return (
    <div className={styles.container}>
      <Envelope messages={messages} />
    </div>
  );
}