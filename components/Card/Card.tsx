'use client';

import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import React, { useEffect } from 'react';
import Image from 'next/image';
import { AutoTextSize } from 'auto-text-size';
import styles from './styles.module.css';

import type { Message } from '@/utils/messages';
import { FLIP_PREVIEW_DEGREES } from '@/components/Card/flipDrag';
import { assignGridCells } from '@/utils/grid';
import { CARD_FRONT_SRC } from '@/lib/config';

import { fontFamilyMap } from '@/app/fonts';

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

const gridRows = 4;
const gridCols = 4;

export default function Card({ messages, isFlipped, pull, reduceMotion, highlightId = null }: CardProps) {
  messages = messages.slice(0, gridRows * gridCols);
  const messageCells = assignGridCells(messages.map((message) => message.id), gridRows, gridCols);

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
          {messages.map((message) => {
            const fontClassName = fontFamilyMap[message.fontFamily] || '';
            const cell = messageCells.get(message.id);
            if (!cell) return null;
            return (
              <div
                key={message.id}
                data-message-id={message.id}
                className={`${styles.message} ${fontClassName} ${
                  message.id === highlightId ? `${styles.highlight} ${styles.highlightPulse}` : ''
                }`}
                style={{
                  gridRow: `${cell[0] + 1} / span 1`,
                  gridColumn: `${cell[1] + 1} / span 1`,
                }}
              >
                <AutoTextSize mode="box" minFontSizePx={0.1}>
                  {message.text}
                </AutoTextSize>
              </div>
            );
          })}
        </div>
        <div className={styles.paper} />
      </motion.div>
    </motion.div>
  );
}
