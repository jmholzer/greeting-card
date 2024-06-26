'use client';
import React, { useState, useRef, useEffect } from "react";
import styles from './styles.module.css';
import { EnvelopeIcon, CheckIcon } from '@heroicons/react/24/solid';
import { useFormik } from 'formik';
import Link from 'next/link';
import { fontFamilyMap } from '@/app/fonts';

const fonts = Object.keys(fontFamilyMap);
const characterLimit = 100;
const placeholder = `Your message here. Don't forget to say who you are :)`;

export default function SignForm() {
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const formik = useFormik({
    initialValues: {
      text: '',
      fontFamily: fonts[Math.floor(Math.random() * fonts.length)],
    },
    validate: (values) => {
      const errors: { text?: string } = {};
      if (!values.text.trim()) {
        errors.text = 'Message is required';
      }
      return errors;
    },
    onSubmit: async (values, { setSubmitting, setStatus }) => {
      try {
        const response = await fetch('/api/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });
        if (response.ok) {
          setStatus('success');
        } else {
          setStatus('failure');
        }
      } catch (error) {
        setStatus('failure');
      }
      setSubmitting(false);
    },
  });

  useEffect(() => {
    if (textRef.current) {
      textRef.current.focus();
    }
  }, []);

  const handleFontMenuClick = () => {
    setIsFontMenuOpen(!isFontMenuOpen);
  };

  const handleFontFamilyChange = (font: string) => {
    formik.setFieldValue('fontFamily', font);
    setIsFontMenuOpen(false);
  };

  const handleTextAreaFocus = () => {
    setIsFontMenuOpen(false);
  };

  return (
    <div className={styles.container}>
      <form onSubmit={formik.handleSubmit}>
        <div className={styles.textAreaWrapper}>
          {formik.isSubmitting && (
            <div className={styles.statusContainer}>
              <span className={styles.loader} />
            </div>
          )}
          {formik.status === 'success' && (
            <div className={styles.statusContainer}>
              <CheckIcon className={styles.successIcon} />
              <Link
                href="/"
                className={`${styles.successMessage} ${fontFamilyMap['Dancing Script']}`}
              >
                See the card &rarr;
              </Link>
            </div>
          )}
          {!formik.isSubmitting && formik.status !== 'success' && (
            <>
              <textarea
                ref={textRef}
                className={`${styles.messageField} ${fontFamilyMap[formik.values.fontFamily]}`}
                {...formik.getFieldProps('text')}
                maxLength={characterLimit}
                placeholder={placeholder}
                disabled={formik.isSubmitting}
                onFocus={handleTextAreaFocus}
              />
              <div className={styles.bottomBar}>
                <div className={styles.characterCount}>{formik.values.text.length}/{characterLimit}</div>
                <div className={styles.dropdownContainer}>
                  <div onClick={handleFontMenuClick} className={styles.dropdownButton}>
                    <span className={fontFamilyMap[formik.values.fontFamily]}>Choose a Font</span>
                  </div>
                  {isFontMenuOpen && (
                    <div className={styles.dropdownMenu}>
                      {fonts.map((font) => (
                        <div
                          key={font}
                          onClick={() => handleFontFamilyChange(font)}
                          className={`${styles.dropdownItem} ${fontFamilyMap[font]}`}
                        >
                          Your message
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {formik.status === 'failure' && (
                <div className={styles.statusContainer}>
                  <div className={styles.failureMessage}>Failed to send message. Please try again.</div>
                </div>
              )}
            </>
          )}
        </div>
        {
          !formik.isSubmitting && formik.status !== 'success' && (
            <button
              type="submit"
              className={styles.submitButton}
              disabled={!formik.values.text.trim() || formik.isSubmitting}
            >
              <EnvelopeIcon
                className={styles.sendIcon}
                style={{ color: (!formik.values.text.trim() || formik.isSubmitting) ? '#858585' : '#f5f5f5' }}
              />
            </button>
          )
        }
      </form>
    </div>
  );
}