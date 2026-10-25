'use client';

import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import React, { useEffect } from 'react';
import Image from 'next/image';
import styles from './styles.module.css';

import type { Message } from '@/utils/messages';
import MessageBox from '@/components/Card/MessageBox';
import { FLIP_PREVIEW_DEGREES } from '@/components/Card/flipDrag';
import { CARD_FRONT_SRC } from '@/lib/config';

interface CardProps {
  messages: Message[];
  isFlipped: boolean;
  /** Live drag progress, signed, where 1 is the distance that flips the card. Previews the flip. */
  pull: MotionValue<number>;
  reduceMotion: boolean;
  /** Id of a message to draw attention to, e.g. the one the visitor just wrote. */
  highlightId?: number | null;
}

const spring = {
  type: 'spring' as const,
  stiffness: 170,
  damping: 24,
};

export default function Card({ messages, isFlipped, pull, reduceMotion, highlightId = null }: CardProps) {
  const angle = useMotionValue(isFlipped ? -180 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(angle, isFlipped ? -180 : 0, spring);
    return () => controls.stop();
  }, [isFlipped, reduceMotion, angle]);

  const rotateY = useTransform([angle, pull], ([base, drag]: number[]) =>
    reduceMotion ? 0 : base + drag * FLIP_PREVIEW_DEGREES,
  );

  const fade = { duration: 0.25 };

  return (
    <motion.div className={styles.card} style={{ rotateY }}>
      <motion.div
        className={`${styles.face} ${styles.cover}`}
        aria-hidden={isFlipped}
        initial={false}
        animate={{ opacity: reduceMotion && isFlipped ? 0 : 1 }}
        transition={fade}
      >
        <Image
          src={CARD_FRONT_SRC}
          alt="Card front"
          className={styles.coverImage}
          fill
          preload
        />
        <div className={styles.paper} />
      </motion.div>

      <motion.div
        className={`${styles.face} ${styles.inside}`}
        aria-hidden={!isFlipped}
        initial={false}
        animate={{ opacity: reduceMotion && !isFlipped ? 0 : 1 }}
        style={{ rotateY: reduceMotion ? 0 : 180 }}
        transition={fade}
      >
        <div className={styles.messages}>
          {messages.map((message) => (
            <MessageBox
              key={message.id}
              messageId={message.id}
              text={message.text}
              fontFamily={message.fontFamily}
              box={message.box}
              className={message.id === highlightId ? `${styles.highlight} ${styles.highlightPulse}` : ''}
            />
          ))}
        </div>
        <div className={styles.paper} />
      </motion.div>
    </motion.div>
  );
}
