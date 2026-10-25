'use client';
import React, { useState, useRef, useEffect } from "react";
import styles from './styles.module.css';
import { EnvelopeIcon, CheckIcon } from '@heroicons/react/24/solid';
import { useFormik } from 'formik';
import Link from 'next/link';
import { fontFamilyMap } from '@/app/fonts';
import { ALLOWED_FONTS, MAX_MESSAGE_LENGTH, MAX_MESSAGES } from '@/lib/config';
import FontPicker from '@/components/SignForm/FontPicker';

const fonts: string[] = [...ALLOWED_FONTS];
const characterLimit = MAX_MESSAGE_LENGTH;
const placeholder = `Your message here. Don't forget to say who you are :)`;

// The visible counter is hidden from screen readers; this is announced instead,
// and only when the limit is close, so typing is not interrupted on every key.
const COUNT_ANNOUNCE_FROM = 20;

interface SignFormProps {
  isFull?: boolean;
}

export default function SignForm({ isFull = false }: SignFormProps) {
  const [errorMessage, setErrorMessage] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const formik = useFormik({
    initialValues: {
      text: '',
      fontFamily: fonts[0],
    },
    validate: (values) => {
      const errors: { text?: string } = {};
      if (!values.text.trim()) {
        errors.text = 'Message is required';
      }
      return errors;
    },
    onSubmit: async (values, { setSubmitting, setStatus }) => {
      setErrorMessage('');
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
        } else if (response.status === 409) {
          setStatus('full');
        } else {
          const body = await response.json().catch(() => null);
          setErrorMessage(typeof body?.message === 'string' ? body.message : '');
          setStatus('failure');
        }
      } catch (error) {
        setStatus('failure');
      }
      setSubmitting(false);
    },
  });

  const { setFieldValue } = formik;
  useEffect(() => {
    // Picked after mount so the server and client render the same initial HTML.
    setFieldValue('fontFamily', fonts[Math.floor(Math.random() * fonts.length)], false);
  }, [setFieldValue]);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.focus();
    }
  }, []);

  const succeeded = formik.status === 'success';
  useEffect(() => {
    if (succeeded) successRef.current?.focus();
  }, [succeeded]);

  const submitting = formik.isSubmitting;
  const length = formik.values.text.length;
  const remaining = characterLimit - length;
  const isEmpty = !formik.values.text.trim();
  const failed = formik.status === 'failure';
  const errorText = errorMessage || 'Failed to send message. Please try again.';

  if (isFull || formik.status === 'full') {
    return (
      <div className={styles.container}>
        <div className={styles.textAreaWrapper}>
          <div className={styles.statusContainer} role="status">
            <div className={`${styles.successMessage} ${fontFamilyMap['Dancing Script']}`}>
              This card is full
            </div>
            <div className={styles.fullMessage}>
              All {MAX_MESSAGES} messages have been written, so it can&apos;t take any more.
            </div>
            <Link
              href="/"
              className={`${styles.successMessage} ${fontFamilyMap['Dancing Script']}`}
            >
              See the card &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className={styles.container}>
        <div className={styles.textAreaWrapper}>
          <div className={styles.statusContainer} role="status" tabIndex={-1} ref={successRef}>
            <CheckIcon className={styles.successIcon} aria-hidden />
            <div className={styles.successText}>Message sent</div>
            <Link
              href="/"
              className={`${styles.successMessage} ${fontFamilyMap['Dancing Script']}`}
            >
              See the card &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <form
        className={styles.form}
        aria-busy={submitting}
        onSubmit={(event) => {
          // The button stays focusable while sending, so guard against a second submit.
          if (submitting) {
            event.preventDefault();
            return;
          }
          formik.handleSubmit(event);
        }}
      >
        <div className={styles.textAreaWrapper}>
          <label htmlFor="message-text" className={styles.srOnly}>
            Your message
          </label>
          <textarea
            id="message-text"
            ref={textRef}
            className={`${styles.messageField} ${fontFamilyMap[formik.values.fontFamily]}`}
            {...formik.getFieldProps('text')}
            maxLength={characterLimit}
            placeholder={placeholder}
            disabled={submitting}
            aria-describedby={failed ? 'message-error' : undefined}
            aria-invalid={failed || undefined}
          />
          <div className={styles.bottomBar}>
            <div className={styles.characterCount} aria-hidden>
              {length}/{characterLimit}
            </div>
            <span className={styles.srOnly} role="status">
              {remaining <= COUNT_ANNOUNCE_FROM
                ? `${remaining} ${remaining === 1 ? 'character' : 'characters'} left`
                : ''}
            </span>
            <FontPicker
              fonts={fonts}
              value={formik.values.fontFamily}
              onChange={(font) => formik.setFieldValue('fontFamily', font)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className={styles.errorSlot}>
          {failed && !submitting && (
            <p id="message-error" className={styles.failureMessage} role="alert">
              {errorText}
            </p>
          )}
        </div>

        <button
          type="submit"
          className={styles.submitButton}
          disabled={isEmpty && !submitting}
          aria-disabled={submitting || undefined}
        >
          {submitting ? (
            <span className={styles.spinner} aria-hidden />
          ) : (
            <EnvelopeIcon className={styles.sendIcon} aria-hidden />
          )}
          <span>{submitting ? 'Sending' : 'Send'}</span>
        </button>
      </form>
    </div>
  );
}
