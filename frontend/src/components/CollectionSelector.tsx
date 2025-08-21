import type { NFTCollection } from '../types';

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
  if (collections.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>Select NFT Collection</h3>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
        Choose the NFT collection you want to verify.
        </p>
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.875rem', color: '#666', marginRight: '0.5rem' }}>
          Select all
        </label>
        <input
          type="checkbox"
          checked={checkAllCollections}
          onChange={(e) => handleCheckAllCollections(e.target.checked)}
          style={{ marginRight: '0.5rem' }}
        />
      </div>
      {collections.map(collection => (
        <div key={collection.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input
            type="checkbox"
            checked={selectedCollections.includes(collection.id)}
            onChange={() => handleCollectionToggle(collection.id)}
            style={{ marginRight: '0.5rem' }}
          />
          <label style={{ fontSize: '0.875rem', color: '#1a1a1a' }}>
            {collection.name} - {collection.roleName}
          </label>
        </div>
      ))}
      {selectedCollections.length > 0 && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          background: '#f9fafb',
          borderRadius: '4px',
          fontSize: '0.75rem',
          color: '#666'
        }}>
          Selected: {selectedCollections.map(id => collections.find(c => c.id === id)?.name).join(', ')}
        </div>
      )}
    </div>
  );
};

