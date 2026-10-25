'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, PointerEvent, ReactNode, Ref } from 'react';
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

export interface MessageEditor {
  value: string;
  placeholder: string;
  maxLength: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onPointerDown?: (event: PointerEvent<HTMLTextAreaElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLTextAreaElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLTextAreaElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

interface MessageBoxProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  text: string;
  fontFamily: string;
  box: Geometry;
  messageId?: number;
  ref?: Ref<HTMLDivElement>;
  /** When set, the text is a field the visitor types into, sized the same way as the finished message. */
  editor?: MessageEditor;
  /** The writing field, so the form can focus it after the box is placed. */
  editorRef?: Ref<HTMLTextAreaElement>;
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
const IOS_INPUT_FONT_PX = 16;

export default function MessageBox({
  text,
  fontFamily,
  box,
  messageId,
  editor,
  editorRef,
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
    const sample = editor ? editor.value || editor.placeholder : text;
    return { pad, fit: fitText(sample, fontClass, width, height) };
    // fontsVersion is not read, but a loaded font changes how text measures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, box.height, text, editor?.value, editor?.placeholder, fontClass, fontsVersion]);

  return (
    <div
      {...rest}
      data-message-id={messageId}
      className={`${styles.message} ${className}`}
      style={{ ...boxStyle(box), ...style }}
    >
        <div ref={areaRef} className={`${styles.messageArea} ${editor ? styles.messageAreaClip : ''}`}>
          <div className={styles.messageText} style={{ inset: layout?.pad ?? 0, opacity: layout ? 1 : 0 }}>
            {editor ? (
              <EditorField
                editor={editor}
                inputRef={editorRef}
                fontClass={fontClass}
                fit={layout?.fit}
                boxHeight={size && layout ? size.height - 2 * layout.pad : undefined}
              />
            ) : (
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
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** The writing field. Below 16px it is drawn at 16px and scaled down, so a phone does not zoom in on focus. */
function EditorField({
  editor,
  inputRef,
  fontClass,
  fit,
  boxHeight,
}: {
  editor: MessageEditor;
  inputRef?: Ref<HTMLTextAreaElement>;
  fontClass: string;
  fit?: { fontSize: number; lineHeight: number; sidePadding: number; height: number };
  /** Height of the padded area the field fills, so the text can sit in the middle of it. */
  boxHeight?: number;
}) {
  const fontSize = fit?.fontSize ?? IOS_INPUT_FONT_PX;
  const scale = Math.min(1, fontSize / IOS_INPUT_FONT_PX);
  // Padding is in the field's own coordinates, which are then scaled down to the fitted size.
  const padTop = fit && boxHeight ? Math.max(0, (boxHeight - fit.height) / 2) / scale : 0;
  return (
    <textarea
      ref={inputRef}
      id="message-text"
      className={`${fontClass} ${fitStyles.fit} ${styles.editor}`}
      style={{
        fontSize: fontSize / scale,
        lineHeight: fit?.lineHeight,
        paddingInline: fit ? `${fit.sidePadding}em` : undefined,
        paddingTop: padTop,
        width: `${100 / scale}%`,
        height: `${100 / scale}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
      value={editor.value}
      placeholder={editor.placeholder}
      maxLength={editor.maxLength}
      disabled={editor.disabled}
      rows={1}
      autoComplete="off"
      aria-label="Your message"
      data-message-text
      onChange={(event) => editor.onChange(event.target.value)}
      onPointerDown={editor.onPointerDown}
      onPointerMove={editor.onPointerMove}
      onPointerUp={editor.onPointerUp}
      onPointerCancel={editor.onPointerCancel}
      onFocus={editor.onFocus}
      onBlur={editor.onBlur}
    />
  );
}
