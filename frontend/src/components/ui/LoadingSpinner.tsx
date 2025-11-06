import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  small: '1rem',
  medium: '2rem',
  large: '3rem'
};

export function LoadingSpinner({ 
  size = 'medium', 
  color = '#007bff', 
  className = '', 
  style = {} 
}: LoadingSpinnerProps) {
  const spinnerStyle: React.CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    border: `2px solid ${color}20`,
    borderTop: `2px solid ${color}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    ...style
  };

  return (
    <div style={spinnerStyle} className={className} />
  );
}
