'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './styles.module.css';

import type { Message } from '@/utils/messages';

interface OwnerControlsProps {
  /** Only the messages this browser wrote. */
  messages: Message[];
  /** Resolves to an error text, or null when the message was deleted. */
  onDelete: (message: Message) => Promise<string | null>;
}

function preview(text: string, length: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length).trimEnd()}...` : flat;
}

/** Small Edit and Delete links for the messages the visitor wrote. Nothing is shown to anyone else. */
export default function OwnerControls({ messages, onDelete }: OwnerControlsProps) {
  const [confirming, setConfirming] = useState<Message | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  if (messages.length === 0) return null;

  return (
    <>
      <div className={styles.ownerBar} role="group" aria-label="Your messages">
        {messages.map((message) => {
          const name = `your message "${preview(message.text, 30)}"`;
          return (
            <span key={message.id} className={styles.ownerItem}>
              {messages.length > 1 && (
                <span className={styles.ownerPreview}>{preview(message.text, 14)}</span>
              )}
              <Link
                href={`/edit/${message.id}`}
                className={styles.ownerButton}
                aria-label={`Edit ${name}`}
              >
                Edit
              </Link>
              <button
                type="button"
                className={styles.ownerButton}
                aria-label={`Delete ${name}`}
                onClick={(event) => {
                  openerRef.current = event.currentTarget;
                  setConfirming(message);
                }}
              >
                Delete
              </button>
            </span>
          );
        })}
      </div>
      {confirming && (
        <ConfirmDelete
          message={confirming}
          onCancel={() => {
            setConfirming(null);
            // The opener is gone if the message was deleted, and focus then stays on the card.
            if (openerRef.current?.isConnected) openerRef.current.focus();
          }}
          onDelete={onDelete}
          onDeleted={() => setConfirming(null)}
        />
      )}
    </>
  );
}

interface ConfirmDeleteProps {
  message: Message;
  onCancel: () => void;
  onDelete: (message: Message) => Promise<string | null>;
  onDeleted: () => void;
}

function ConfirmDelete({ message, onCancel, onDelete, onDeleted }: ConfirmDeleteProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Cancel is focused first, so pressing Enter by mistake never deletes anything.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
      if (event.key === 'Tab') {
        const buttons = [cancelRef.current, confirmRef.current].filter(
          (button): button is HTMLButtonElement => button !== null && !button.disabled,
        );
        if (buttons.length === 0) return;
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = event.shiftKey ? -1 : 1;
        event.preventDefault();
        buttons[(index + step + buttons.length) % buttons.length].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const failure = await onDelete(message);
    if (failure === null) {
      onDeleted();
    } else {
      setError(failure);
      setBusy(false);
      cancelRef.current?.focus();
    }
  };

  return createPortal(
    <div className={styles.enlargeOverlay} onClick={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-text"
        className={styles.enlargeBubble}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-title" className={styles.confirmTitle}>
          Delete your message?
        </h2>
        <p id="delete-text" className={styles.confirmText}>
          &quot;{preview(message.text, 80)}&quot; will be removed from the card. This can&apos;t be undone.
        </p>
        {error && (
          <p className={styles.confirmError} role="alert">
            {error}
          </p>
        )}
        <div className={styles.confirmActions}>
          <button ref={cancelRef} type="button" className={styles.enlargeClose} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.confirmDelete}
            onClick={confirm}
            aria-disabled={busy || undefined}
          >
            {busy ? 'Deleting' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
