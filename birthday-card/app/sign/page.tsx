
import styles from '../page.module.css';

import SignableCardBack from '@/components/SignableCardBack'

export default function Home() {

  return (
    <div className={styles.container}>
      <SignableCardBack />
    </div>
  );
}