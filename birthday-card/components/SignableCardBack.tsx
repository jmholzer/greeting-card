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
  const dropdownRef = useRef<HTMLDivElement>(null);;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rndRef = useRef<Rnd>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);;

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
      return
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
  };;

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

  const handleSave = () => {
    const cardBackElement = cardBackRef.current;
    const rndElement = rndRef?.current?.resizableElement.current;

    if (!rndElement || !cardBackElement) {
      return
    }

    const { left, top, width, height } = rndElement.getBoundingClientRect();
    const { left: cardBackLeft, top: cardBackTop } = cardBackElement.getBoundingClientRect();

    const x = left - cardBackLeft + 2; // TODO: figure out why the magic number 2 is needed
    const y = top - cardBackTop + 2;

    setRndPosition({ x, y, width, height });
    setIsSaved(true);
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className={styles.envelopeContainer}>
        <div className={styles.cardContainer}>
          <div className={styles.cardBack} ref={cardBackRef}>
            {isSaved ? (
              <div
                style={{
                  position: 'absolute',
                  top: rndPosition.y,
                  left: rndPosition.x,
                  width: rndPosition.width,
                  height: rndPosition.height,
                  fontSize: `${fontSize}px`,
                  fontFamily: fontFamily,
                  userSelect: 'text',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
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
                style={{ border: '2px dashed #ccc', borderRadius: '4px' }}
              >
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    style={{
                      width: '100%',
                      height: '100%',
                      resize: 'none',
                      border: 'none',
                      outline: 'none',
                      fontSize: `${fontSize}px`,
                      fontFamily: fontFamily,
                      userSelect: 'text',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </Rnd>
            )}
          </div>
          <div
            style={{
              backgroundColor: '#495057',
              padding: '8px',
              borderRadius: '0 0 4px 4px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div ref={dropdownRef} style={{ position: 'relative', marginRight: '8px' }}>
              <div
                onClick={toggleDropdown}
                style={{
                  padding: '4px',
                  border: 'none',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontSize: '16px',
                  cursor: 'pointer',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '150px',
                }}
              >
                <span style={{ fontFamily: fontFamily }}>Happy Birthday!</span>
              </div>
              {isOpen && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    backgroundColor: '#ffffff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px',
                    zIndex: 1,
                    minWidth: '150px',
                  }}
                >
                  {fonts.map((font) => (
                    <div
                      key={font}
                      onClick={() => handleFontFamilyChange(font)}
                      style={{
                        fontFamily: `'${font}', cursive`,
                        padding: '4px',
                        cursor: 'pointer',
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
              style={{
                appearance: 'textfield',
                WebkitAppearance: 'none',
                MozAppearance: 'textfield',
                margin: 0,
                width: '60px',
                textAlign: 'center',
                border: 'none',
                backgroundColor: '#ffffff',
                color: '#000000',
                fontSize: '16px',
                opacity: 1,
                height: '32px',
              }}
            />
            <button
              onClick={handleSave}
              disabled={isSaved}
              style={{
                marginLeft: '8px',
                padding: '4px 8px',
                border: 'none',
                backgroundColor: isSaved ? '#ccc' : '#007bff',
                color: '#ffffff',
                fontSize: '16px',
                cursor: isSaved ? 'default' : 'pointer',
                borderRadius: '4px',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}