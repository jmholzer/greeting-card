'use client';
import React, { useState, useRef, useEffect } from "react";
import styles from './styles.module.css';
import { EnvelopeIcon, CheckIcon } from '@heroicons/react/24/solid';
import { useFormik } from 'formik';
import Link from 'next/link';
import { fontFamilyMap } from '@/app/fonts';
import { ALLOWED_FONTS, MAX_MESSAGE_LENGTH, MAX_MESSAGE_LINES, MAX_MESSAGES } from '@/lib/config';
import { sanitizeText } from '@/lib/validation';
import FontPicker from '@/components/SignForm/FontPicker';
import { forgetOwnedMessage, saveOwnedMessage, useOwnedMessages } from '@/lib/ownedMessages';

const fonts: string[] = [...ALLOWED_FONTS];
const characterLimit = MAX_MESSAGE_LENGTH;
const placeholder = `Your message here. Don't forget to say who you are :)`;

// The visible counter is hidden from screen readers; this is announced instead,
// and only when the limit is close, so typing is not interrupted on every key.
const COUNT_ANNOUNCE_FROM = 20;

// Give up on a request that has not answered by then, so the form never hangs.
const REQUEST_TIMEOUT_MS = 15000;

function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // crypto.randomUUID needs a secure context; getRandomValues does not.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function formatWait(seconds: number): string {
  if (seconds < 60) return 'a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

interface SignFormProps {
  isFull?: boolean;
  /** When set, the form changes this existing message instead of writing a new one. */
  editing?: { id: number; text: string; fontFamily: string };
}

