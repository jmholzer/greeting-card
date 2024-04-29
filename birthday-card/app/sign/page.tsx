import styles from '../page.module.css';
import SignForm from '@/components/SignForm/SignForm';

export default async function Home() {
  return (
    <div className={styles.container}>
      <SignForm />
    </div>
  );
}