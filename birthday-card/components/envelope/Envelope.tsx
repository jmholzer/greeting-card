'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import styles from './envelope.module.css';

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const envelopeAnimation = isOpen
    ? {
      opacity: [1, 1, 0],
      y: [0, 400, 400],
      transition: {
        delay: 0.2,
        duration: 5,
        ease: [0.175, 0.885, 0.32, 1],
      },
    }
    : {};

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
            animate={
              isOpen
                ? {
                  transition: {
                    delay: 0.2,
                    duration: 0.6,
                    ease: [0.175, 0.885, 0.32, 1],
                  },
                }
                : {}
            }
            style={{ zIndex: 2 }}
          />
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