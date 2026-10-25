'use client';

import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './styles.module.css';

import Card from '@/components/Card/Card';
import { useDeviceTilt, useGesture } from '@/components/Card/hooks';
import { useHints } from '@/components/Card/useHints';
import type { HintStep } from '@/components/Card/useHints';
import { fontFamilyMap } from '@/app/fonts';
import { Message } from '@/utils/messages';

interface EnvelopedCardProps {
  messages: Message[];
  /** When set, the card opens straight to the messages with this one highlighted. */
  highlightId?: number | null;
}

// sealed: flap closed. open: flap up, card peeking. out: card taken out, envelope gone.
type Stage = 'sealed' | 'open' | 'out';

const STEP_FOR_STAGE: Record<Stage, HintStep> = {
  sealed: 'openEnvelope',
  open: 'takeOut',
  out: 'openCard',
};

const HINT_TEXT: Record<HintStep, string> = {
  openEnvelope: 'Tap or swipe up to open the envelope',
  takeOut: 'Swipe the card up, or tap it',
  openCard: 'Tap or swipe to open the card',
};

// A hint only appears after the visitor has been idle on a step for this long.
const HINT_IDLE_MS = 2000;

const pullSpring = { stiffness: 260, damping: 28 };

// A message cell narrower than this (in px) is too small to read, so tapping it enlarges it.
// It depends on the card's size, not the screen width, so landscape phones work too.
const ENLARGE_BELOW_CELL_WIDTH = 120;

export default function EnvelopedCard({ messages, highlightId = null }: EnvelopedCardProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const highlighted = highlightId !== null;
  const [stage, setStage] = useState<Stage>(highlighted ? 'out' : 'sealed');
  const [isFlipped, setIsFlipped] = useState(highlighted);
  const [enlargedId, setEnlargedId] = useState<number | null>(null);
  const controllerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The shortcut is for the person who just signed. A reload shows the normal envelope.
    if (highlighted) window.history.replaceState(null, '', window.location.pathname);
  }, [highlighted]);

  const pullY = useMotionValue(0);
  const dragX = useMotionValue(0);
  const pullYSmooth = useSpring(pullY, pullSpring);
  const dragXSmooth = useSpring(dragX, pullSpring);
  const { tiltX: sensorTiltX, tiltY: sensorTiltY, requestPermission } = useDeviceTilt(!reduceMotion);

  // The card is only free to tilt, drag and flip once the envelope has finished
  // dropping away, so it can never rotate while part of it is still inside.
  const [settledStage, setSettledStage] = useState<Stage | null>(highlighted ? 'out' : null);
  const clear = stage === 'out' && settledStage === 'out';
  const tiltAmount = useMotionValue(0);
  const tiltAmountSmooth = useSpring(tiltAmount, { stiffness: 40, damping: 14 });
  useEffect(() => {
    if (clear) {
      tiltAmount.set(1);
    } else {
      tiltAmount.set(0);
      tiltAmountSmooth.jump(0);
    }
  }, [clear, tiltAmount, tiltAmountSmooth]);
  const tiltX = useTransform([sensorTiltX, tiltAmountSmooth], ([t, a]: number[]) => t * a);
  const tiltY = useTransform([sensorTiltY, tiltAmountSmooth], ([t, a]: number[]) => t * a);

  const { ready: hintsReady, isDone, markDone } = useHints();
  const step = STEP_FOR_STAGE[stage];
  const hintPending = hintsReady && !highlighted && !isDone(step);
  const [idleStep, setIdleStep] = useState<HintStep | null>(null);
  useEffect(() => {
    if (!hintPending) return;
    const timer = setTimeout(() => setIdleStep(step), HINT_IDLE_MS);
    return () => clearTimeout(timer);
  }, [hintPending, step]);
  const showHint = hintPending && idleStep === step;

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
    if (stage === 'out' && !clear) return;
    if (!highlighted) markDone(step);
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

  const enlargedMessage =
    enlargedId === null ? undefined : messages.find((message) => message.id === enlargedId);
  const closeEnlarged = useCallback(() => {
    setEnlargedId(null);
    controllerRef.current?.focus({ preventScroll: true });
  }, []);

  const handleTap = (point?: { x: number; y: number }) => {
    if (enlargedId !== null) return;
    if (clear && isFlipped && point) {
      const cell = [...document.querySelectorAll<HTMLElement>('[data-message-id]')].find((el) => {
        const rect = el.getBoundingClientRect();
        return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
      });
      if (cell && cell.getBoundingClientRect().width < ENLARGE_BELOW_CELL_WIDTH) {
        setEnlargedId(Number(cell.dataset.messageId));
        return;
      }
    }
    advance();
  };

  const gesture = useGesture({
    onTap: handleTap,
    onKey: (key) => {
      if (enlargedId !== null) return false;
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
      if (clear) dragX.set(dx);
    },
    onEnd: (dx, dy, vx, vy) => {
      void requestPermission();
      if (stage === 'sealed') {
        if (dy < -24 || vy < -500) advance();
      } else if (stage === 'open') {
        if (dy < -height() * 0.15 || vy < -600) advance();
        else pullY.set(0);
      } else if (clear && Math.max(Math.abs(dx), Math.abs(dy)) > 50 || Math.max(Math.abs(vx), Math.abs(vy)) > 500) {
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

  return (
    <div className={styles.envelopeContainer}>
      <motion.div
        className={styles.envelopeBack}
        initial={false}
        animate={dropAnimation}
        onAnimationComplete={() => setSettledStage(stage)}
        aria-hidden
      />

      <motion.div
        className={`${styles.cardLayer} ${away ? styles.cardLayerFront : ''}`}
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
            highlightId={highlightId}
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

      <div className={styles.hintArea} aria-live="polite">
        {highlighted && isFlipped && <p className={styles.hint}>Your message is highlighted</p>}
        <AnimatePresence>
          {showHint && (
            <motion.p
              key={step}
              className={styles.hint}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: reduceMotion ? 0.15 : 0.7 } }}
              exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.2 } }}
            >
              {HINT_TEXT[step]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {enlargedMessage && (
        <EnlargedMessage
          message={enlargedMessage}
          reduceMotion={reduceMotion}
          onClose={closeEnlarged}
        />
      )}
    </div>
  );
}

interface EnlargedMessageProps {
  message: Message;
  reduceMotion: boolean;
  onClose: () => void;
}

function EnlargedMessage({ message, reduceMotion, onClose }: EnlargedMessageProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      // Close is the only control in the dialog, so Tab stays on it instead of reaching the card behind.
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <motion.div
      className={styles.enlargeOverlay}
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Message"
        className={styles.enlargeBubble}
        initial={reduceMotion ? false : { scale: 0.92 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className={`${styles.enlargeText} ${fontFamilyMap[message.fontFamily] ?? ''}`}>
          {message.text}
        </p>
        <button ref={closeRef} type="button" className={styles.enlargeClose} onClick={onClose}>
          Close
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
