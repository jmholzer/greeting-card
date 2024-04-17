'use client';
import { motion, useSpring } from 'framer-motion';
import React, { useState, useRef, useEffect } from "react";
import Image from 'next/image';
import styles from './styles.module.css';

interface CardProps {
  isEnvelopeOpen: boolean;
}

//Spring animation parameters
const spring = {
  type: "spring",
  stiffness: 300,
  damping: 40,
}

export default function Card({ isEnvelopeOpen }: CardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleClick = () => {
    setIsFlipped((prevState) => !prevState)
  }

  const [rotateXaxis, setRotateXaxis] = useState(0)
  const [rotateYaxis, setRotateYaxis] = useState(0)
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
      const degreeX = (mouseX / elementWidth) * 20; //The number is the rotation factor
      const degreeY = (mouseY / elementHeight) * 20; //The number is the rotation factor
      setRotateXaxis(degreeX);
      setRotateYaxis(degreeY);
    }
  };

  const handleMouseEnd = () => {
    setRotateXaxis(0)
    setRotateYaxis(0)
  }

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
          <Image src="/front.jpg" alt="Card Front" className={styles.cardFront} fill />
        </div>
      ) : (
        <motion.div onClick={handleClick} transition={spring} className={styles.cardContainer}>
          <motion.div
            ref={ref}
            whileHover={{ scale: 1.1 }} //Change the scale of zooming in when hovering
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseEnd}
            transition={spring}
            style={{
              width: "100%",
              height: "100%",
              rotateX: dx,
              rotateY: dy,
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
                <div className={styles.cardBack} />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}