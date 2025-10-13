interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  gradient?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, icon, gradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: gradient,
        borderRadius: '12px',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        }
      }}
    >
      {icon && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          fontSize: '2rem',
          opacity: 0.3,
          color: 'white'
        }}>
          {icon}
        </div>
      )}
      <div style={{ 
        fontSize: '0.875rem', 
        color: 'rgba(255, 255, 255, 0.9)', 
        fontWeight: 500,
        marginBottom: '0.5rem'
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '2rem', 
        fontWeight: 700, 
        color: 'white',
        lineHeight: 1
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

