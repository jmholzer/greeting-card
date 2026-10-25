'use client';

import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import { AutoTextSize } from 'auto-text-size';
import styles from './styles.module.css';

import { fontFamilyMap } from '@/app/fonts';
import type { Geometry } from '@/lib/geometry';

/** Position and turn of a box on the writing surface, which its parent must fill. */
export function boxStyle(box: Geometry): CSSProperties {
  return {
    left: `${(box.x - box.width / 2) * 100}%`,
    top: `${(box.y - box.height / 2) * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
    transform: `rotate(${box.rotation}deg)`,
  };
}

interface MessageBoxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  text: string;
  fontFamily: string;
  box: Geometry;
  messageId?: number;
  ref?: Ref<HTMLDivElement>;
  /** Extra content on top of the text, such as the handles of the box being placed. */
  children?: ReactNode;
}

/** One message at its place on the card, with the text sized to fill the box. */
export default function MessageBox({
  text,
  fontFamily,
  box,
  messageId,
  className = '',
  style,
  children,
  ...rest
}: MessageBoxProps) {
  return (
    <div
      {...rest}
      data-message-id={messageId}
      className={`${styles.message} ${fontFamilyMap[fontFamily] ?? ''} ${className}`}
      style={{ ...boxStyle(box), ...style }}
    >
      <AutoTextSize mode="box" minFontSizePx={0.1}>
        {text}
      </AutoTextSize>
      {children}
    </div>
  );
}
