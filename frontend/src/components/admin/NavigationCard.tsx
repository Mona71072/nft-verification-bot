interface NavigationCardProps {
  title: string;
  description: string;
  href: string;
}

export function NavigationCard({ title, description, href }: NavigationCardProps) {
  const navigate = () => {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div
      onClick={navigate}
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '2rem',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      }}
    >
      <h3 style={{
        margin: '0 0 0.5rem 0',
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#111827'
      }}>
        {title}
      </h3>
      <p style={{
        margin: 0,
        fontSize: '0.875rem',
        color: '#6b7280',
        lineHeight: 1.6
      }}>
        {description}
      </p>
      <div style={{
        position: 'absolute',
        bottom: '1.5rem',
        right: '1.5rem',
        fontSize: '1.5rem',
        color: '#3b82f6',
        transition: 'transform 0.3s ease'
      }}>
        →
      </div>
    </div>
  );
}

