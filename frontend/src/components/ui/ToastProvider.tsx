import React from 'react';

type Toast = {
  id: number;
  message: string;
  type?: 'info' | 'success' | 'error';
};

interface ToastContextValue {
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  showProgress: (message: string, type?: 'info' | 'success' | 'error') => { update: (nextMessage: string, nextType?: 'info' | 'success' | 'error') => void; close: () => void };
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

// Export useToast as a named export to satisfy react-refresh
export const useToast = () => {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(1);

  const showToast = React.useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showProgress: ToastContextValue['showProgress'] = (message, type = 'info') => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    return {
      update: (nextMessage: string, nextType: 'info' | 'success' | 'error' = type) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, message: nextMessage, type: nextType } : t)));
      },
      close: () => setToasts((prev) => prev.filter((t) => t.id !== id))
    };
  };

  return (
    <ToastContext.Provider value={{ showToast, showProgress }}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '10px 14px',
            borderRadius: 8,
            color: 'white',
            background: t.type === 'success' ? '#16a34a' : t.type === 'error' ? '#dc2626' : '#2563eb',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)'
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};


