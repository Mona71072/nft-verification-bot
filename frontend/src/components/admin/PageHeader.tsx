interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start',
      marginBottom: '2rem',
      paddingBottom: '1.5rem',
      borderBottom: '2px solid #e5e7eb'
    }}>
      <div>
        <h1 style={{ 
          margin: 0, 
          fontSize: '1.875rem', 
          fontWeight: 700, 
          color: '#111827',
          marginBottom: description ? '0.5rem' : 0
        }}>
          {title}
        </h1>
        {description && (
          <p style={{ 
            margin: 0, 
            fontSize: '0.875rem', 
            color: '#6b7280',
            lineHeight: 1.5
          }}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
}

