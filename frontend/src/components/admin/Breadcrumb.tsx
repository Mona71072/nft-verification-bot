interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const navigate = (href: string) => {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <nav style={{ marginBottom: '1.5rem' }}>
      <ol style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        listStyle: 'none',
        padding: 0,
        margin: 0,
        fontSize: '0.875rem'
      }}>
        {items.map((item, index) => (
          <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {index > 0 && (
              <span style={{ color: '#d1d5db' }}>/</span>
            )}
            {item.href ? (
              <button
                onClick={() => navigate(item.href!)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
              >
                {item.label}
              </button>
            ) : (
              <span style={{ color: '#111827', fontWeight: 600 }}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

