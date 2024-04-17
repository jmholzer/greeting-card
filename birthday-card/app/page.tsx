import styles from './page.module.css';

import Envelope from '@/components/Envelope'

export default function Home() {

  return (
    <div className={styles.container}>
      <Envelope />
    </div>
  );
}