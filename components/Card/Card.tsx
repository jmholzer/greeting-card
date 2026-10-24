'use client';

import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import React, { useEffect } from 'react';
import Image from 'next/image';
import { AutoTextSize } from 'auto-text-size';
import styles from './styles.module.css';

import { Message } from '@/utils/messages';
import { assignGridCells } from '@/utils/grid';
import { CARD_FRONT_SRC } from '@/lib/config';

import { fontFamilyMap } from '@/app/fonts';

interface CardProps {
  messages: Message[];
  isFlipped: boolean;
  /** Live horizontal drag offset in px, used to preview the flip while swiping. */
  dragX: MotionValue<number>;
  reduceMotion: boolean;
}

const spring = {
  type: 'spring' as const,
  stiffness: 170,
  damping: 24,
};

const gridRows = 4;
const gridCols = 4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function Card({ messages, isFlipped, dragX, reduceMotion }: CardProps) {
  messages = messages.slice(0, gridRows * gridCols);
  const messageCells = assignGridCells(messages.map((message) => message.id), gridRows, gridCols);

  const angle = useMotionValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(angle, isFlipped ? -180 : 0, spring);
    return () => controls.stop();
  }, [isFlipped, reduceMotion, angle]);

  const rotateY = useTransform([angle, dragX], ([base, drag]: number[]) =>
    reduceMotion ? 0 : base + clamp(drag * 0.3, -30, 30),
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
        <div className={styles.fold} />
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
                className={`${styles.message} ${fontClassName}`}
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
        <div className={styles.fold} />
        <div className={styles.paper} />
      </motion.div>
    </motion.div>
  );
}
