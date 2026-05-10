import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { MdCheckCircle, MdError, MdWarning, MdInfo, MdClose } from 'react-icons/md';

const ToastContext = createContext(null);

let toastId = 0;

const ICONS = {
  success: <MdCheckCircle />,
  error: <MdError />,
  warning: <MdWarning />,
  info: <MdInfo />,
};

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 350);
    }, toast.duration || 3500);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onRemove]);

  const handleClose = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 350);
  };

  return (
    <div className={`toast toast-${toast.type} ${exiting ? 'toast-exit' : ''}`}>
      <div className="toast-icon">{ICONS[toast.type] || ICONS.info}</div>
      <div className="toast-body">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button className="toast-close" onClick={handleClose}><MdClose /></button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToastRef = useRef(null);
  addToastRef.current = (type, message, options = {}) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message, ...options }]);
    return id;
  };

  const api = useRef({
    success: (message, opts) => addToastRef.current('success', message, opts),
    error: (message, opts) => addToastRef.current('error', message, opts),
    warning: (message, opts) => addToastRef.current('warning', message, opts),
    info: (message, opts) => addToastRef.current('info', message, opts),
  });

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
