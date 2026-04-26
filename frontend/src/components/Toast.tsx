import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  return (
    <div className={`toast toast-${toast.type}`} role="alert" aria-live="assertive">
      {toast.type === 'success'
        ? <CheckCircle size={16} />
        : <XCircle size={16} />
      }
      <span>{toast.message}</span>
      <button
        className="toast-close"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, type, message }]);
  }, []);

  const value: ToastContextValue = {
    success: (msg) => add('success', msg),
    error: (msg) => add('error', msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-label="Notifications">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onRemove={remove} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
