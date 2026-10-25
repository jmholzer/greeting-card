'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import styles from './styles.module.css';
import fitStyles from './fitText.module.css';

import { fontFamilyMap } from '@/app/fonts';
import type { Geometry } from '@/lib/geometry';
import { fitText, paddingPx, useFontsVersion } from './textFit';

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

interface Size {
  width: number;
  height: number;
}

/**
 * One message at its place on the card. The text is centred and as large as fits inside
 * the box, less a small padding, and never leaves the box whatever the screen size.
 */
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
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const fontsVersion = useFontsVersion();
  const fontClass = fontFamilyMap[fontFamily] ?? '';

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const content = entry.contentBoxSize?.[0];
      const next = content
        ? { width: content.inlineSize, height: content.blockSize }
        : { width: entry.contentRect.width, height: entry.contentRect.height };
      setSize((current) =>
        current && current.width === next.width && current.height === next.height ? current : next,
      );
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!size || size.width === 0 || size.height === 0 || box.height === 0) return null;
    // The box is a known fraction of the surface, so its height gives the surface's.
    const pad = paddingPx(size.height / box.height);
    const width = size.width - 2 * pad;
    const height = size.height - 2 * pad;
    if (width <= 0 || height <= 0) return null;
    return { pad, fit: fitText(text, fontClass, width, height) };
    // fontsVersion is not read, but a loaded font changes how text measures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, box.height, text, fontClass, fontsVersion]);

  return (
    <div
      {...rest}
      data-message-id={messageId}
      className={`${styles.message} ${className}`}
      style={{ ...boxStyle(box), ...style }}
    >
      <div ref={areaRef} className={styles.messageArea}>
        <div className={styles.messageText} style={{ inset: layout?.pad ?? 0, opacity: layout ? 1 : 0 }}>
          <div
            data-message-text
            className={`${fontClass} ${fitStyles.fit}`}
            style={{
              fontSize: layout?.fit.fontSize,
              lineHeight: layout?.fit.lineHeight,
              paddingInline: layout ? `${layout.fit.sidePadding}em` : undefined,
            }}
          >
            {text}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
