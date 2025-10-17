import type { NFTCollection } from '../types';
import { useResponsive, getResponsiveValue } from '../hooks/useResponsive';

interface CollectionSelectorProps {
  collections: NFTCollection[];
  selectedCollections: string[];
  checkAllCollections: boolean;
  handleCheckAllCollections: (checked: boolean) => void;
  handleCollectionToggle: (collectionId: string) => void;
}

export const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  collections,
  selectedCollections,
  checkAllCollections,
  handleCheckAllCollections,
  handleCollectionToggle
}) => {
  const { deviceType, isMobile, isTablet } = useResponsive();

  if (collections.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ 
          fontWeight: '600', 
          color: '#1a1a1a', 
          marginBottom: '0.5rem',
          fontSize: getResponsiveValue('1rem', '1.0625rem', '1.125rem', deviceType)
        }}>
          Select NFT Collection
        </h3>
        <p style={{ 
          fontSize: getResponsiveValue('0.8125rem', '0.84375rem', '0.875rem', deviceType), 
          color: '#666' 
        }}>
          Choose the NFT collection you want to verify.
        </p>
      </div>
      
      {/* Select All Card */}
      <div style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '12px',
        padding: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
        marginBottom: '1rem',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: '44px', // Touch-friendly minimum size
        display: 'flex',
        alignItems: 'center'
      }}
      onClick={() => handleCheckAllCollections(!checkAllCollections)}
      onMouseEnter={(e) => {
        if (!isMobile) {
          e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isMobile) {
          e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}>
        <input
          type="checkbox"
          checked={checkAllCollections}
          onChange={(e) => handleCheckAllCollections(e.target.checked)}
          style={{ 
            marginRight: '0.75rem',
            width: '18px',
            height: '18px',
            cursor: 'pointer'
          }}
        />
        <label style={{ 
          fontSize: getResponsiveValue('0.875rem', '0.9rem', '0.875rem', deviceType), 
          color: '#1a1a1a',
          cursor: 'pointer',
          fontWeight: '500',
          flex: 1
        }}>
          Select all collections
        </label>
      </div>

      {/* Collections Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
        gap: '0.75rem'
      }}>
        {collections.map(collection => (
          <div 
            key={collection.id} 
            style={{
              background: selectedCollections.includes(collection.id) 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderRadius: '12px',
              padding: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
              border: selectedCollections.includes(collection.id)
                ? '1px solid rgba(102, 126, 234, 0.3)'
                : '1px solid rgba(148, 163, 184, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minHeight: '44px', // Touch-friendly minimum size
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={() => handleCollectionToggle(collection.id)}
            onMouseEnter={(e) => {
              if (!isMobile && !selectedCollections.includes(collection.id)) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile && !selectedCollections.includes(collection.id)) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <input
              type="checkbox"
              checked={selectedCollections.includes(collection.id)}
              onChange={() => handleCollectionToggle(collection.id)}
              style={{ 
                marginRight: '0.75rem',
                width: '18px',
                height: '18px',
                cursor: 'pointer'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: getResponsiveValue('0.875rem', '0.9rem', '0.875rem', deviceType), 
                color: selectedCollections.includes(collection.id) ? 'white' : '#1a1a1a',
                fontWeight: '500',
                marginBottom: '0.25rem'
              }}>
                {collection.name}
              </div>
              <div style={{ 
                fontSize: getResponsiveValue('0.75rem', '0.8rem', '0.75rem', deviceType), 
                color: selectedCollections.includes(collection.id) ? 'rgba(255, 255, 255, 0.8)' : '#666',
                fontWeight: '400'
              }}>
                Role: {collection.roleName}
              </div>
            </div>
            {selectedCollections.includes(collection.id) && (
              <div style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                width: '20px',
                height: '20px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: 'white' }}>
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedCollections.length > 0 && (
        <div style={{
          marginTop: '1rem',
          padding: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          fontSize: getResponsiveValue('0.75rem', '0.8rem', '0.75rem', deviceType),
          color: '#0369a1',
          fontWeight: '500'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: '0.5rem' }}>
              <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Selected Collections ({selectedCollections.length})
          </div>
          <div style={{ fontSize: getResponsiveValue('0.7rem', '0.75rem', '0.7rem', deviceType), opacity: 0.8 }}>
            {selectedCollections.map(id => collections.find(c => c.id === id)?.name).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
};

