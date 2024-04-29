'use client';
import React, { useState, useRef, useEffect } from "react";
import styles from './styles.module.css';
import { EnvelopeIcon } from '@heroicons/react/24/solid';

const fonts = ['Dancing Script', 'Lobster', 'Mr Dafoe', 'Parisienne'];
const characterLimit = 100;

export default function SignForm() {
  const [fontFamily, setFontFamily] = useState(fonts[Math.floor(Math.random() * fonts.length)]);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [text, setText] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.focus();
    }
  }, []);

  const handleFontMenuClick = () => {
    setIsFontMenuOpen(!isFontMenuOpen);
  };

  const handleFontFamilyChange = (font: string) => {
    setFontFamily(`'${font}', cursive`);
    setIsFontMenuOpen(false);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const currentText = event.target.value;
    setText(currentText.slice(0, characterLimit));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          fontFamily,
        }),
      });

      if (response.ok) {
        console.log('Message saved successfully');
        // Reset form or perform any other action on successful submission
      } else {
        console.error('Failed to save message');
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit}>
        <div className={styles.textAreaWrapper}>
          <textarea
            ref={textRef}
            className={styles.messageField}
            style={{ fontFamily: fontFamily }}
            value={text}
            onChange={handleTextChange}
            maxLength={characterLimit}
            placeholder="Your message here :)"
          />
          <div className={styles.bottomBar}>
            <div className={styles.characterCount}>{text.length}/{characterLimit}</div>
            <div className={styles.dropdownContainer}>
              <div onClick={handleFontMenuClick} className={styles.dropdownButton}>
                <span style={{ fontFamily: fontFamily, color: 'black' }}>Happy Birthday!</span>
              </div>
              {isFontMenuOpen && (
                <div className={styles.dropdownMenu}>
                  {fonts.map((font) => (
                    <div
                      key={font}
                      onClick={() => handleFontFamilyChange(font)}
                      className={styles.dropdownItem}
                      style={{ fontFamily: `'${font}', cursive`, color: 'black' }}
                    >
                      Your message
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <button type="submit" className={styles.submitButton}>
          <EnvelopeIcon className={styles.envelopeIcon} />
        </button>
      </form>
    </div>
  );
}