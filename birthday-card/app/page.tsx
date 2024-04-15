import styles from './page.module.css';

import Envelope from '@/components/envelope/Envelope'

export default function Home() {

  return (
    <div className={styles.container}>
      <Envelope />
    </div>
  );
}