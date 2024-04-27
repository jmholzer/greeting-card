
import styles from '../page.module.css';
import SignableCardBack from '@/components/SignableCardBack';

import { getMessages } from '@/utils/messages'

export default async function Home() {
  const messages = await getMessages();

  return (
    <div className={styles.container}>
      <SignableCardBack messages={messages} />
    </div>
  );
}