'use client';
import React, { useState, useEffect, useRef } from "react";
import styles from './styles.module.css';
import { Rnd } from 'react-rnd';

export default function SignableCardBack() {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const textareaRef = useRef(null);
  const rndRef = useRef(null);

  const fonts = ['Dancing Script', 'Lobster', 'Mr Dafoe', 'Parisienne'];

  useEffect(() => {
    const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
    setFontFamily(`'${randomFont}', cursive`);
  }, []);

  const handleFontSizeChange = (e) => {
    setFontSize(parseInt(e.target.value));
  };

  const handleFontFamilyChange = (font) => {
    setFontFamily(`'${font}', cursive`);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  const handleTextChange = (e) => {
    const textarea = textareaRef.current;
    const rndElement = rndRef.current;

    if (textarea.scrollHeight <= rndElement.resizableElement.current.offsetHeight) {
      setText(e.target.value);
    }
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
          <div className={styles.cardBack}>
            <Rnd
              ref={rndRef}
              bounds="parent"
              default={{ x: 0, y: 0, width: 200, height: 100 }}
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
              min={8}
              max={32}
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
          </div>
        </div>
      </div>
    </div>
  );
}