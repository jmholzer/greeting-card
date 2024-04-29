'use client';
import React, { useState, useRef, useEffect } from "react";
import styles from './styles.module.css';
import { EnvelopeIcon, CheckIcon } from '@heroicons/react/24/solid';
import { useFormik } from 'formik';
import Link from 'next/link';

const fonts = ['Dancing Script', 'Lobster', 'Mr Dafoe', 'Parisienne'];
const characterLimit = 100;

export default function SignForm() {
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const formik = useFormik({
    initialValues: {
      text: '',
      fontFamily: fonts[Math.floor(Math.random() * fonts.length)],
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
    console.log(formik.values.fontFamily);
  };

  return (
    <div className={styles.container}>
      <form onSubmit={formik.handleSubmit}>
        <div className={styles.textAreaWrapper}>
          {formik.isSubmitting && (
            <span className={styles.loader} />
          )}
          {formik.status === 'success' && (
            <>
              <CheckIcon className={styles.successIcon} />
              <Link href="/">
                See the card -&gt;
              </Link>
            </>
          )}
          {!formik.isSubmitting && formik.status !== 'success' && (
            <>
              <textarea
                ref={textRef}
                className={styles.messageField}
                style={{ fontFamily: `'${formik.values.fontFamily}', cursive` }}
                {...formik.getFieldProps('text')}
                maxLength={characterLimit}
                placeholder="Your message here :)"
                disabled={formik.isSubmitting}
              />
              <div className={styles.bottomBar}>
                <div className={styles.characterCount}>{formik.values.text.length}/{characterLimit}</div>
                <div className={styles.dropdownContainer}>
                  <div onClick={handleFontMenuClick} className={styles.dropdownButton}>
                    <span style={{ fontFamily: `'${formik.values.fontFamily}', cursive`, color: 'black' }}>Happy Birthday!</span>
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
              {formik.status === 'failure' && (
                <div className={styles.failureMessage}>Failed to send message. Please try again.</div>
              )}
            </>
          )}
        </div>
        {!formik.isSubmitting && formik.status !== 'success' && (
          <button type="submit" className={styles.submitButton}>
            <EnvelopeIcon className={styles.envelopeIcon} />
          </button>
        )}
      </form>
    </div>
  );
}