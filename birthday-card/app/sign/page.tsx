import { NextRequest } from 'next/server';

import styles from '../page.module.css';
import SignableCardBack from '@/components/SignableCardBack';

import { getMessages } from '@/utils/messages'

export default async function Home(request: NextRequest) {
  const messages = await getMessages();

  return (
    <div className={styles.container}>
      <SignableCardBack messages={messages} />
    </div>
  );
}