export default function SignForm({ isFull = false, editing }: SignFormProps) {
  const { ready: ownedReady, tokens } = useOwnedMessages();
  const editToken = editing ? tokens[editing.id] : undefined;
  const [errorMessage, setErrorMessage] = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Reused when the same message is sent again after a failure, so the server
  // can tell a retry from a new message and never saves it twice.
  const attempt = useRef<{ id: string; text: string; fontFamily: string } | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const saveEdit = async (
    values: { text: string; fontFamily: string; hp_extra: string },
    setFieldValue: (field: string, value: string, validate?: boolean) => void,
    setStatus: (status: string) => void,
    id: number,
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/message/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editToken ?? ''}`,
        },
        body: JSON.stringify(values),
        signal: controller.signal,
      });
      if (response.ok) {
        setStatus('success');
      } else if (response.status === 404) {
        forgetOwnedMessage(id);
        setStatus('gone');
      } else {
        const body = await response.json().catch(() => null);
        const wait = Number(response.headers.get('Retry-After'));
        if (response.status === 429 && wait > 0) {
          setErrorMessage(`Too many requests from your network. Please try again in ${formatWait(wait)}.`);
        } else {
          setErrorMessage(typeof body?.message === 'string' ? body.message : '');
        }
        if (values.hp_extra) setFieldValue('hp_extra', '', false);
        setStatus('failure');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setErrorMessage('Saving is taking too long. Check your connection and try again.');
      }
      setStatus('failure');
    } finally {
      clearTimeout(timeout);
    }
  };

  const formik = useFormik({
    initialValues: {
      text: editing?.text ?? '',
      fontFamily: editing && fonts.includes(editing.fontFamily) ? editing.fontFamily : fonts[0],
      hp_extra: '',
    },
    validate: (values) => {
      const errors: { text?: string } = {};
      const cleaned = sanitizeText(values.text);
      if (!cleaned) {
        errors.text = 'Message is required';
      } else if (cleaned.split('\n').length > MAX_MESSAGE_LINES) {
        errors.text = `Use at most ${MAX_MESSAGE_LINES} lines`;
      }
      return errors;
    },
    onSubmit: async (values, { setSubmitting, setStatus, setFieldValue }) => {
      setErrorMessage('');
      if (editing) {
        await saveEdit(values, setFieldValue, setStatus, editing.id);
        setSubmitting(false);
        return;
      }
      const previous = attempt.current;
      const sameMessage =
        previous !== null && previous.text === values.text && previous.fontFamily === values.fontFamily;
      const requestId = sameMessage ? previous.id : newRequestId();
      attempt.current = { id: requestId, text: values.text, fontFamily: values.fontFamily };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch('/api/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...values, requestId }),
          signal: controller.signal,
        });
        if (response.ok) {
          const body = await response.json().catch(() => null);
          if (typeof body?.message?.id !== 'number') {
            // The anti-spam check refused it, so do not claim it was sent.
            setFieldValue('hp_extra', '', false);
            setErrorMessage('Your message was not sent. Please try again.');
            setStatus('failure');
          } else {
            if (typeof body.editToken === 'string') saveOwnedMessage(body.message.id, body.editToken);
            setCreatedId(body.message.id);
            setStatus('success');
          }
        } else if (response.status === 409) {
          setStatus('full');
        } else {
          const body = await response.json().catch(() => null);
          const wait = Number(response.headers.get('Retry-After'));
          if (response.status === 429 && wait > 0) {
            setErrorMessage(`Too many messages from your network. Please try again in ${formatWait(wait)}.`);
          } else {
            setErrorMessage(typeof body?.message === 'string' ? body.message : '');
          }
          setStatus('failure');
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setErrorMessage('Sending is taking too long. Check your connection and try again.');
        }
        setStatus('failure');
      } finally {
        clearTimeout(timeout);
      }
      setSubmitting(false);
    },
  });

  const { setFieldValue } = formik;
  useEffect(() => {
    // Picked after mount so the server and client render the same initial HTML.
    if (editing) return;
    setFieldValue('fontFamily', fonts[Math.floor(Math.random() * fonts.length)], false);
  }, [setFieldValue, editing]);

  const formVisible = !editing || (ownedReady && Boolean(editToken));
  useEffect(() => {
    if (!formVisible) return;
    // On a phone, focusing here would raise the keyboard before the visitor asked for it.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const field = textRef.current;
    field?.focus();
    if (editing && field) field.setSelectionRange(field.value.length, field.value.length);
  }, [editing, formVisible]);

  const [copied, setCopied] = useState(false);
  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(formik.values.text);
      setCopied(true);
    } catch {
      // The text is also selectable on screen, so copying by hand still works.
    }
  };

  const succeeded = formik.status === 'success';
  useEffect(() => {
    if (succeeded) successRef.current?.focus();
  }, [succeeded]);

  const submitting = formik.isSubmitting;
  const length = formik.values.text.length;
  const remaining = characterLimit - length;
  const cleanedText = sanitizeText(formik.values.text);
  const isEmpty = cleanedText === '';
  const tooManyLines = cleanedText.split('\n').length > MAX_MESSAGE_LINES;
  const failed = formik.status === 'failure';
  const errorText = errorMessage || 'Failed to send message. Please try again.';

  if (editing) {
    if (!ownedReady) return <div className={styles.container} />;
    if (!editToken || formik.status === 'gone') {
      return (
        <div className={styles.container}>
          <div className={styles.textAreaWrapper}>
            <div className={styles.statusContainer} role="status">
              <div className={`${styles.successMessage} ${fontFamilyMap['Dancing Script']}`}>
                This message can&apos;t be changed here
              </div>
              <div className={styles.fullMessage}>
                A message can only be changed in the browser it was written in.
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
  }

  if (isFull || formik.status === 'full') {
    const draft = formik.values.text.trim();
    return (
      <div className={styles.container}>
        <div className={`${styles.textAreaWrapper} ${draft ? styles.fullWithDraft : ''}`}>
          <div className={styles.statusContainer} role="status">
            <div className={`${styles.successMessage} ${fontFamilyMap['Dancing Script']}`}>
              This card is full
            </div>
            <div className={styles.fullMessage}>
              All {MAX_MESSAGES} messages have been written, so it can&apos;t take any more.
            </div>
            {draft && (
              <div className={styles.draft}>
                <p className={styles.draftLabel}>Your message was not saved:</p>
                <p className={`${styles.draftText} ${fontFamilyMap[formik.values.fontFamily]}`}>{draft}</p>
                <button type="button" className={styles.copyButton} onClick={copyDraft}>
                  {copied ? 'Copied' : 'Copy message'}
                </button>
              </div>
            )}
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

  const shownId = editing ? editing.id : createdId;

  if (succeeded) {
    return (
      <div className={styles.container}>
        <div className={styles.textAreaWrapper}>
          <div className={styles.statusContainer} role="status" tabIndex={-1} ref={successRef}>
            <CheckIcon className={styles.successIcon} aria-hidden />
            <div className={styles.successText}>{editing ? 'Message updated' : 'Message sent'}</div>
            <Link
              href={shownId === null ? '/' : `/?signed=${shownId}`}
              className={`${styles.successMessage} ${fontFamilyMap['Dancing Script']}`}
            >
              {shownId === null ? 'See the card' : 'See your message'} &rarr;
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
          <div className={styles.honeypot} aria-hidden inert>
            <label htmlFor="hp-extra">Leave this field empty</label>
            <input
              id="hp-extra"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...formik.getFieldProps('hp_extra')}
            />
          </div>
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
              previewText={formik.values.text}
              value={formik.values.fontFamily}
              onChange={(font) => formik.setFieldValue('fontFamily', font)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className={styles.errorSlot}>
          {tooManyLines && (
            <p className={styles.failureMessage} role="status">
              Please use at most {MAX_MESSAGE_LINES} lines.
            </p>
          )}
          {failed && !submitting && !tooManyLines && (
            <p id="message-error" className={styles.failureMessage} role="alert">
              {errorText}
            </p>
          )}
        </div>

        <div className={styles.actions}>
          {editing && (
            <Link href={`/?signed=${editing.id}`} className={styles.cancelLink}>
              Cancel
            </Link>
          )}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={(isEmpty || tooManyLines) && !submitting}
            aria-disabled={submitting || undefined}
          >
            {submitting ? (
              <span className={styles.spinner} aria-hidden />
            ) : editing ? (
              <CheckIcon className={styles.sendIcon} aria-hidden />
            ) : (
              <EnvelopeIcon className={styles.sendIcon} aria-hidden />
            )}
            <span>{submitting ? (editing ? 'Saving' : 'Sending') : editing ? 'Save' : 'Send'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
