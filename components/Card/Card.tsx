'use client';

import { motion, useSpring } from 'framer-motion';
import React, { useState, useRef, useEffect } from "react";
import Image from 'next/image';
import { AutoTextSize } from 'auto-text-size'
import styles from './styles.module.css';

import { Message } from '@/utils/messages';
import { randomGridPositions } from '@/utils/grid';

import { fontFamilyMap } from '@/app/fonts'


interface CardProps {
  isEnvelopeOpen: boolean;
  messages: Message[];
}

const spring = {
  type: "spring",
  stiffness: 300,
  damping: 40,
}

const rotationFactor = 5;

const gridRows = 4;
const gridCols = 4;
const messagePositions = randomGridPositions(gridRows, gridCols)

export default function Card({ isEnvelopeOpen, messages }: CardProps) {
  messages = messages.slice(0, gridRows * gridCols)

  const [isFlipped, setIsFlipped] = useState(false)
  const handleClick = () => {
    setZoomFactor(1);
    setZoomOrigin("center center");
    setIsFlipped((prevState) => !prevState)
  }

  const [rotateXaxis, setRotateXaxis] = useState(0)
  const [rotateYaxis, setRotateYaxis] = useState(0)
  const [zoomFactor, setZoomFactor] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState("center center")

  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (element) {
      const elementRect = element.getBoundingClientRect();
      const elementWidth = elementRect.width;
      const elementHeight = elementRect.height;
      const elementCenterX = elementWidth / 2;
      const elementCenterY = elementHeight / 2;
      const mouseX = event.clientY - elementRect.y - elementCenterY;
      const mouseY = event.clientX - elementRect.x - elementCenterX;
      const degreeX = (mouseX / elementWidth) * rotationFactor; //The number is the rotation factor
      const degreeY = (mouseY / elementHeight) * rotationFactor; //The number is the rotation factor
      setRotateXaxis(degreeX);
      setRotateYaxis(degreeY);

      if (isFlipped) {
        const mouseXPercentage = (event.clientX - elementRect.x) / elementWidth;
        const mouseYPercentage = (event.clientY - elementRect.y) / elementHeight;

        setZoomFactor(1.2);
        setZoomOrigin(`${mouseXPercentage * 100}% ${mouseYPercentage * 100}%`);
      } else {
        setZoomFactor(1);
        setZoomOrigin("center center");
      }
    }
  };

  const handleMouseEnd = (event: React.MouseEvent<HTMLDivElement>) => {
    setTimeout(() => {
      setRotateXaxis(0);
      setRotateYaxis(0);
    }, 1000);
  };

  const dx = useSpring(0, spring)
  const dy = useSpring(0, spring)

  useEffect(() => {
    dx.set(-rotateXaxis)
    dy.set(rotateYaxis)
  }, [rotateXaxis, rotateYaxis])

  return (
    <>
      {!isEnvelopeOpen ? (
        <div className={styles.cardContainer}>
          <Image src="/front.jpg" alt="Card Front" className={styles.cardFront} fill priority />
        </div>
      ) : (
        <motion.div onClick={handleClick} transition={spring} className={styles.cardContainer}>
          <motion.div
            ref={ref}
            whileHover={{ scale: zoomFactor }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseEnd}
            transition={spring}
            style={{
              width: "100%",
              height: "100%",
              rotateX: dx,
              rotateY: dy,
              transformOrigin: zoomOrigin,
            }}
          >
            <div
              style={{
                perspective: "1200px",
                transformStyle: "preserve-3d",
                width: "100%",
                height: "100%",
              }}
            >
              <motion.div
                animate={{ rotateY: isFlipped ? -180 : 0 }}
                transition={spring}
                style={{
                  width: "100%",
                  height: "100%",
                  backfaceVisibility: "hidden",
                  position: "absolute",
                }}
              >
                <Image src="/front.jpg" alt="Card Front" className={styles.cardFront} fill />
              </motion.div>
              <motion.div
                initial={{ rotateY: 180 }}
                animate={{ rotateY: isFlipped ? 0 : 180 }}
                transition={spring}
                style={{
                  width: "100%",
                  height: "100%",
                  backfaceVisibility: "hidden",
                  position: "absolute",
                }}
              >
                <div className={styles.cardBack}>
                  <div className={styles.messages}>
                    {messages.slice(0, gridRows * gridCols).map((message, index) => {
                      const fontClassName = fontFamilyMap[message.fontFamily] || '';
                      console.log(`${messagePositions[index][0]}} ${messagePositions[index][1]}}`)
                      return (
                        <div
                          key={index}
                          className={`${styles.message} ${fontClassName}`}
                          style={{
                            gridRow: `${messagePositions[index][0] + 1} / ${messagePositions[index][0] + 1}`,
                            gridColumn: `${messagePositions[index][1] + 1} / ${messagePositions[index][1] + 1}`,
                          }}
                        >
                          <AutoTextSize mode='box' minFontSizePx={0.1}>
                            {message.text}
                          </AutoTextSize>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}