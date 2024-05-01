'use client';
import { motion, easeIn, reverseEasing } from 'framer-motion';
import { useState } from 'react';
import styles from './styles.module.css';

import Card from '@/components/Card/Card'
import { Message } from '@/utils/messages';

interface EnvelopedCardProps {
  messages: Message[];
}

export default function EnvelopedCard({ messages }: EnvelopedCardProps) {
  const [runAnimation, setRunAnimation] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const envelopeAnimation = runAnimation
    ? {
      y: "200%",
      transition: {
        delay: 0.2,
        duration: 1.8,
        ease: reverseEasing(easeIn)
      },
    }
    : {};

  return (
    <div className={styles.envelopeContainer}>
      <motion.div
        key="envelopeBack"
        id="envelopeBack"
        className={styles.envelopeBack}
        initial={{ y: 0, scale: 1 }}
        animate={envelopeAnimation}
        style={{ zIndex: 1 }}

      />
      <Card isEnvelopeOpen={isOpen} messages={messages} />
      <motion.div
        key="envelopeFront"
        id="envelopeFront"
        className={styles.envelopeFront}
        initial={{ y: 0, scale: 1 }}
        animate={envelopeAnimation}
        style={{ zIndex: 3 }}
        onClick={() => setRunAnimation(true)}
        onAnimationComplete={() => setIsOpen(true)}
      />
    </div>
  );
}