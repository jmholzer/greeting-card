'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { fontFamilyMap } from '@/app/fonts';
import styles from './styles.module.css';

interface FontPickerProps {
  fonts: string[];
  value: string;
  onChange: (font: string) => void;
  disabled?: boolean;
  /** The visitor's own text, shown in each font so they can compare. */
  previewText?: string;
}

export default function FontPicker({ fonts, value, onChange, disabled = false, previewText = '' }: FontPickerProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const preview = previewText.replace(/\s+/g, ' ').trim() || 'Your message';
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const openMenu = () => {
    setActive(Math.max(0, fonts.indexOf(value)));
    setOpen(true);
  };

  const closeMenu = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const select = (index: number) => {
    onChange(fonts[index]);
    closeMenu(true);
  };

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => Math.min(fonts.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(fonts.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        select(active);
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        break;
      case 'Tab':
        closeMenu(false);
        break;
    }
  };

  return (
    <div className={styles.dropdownContainer} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.dropdownButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        <span className={styles.dropdownLabel}>Font:</span>{' '}
        <span className={fontFamilyMap[value]}>{value}</span>
        <ChevronUpDownIcon className={styles.dropdownChevron} aria-hidden />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label="Font"
          aria-activedescendant={optionId(active)}
          className={styles.dropdownMenu}
          onKeyDown={onListKeyDown}
        >
          {fonts.map((font, index) => (
            <li
              key={font}
              id={optionId(index)}
              role="option"
              aria-selected={font === value}
              aria-label={font}
              data-active={index === active || undefined}
              className={`${styles.dropdownItem} ${fontFamilyMap[font]}`}
              onClick={() => select(index)}
              onPointerMove={() => setActive(index)}
            >
              {preview}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
