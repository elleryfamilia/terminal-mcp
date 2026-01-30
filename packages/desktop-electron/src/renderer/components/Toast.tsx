/**
 * Toast Component
 *
 * Individual toast notification with auto-dismiss and optional action button.
 */

import { useEffect, useState } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastData {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
  duration?: number;
  action?: ToastAction;
  actions?: ToastAction[];  // Support multiple actions
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-dismiss after duration
    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const handleActionClick = (action: ToastAction) => {
    action.onClick();
    handleDismiss();
  };

  // Combine single action and multiple actions
  const allActions = toast.actions || (toast.action ? [toast.action] : []);

  return (
    <div
      className={`toast toast-${toast.variant} ${isVisible ? 'toast-visible' : ''} ${isLeaving ? 'toast-leaving' : ''}`}
    >
      <span className="toast-message">{toast.message}</span>
      <div className="toast-actions">
        {allActions.map((action, index) => (
          <button
            key={index}
            type="button"
            className="toast-btn toast-btn-action"
            onClick={() => handleActionClick(action)}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="toast-btn toast-btn-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
