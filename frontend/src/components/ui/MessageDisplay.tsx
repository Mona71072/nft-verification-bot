import React from 'react';

export type MessageType = 'success' | 'error' | 'warning' | 'info';

interface MessageDisplayProps {
  message: string;
  type?: MessageType;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const messageStyles: Record<MessageType, React.CSSProperties> = {
  success: {
    backgroundColor: '#d1edff',
    borderColor: '#74c0fc',
    color: '#0c5460'
  },
  error: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    color: '#721c24'
  },
  warning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    color: '#856404'
  },
  info: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
    color: '#1e40af'
  }
};

export function MessageDisplay({ 
  message, 
  type = 'info', 
  onClose, 
  className = '', 
  style = {} 
}: MessageDisplayProps) {
  const baseStyle: React.CSSProperties = {
    padding: '1rem',
    border: '1px solid',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...messageStyles[type],
    ...style
  };

  return (
    <div style={baseStyle} className={className}>
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            color: 'inherit',
            padding: '0',
            marginLeft: '1rem'
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
