import { createPortal } from 'react-dom';
import { useEffect, useRef, useCallback } from 'react';

export default function Modal({ show, onClose, title, children, large }) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Focus the first input inside the modal — tries multiple times
  // to handle cases where OS-level window focus was lost (e.g. after confirm() dialogs)
  const focusFirstInput = useCallback(() => {
    if (!modalRef.current) return;
    const firstInput = modalRef.current.querySelector('input:not([readonly]), select, textarea, button[type="submit"]');
    if (firstInput) {
      firstInput.focus();
    } else {
      modalRef.current.focus();
    }
  }, []);

  // Save the previously focused element when modal opens, and restore it when it closes
  useEffect(() => {
    if (show) {
      // Remember what was focused before the modal opened
      previousActiveElement.current = document.activeElement;

      // Ensure the window itself has OS-level focus
      window.focus();

      // Focus the first input — try multiple times with increasing delays
      // to handle cases where window focus hasn't been fully restored yet
      const t1 = setTimeout(focusFirstInput, 50);
      const t2 = setTimeout(focusFirstInput, 150);
      const t3 = setTimeout(focusFirstInput, 300);

      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    } else {
      // When modal closes, restore focus to the previously active element
      // This prevents the "keyboard stops working" bug where focus falls to <body>
      const timer = setTimeout(() => {
        try {
          // Check if the previously focused element still exists in the DOM
          if (
            previousActiveElement.current &&
            typeof previousActiveElement.current.focus === 'function' &&
            document.body.contains(previousActiveElement.current)
          ) {
            previousActiveElement.current.focus();
          } else {
            // Element was removed (e.g. deleted row) — focus the page content
            const pageContent = document.querySelector('.page-content');
            if (pageContent) {
              pageContent.focus({ preventScroll: true });
            }
          }
        } catch (e) {
          const pageContent = document.querySelector('.page-content');
          if (pageContent) {
            pageContent.focus({ preventScroll: true });
          }
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [show, focusFirstInput]);

  // Handle Escape key to close modal
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (show) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [show, handleKeyDown]);

  // Safety net: if the user clicks anywhere inside the modal and focus is
  // somehow lost (stuck on body), force focus into the modal's first input
  const handleModalClick = useCallback((e) => {
    // Don't steal focus from elements that are already focusable
    const target = e.target;
    const isFocusable = target.matches(
      'input, select, textarea, button, a, [tabindex], [contenteditable]'
    );
    if (!isFocusable) {
      // Focus is on a non-interactive element — push it to the first input
      requestAnimationFrame(focusFirstInput);
    }
  }, [focusFirstInput]);

  if (!show) return null;

  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={`modal ${large ? 'modal-lg' : ''}`}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        onClick={handleModalClick}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
