'use client';
import React, { useState, useEffect, useRef } from "react";
import styles from './styles.module.css';
import { Rnd } from 'react-rnd';

export default function SignableCardBack() {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(20);
  const [fontFamily, setFontFamily] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [rndPosition, setRndPosition] = useState({ x: 0, y: 0, width: 200, height: 100 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rndRef = useRef<Rnd>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);

  const fonts = ['Dancing Script', 'Lobster', 'Mr Dafoe', 'Parisienne'];

  useEffect(() => {
    const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
    setFontFamily(`'${randomFont}', cursive`);
  }, []);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFontSize = parseInt(e.target.value);
    const textarea = textareaRef.current;
    const rndElement = rndRef.current;

    if (!textarea || !rndElement || !rndElement.resizableElement.current) {
      return;
    }

    if (
      newFontSize >= 14 &&
      newFontSize <= 26 &&
      (textarea?.scrollHeight <= rndElement.resizableElement.current.offsetHeight || newFontSize < fontSize)
    ) {
      setFontSize(newFontSize);
    }
  };

  const handleFontFamilyChange = (font: string) => {
    setFontFamily(`'${font}', cursive`);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (e: MouseEvent) => {
    const dropdown = dropdownRef.current;

    if (!dropdown) {
      return;
    }

    if (!dropdown.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    const rndElement = rndRef.current;

    if (!textarea || !rndElement || !rndElement.resizableElement.current) {
      return;
    }

    if (textarea.scrollHeight <= rndElement.resizableElement.current.offsetHeight) {
      setText(e.target.value);
    }
  };

  const handleSave = async () => {
    if (isSaved) {
      return;
    }

    const cardBackElement = cardBackRef.current;
    const rndElement = rndRef?.current?.resizableElement.current;

    if (!rndElement || !cardBackElement) {
      return;
    }

    const { left, top, width, height } = rndElement.getBoundingClientRect();
    const { left: cardBackLeft, top: cardBackTop } = cardBackElement.getBoundingClientRect();

    const x = left - cardBackLeft + 2; // TODO: figure out why the magic number 2 is needed
    const y = top - cardBackTop + 2;

    const messageData = {
      text,
      fontSize,
      fontFamily,
      position: { x, y, width, height },
    };

    try {
      const response = await fetch('/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        setRndPosition({ x, y, width, height });
        setIsSaved(true);
      } else {
        console.error('Failed to save message');
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };;

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.flexContainer}>
      <div className={styles.envelopeContainer}>
        <div className={styles.cardContainer}>
          <div className={styles.cardBack} ref={cardBackRef}>
            {isSaved ? (
              <div
                className={styles.savedTextContainer}
                style={{
                  top: rndPosition.y,
                  left: rndPosition.x,
                  width: rndPosition.width,
                  height: rndPosition.height,
                  fontSize: `${fontSize}px`,
                  fontFamily: fontFamily,
                }}
              >
                {text}
              </div>
            ) : (
              <Rnd
                ref={rndRef}
                bounds="parent"
                default={rndPosition}
                minWidth={100}
                minHeight={50}
                maxWidth={400}
                maxHeight={200}
                className={styles.rndContainer}
              >
                <div className={styles.textareaContainer}>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    className={styles.textarea}
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: fontFamily,
                    }}
                  />
                </div>
              </Rnd>
            )}
          </div>
          <div className={styles.bottomBar}>
            <div ref={dropdownRef} className={styles.dropdownContainer}>
              <div onClick={toggleDropdown} className={styles.dropdownButton}>
                <span style={{ fontFamily: fontFamily }}>Happy Birthday!</span>
              </div>
              {isOpen && (
                <div className={styles.dropdownMenu}>
                  {fonts.map((font) => (
                    <div
                      key={font}
                      onClick={() => handleFontFamilyChange(font)}
                      className={styles.dropdownItem}
                      style={{
                        fontFamily: `'${font}', cursive`,
                      }}
                    >
                      Happy Birthday!
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              type="number"
              id="fontSize"
              value={fontSize}
              min={14}
              max={26}
              onChange={handleFontSizeChange}
              className={styles.fontSizeInput}
            />
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`${styles.saveButton} ${isSaved ? styles.saveButtonDisabled : ''}`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}