import { createPortal } from 'react-dom';
import { useEffect, useRef, useCallback } from 'react';

export default function Modal({ show, onClose, title, children, large }) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Save the previously focused element when modal opens, and restore it when it closes
  useEffect(() => {
    if (show) {
      // Remember what was focused before the modal opened
      previousActiveElement.current = document.activeElement;

      // Focus the modal container so keyboard works inside it
      // Use a small delay to ensure the portal has rendered
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const firstInput = modalRef.current.querySelector('input, select, textarea, button[type="submit"]');
          if (firstInput) {
            firstInput.focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    } else {
      // When modal closes, restore focus to the previously active element
      // This prevents the "keyboard stops working" bug where focus falls to <body>
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        // Small delay to ensure the portal is fully unmounted
        const timer = setTimeout(() => {
          try {
            previousActiveElement.current.focus();
          } catch (e) {
            // If the element no longer exists, focus the page content area
            const pageContent = document.querySelector('.page-content');
            if (pageContent) {
              pageContent.setAttribute('tabindex', '-1');
              pageContent.focus();
              pageContent.removeAttribute('tabindex');
            }
          }
        }, 10);
        return () => clearTimeout(timer);
      }
    }
  }, [show]);

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
