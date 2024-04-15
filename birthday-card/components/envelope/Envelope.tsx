'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import styles from './envelope.module.css';

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const envelopeAnimation = isOpen ? {
    opacity: 0, y: 400, scale: 1.25, transition: { delay: 0.6, duration: 0.6, ease: [0.175, 0.885, 0.32, 1] }
  } : {}

  return (
    <div className={styles.container}>
      <AnimatePresence>
        <div className={styles.envelopeContainer}>
          <motion.div
            key="envelopeBack"
            id="envelopeBack"
            className={styles.envelopeBack}
            initial={{ y: 0, scale: 1 }}
            animate={envelopeAnimation}
            onClick={toggleOpen}
            style={{ zIndex: 1 }}
          />
          <motion.div
            className={styles.card}
            initial={{ y: 0 }}
            animate={isOpen ? { transition: { delay: 0.2, duration: 0.6, ease: [0.175, 0.885, 0.32, 1] } } : {}}
            style={{ zIndex: 2 }}
          >
            <motion.div
              className={styles.inner}
              initial={{ rotate: 0, scale: 1 }}
              animate={isOpen ? { rotate: -90, scale: 1.15, transition: { delay: 0.4, duration: 0.3, ease: [0.175, 0.885, 0.32, 1] } } : {}}
            />
          </motion.div>
          <motion.div
            key="envelopeFront"
            id="envelopeFront"
            className={styles.envelopeFront}
            initial={{ y: 0, scale: 1 }}
            onClick={toggleOpen}
            animate={envelopeAnimation}
            style={{ zIndex: 3 }}
          />

        </div>
      </AnimatePresence>
    </div>
  );
}