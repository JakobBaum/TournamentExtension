import React, { useEffect, useState } from 'react';

let listeners = new Set();
let toasts = [];
let idCounter = 0;

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((listener) => listener(snapshot));
}

function removeToast(id) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

function scheduleAutoDismiss(toast) {
  if (toast.type === 'loading' || toast.duration === Infinity) return;
  const duration = typeof toast.duration === 'number' ? toast.duration : toast.type === 'error' ? 4000 : 2500;
  window.setTimeout(() => {
    const current = toasts.find((item) => item.id === toast.id);
    if (current && current.type !== 'loading') {
      removeToast(toast.id);
    }
  }, duration);
}

function upsertToast(type, message, options = {}) {
  const id = options.id ?? `toast-${++idCounter}`;
  const nextToast = {
    id,
    message,
    type,
    duration: options.duration,
  };

  const existingIndex = toasts.findIndex((toast) => toast.id === id);
  if (existingIndex >= 0) {
    toasts = [...toasts];
    toasts[existingIndex] = { ...toasts[existingIndex], ...nextToast };
  } else {
    toasts = [...toasts, nextToast];
  }

  emit();
  scheduleAutoDismiss(nextToast);
  return id;
}

const toast = (message, options = {}) => upsertToast('blank', message, options);
toast.success = (message, options = {}) => upsertToast('success', message, options);
toast.error = (message, options = {}) => upsertToast('error', message, options);
toast.loading = (message, options = {}) => upsertToast('loading', message, { ...options, duration: Infinity });
toast.dismiss = (id) => {
  if (!id) {
    toasts = [];
    emit();
    return;
  }
  removeToast(id);
};

export function Toaster({ position = 'top-right', containerStyle = {}, toastOptions = {} }) {
  const [items, setItems] = useState(toasts);

  useEffect(() => {
    listeners.add(setItems);
    setItems(toasts);
    return () => listeners.delete(setItems);
  }, []);

  const positionStyle = getPositionStyle(position);

  return (
    <div style={{
      position: 'fixed',
      zIndex: 2147483647,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      ...positionStyle,
      ...containerStyle,
    }}>
      {items.map((item) => {
        const mergedStyle = {
          minWidth: '240px',
          maxWidth: '420px',
          padding: '12px 14px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          color: '#fff',
          background: getBackground(item.type),
          fontSize: '14px',
          lineHeight: 1.4,
          fontFamily: 'system-ui, sans-serif',
          pointerEvents: 'auto',
          border: '1px solid rgba(255,255,255,0.08)',
          ...toastOptions.style,
        };

        return (
          <div key={item.id} style={mergedStyle} role="status" aria-live="polite">
            {item.message}
          </div>
        );
      })}
    </div>
  );
}

function getPositionStyle(position) {
  switch (position) {
    case 'top-left':
      return { top: '16px', left: '16px' };
    case 'top-center':
      return { top: '16px', left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-left':
      return { bottom: '16px', left: '16px' };
    case 'bottom-center':
      return { bottom: '16px', left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right':
      return { bottom: '16px', right: '16px' };
    case 'top-right':
    default:
      return { top: '16px', right: '16px' };
  }
}

function getBackground(type) {
  switch (type) {
    case 'success':
      return '#166534';
    case 'error':
      return '#991b1b';
    case 'loading':
      return '#1f2937';
    default:
      return '#374151';
  }
}

export default toast;
