'use client';

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useRef, useState } from 'react';
import styles from './styles.module.css';

import Card from '@/components/Card/Card';
import { useDeviceTilt, useGesture } from '@/components/Card/hooks';
import { Message } from '@/utils/messages';

interface EnvelopedCardProps {
  messages: Message[];
}

// sealed: flap closed. open: flap up, card peeking. out: card taken out, envelope gone.
type Stage = 'sealed' | 'open' | 'out';

const HINTS: Record<Stage, string> = {
  sealed: 'Tap or swipe up to open the envelope',
  open: 'Swipe the card up, or tap it',
  out: 'Tap or swipe to open the card',
};

const pullSpring = { stiffness: 260, damping: 28 };

export default function EnvelopedCard({ messages }: EnvelopedCardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [stage, setStage] = useState<Stage>('sealed');
  const [isFlipped, setIsFlipped] = useState(false);
  const controllerRef = useRef<HTMLDivElement>(null);

  const pullY = useMotionValue(0);
  const dragX = useMotionValue(0);
  const pullYSmooth = useSpring(pullY, pullSpring);
  const dragXSmooth = useSpring(dragX, pullSpring);
  const { tiltX, tiltY, requestPermission } = useDeviceTilt(!reduceMotion);

  const shadowX = useTransform([tiltY, dragXSmooth], ([ty, dx]: number[]) => -ty * 1.5 - dx * 0.06);
  const shadowY = useTransform(
    [tiltX, pullYSmooth],
    ([tx, py]: number[]) => 10 + tx * 1.5 + Math.max(0, -py) * 0.08,
  );
  const shadowBlur = useTransform(pullYSmooth, (py) => 14 + Math.min(40, Math.abs(py) * 0.12));
  const filter = useMotionTemplate`drop-shadow(${shadowX}px ${shadowY}px ${shadowBlur}px rgba(60, 35, 10, 0.34))`;
  const shiftX = useTransform(dragXSmooth, (dx) => dx * 0.12);
  const tilt = useTransform(dragXSmooth, (dx) => dx * 0.01);

  const vibrate = (ms: number) => {
    if (!reduceMotion && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  };

  const advance = () => {
    void requestPermission();
    if (stage === 'sealed') {
      vibrate(8);
      setStage('open');
    } else if (stage === 'open') {
      pullY.set(0);
      setStage('out');
    } else {
      if (!isFlipped) vibrate(15);
      setIsFlipped((flipped) => !flipped);
    }
  };

  const height = () => controllerRef.current?.getBoundingClientRect().height ?? 300;

  const gesture = useGesture({
    onTap: advance,
    onKey: (key) => {
      if (key === 'ArrowUp' && stage !== 'out') {
        advance();
        return true;
      }
      if ((key === 'ArrowLeft' || key === 'ArrowRight') && stage === 'out') {
        advance();
        return true;
      }
      return false;
    },
    onMove: (dx, dy) => {
      if (reduceMotion) return;
      if (stage === 'open') pullY.set(Math.max(-height() * 0.7, Math.min(0, dy) * 0.9));
      if (stage === 'out') dragX.set(dx);
    },
    onEnd: (dx, dy, vx, vy) => {
      void requestPermission();
      if (stage === 'sealed') {
        if (dy < -24 || vy < -500) advance();
      } else if (stage === 'open') {
        if (dy < -height() * 0.15 || vy < -600) advance();
        else pullY.set(0);
      } else if (Math.max(Math.abs(dx), Math.abs(dy)) > 50 || Math.max(Math.abs(vx), Math.abs(vy)) > 500) {
        advance();
      }
      dragX.set(0);
    },
  });

  const away = stage === 'out';
  const flapOpen = stage !== 'sealed';

  const dropAnimation = reduceMotion
    ? { opacity: away ? 0 : 1, transition: { duration: 0.3 } }
    : {
        y: away ? '135%' : '0%',
        opacity: away ? 0 : 1,
        transition: {
          y: { type: 'spring' as const, stiffness: 90, damping: 18 },
          opacity: { delay: away ? 0.6 : 0, duration: 0.3 },
        },
      };

  const flapAnimation = reduceMotion
    ? { opacity: flapOpen ? 0 : 1, transition: { duration: 0.25 } }
    : {
        rotateX: flapOpen ? 180 : 0,
        y: dropAnimation.y,
        opacity: flapOpen ? 0 : 1,
        transition: {
          rotateX: { type: 'spring' as const, stiffness: 150, damping: 20 },
          y: dropAnimation.transition.y,
          opacity: { delay: flapOpen ? 0.3 : 0, duration: 0.35 },
        },
      };

  const cardLayerAnimation = reduceMotion
    ? { opacity: stage === 'sealed' ? 0 : 1, transition: { duration: 0.25 } }
    : {
        opacity: stage === 'sealed' ? 0 : 1,
        y: stage === 'open' ? '-14%' : '0%',
        transition: {
          opacity: { delay: stage === 'open' ? 0.2 : 0, duration: 0.15 },
          y: { type: 'spring' as const, stiffness: 120, damping: 18, delay: stage === 'open' ? 0.15 : 0 },
        },
      };

  const label =
    stage === 'sealed'
      ? 'Open the envelope'
      : stage === 'open'
        ? 'Take the card out of the envelope'
        : isFlipped
          ? 'Close the card'
          : 'Open the card';
  const hint = stage === 'out' && isFlipped ? 'Tap or swipe to close the card' : HINTS[stage];

  return (
    <div className={styles.envelopeContainer}>
      <motion.div
        className={styles.envelopeBack}
        initial={false}
        animate={dropAnimation}
        aria-hidden
      />

      <motion.div
        className={styles.cardLayer}
        initial={false}
        animate={cardLayerAnimation}
      >
        <motion.div
          className={styles.cardTilt}
          style={{
            y: pullYSmooth,
            x: shiftX,
            rotateX: reduceMotion ? 0 : tiltX,
            rotateY: reduceMotion ? 0 : tiltY,
            rotateZ: reduceMotion ? 0 : tilt,
            filter: reduceMotion ? 'drop-shadow(0 10px 18px rgba(60, 35, 10, 0.3))' : filter,
            transformPerspective: 1200,
          }}
        >
          <Card
            messages={messages}
            isFlipped={isFlipped}
            dragX={dragXSmooth}
            reduceMotion={reduceMotion}
          />
        </motion.div>
      </motion.div>

      <motion.div
        className={styles.flap}
        initial={false}
        animate={flapAnimation}
        style={{ transformPerspective: 1400 }}
        aria-hidden
      >
        <div className={`${styles.flapFace} ${styles.flapOutside}`}>
          <svg viewBox="0 0 100 56" preserveAspectRatio="none" className={styles.lines}>
            <polyline points="0,0 50,56 100,0" />
          </svg>
          <div className={styles.paper} />
        </div>
        <div className={`${styles.flapFace} ${styles.flapInside}`} />
      </motion.div>

      <motion.div
        className={styles.pocketShadow}
        initial={false}
        animate={dropAnimation}
        aria-hidden
      >
        <div className={styles.pocket}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.lines}>
            <polyline points="0,100 50,56" />
            <polyline points="100,100 50,56" />
          </svg>
          <div className={styles.paper} />
        </div>
      </motion.div>

      <div
        ref={controllerRef}
        className={styles.controller}
        role="button"
        tabIndex={0}
        aria-label={label}
        {...gesture}
      />

      <p className={styles.hint} aria-live="polite">
        {hint}
      </p>
    </div>
  );
}
