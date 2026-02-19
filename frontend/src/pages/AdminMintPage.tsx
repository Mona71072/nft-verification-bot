import { ToastProvider } from '../components/ui/ToastProvider';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import { useUrlQueryParams } from '../hooks/useUrlQueryParams';
import { 
  PageHeader, 
  CollectionTypeFilter, 
  MintManagementSection, 
  AdminPageLayout 
} from '../components';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function AdminMintPageInner() {
  const [query, setQuery] = useUrlQueryParams();

  const handleCollectionTypeChange = (value: string) => {
    setQuery((prev) => ({ ...prev, collectionType: value }));
  };

  return (
    <AdminPageLayout>
      <PageHeader 
        title="ミント管理" 
        subtitle="NFTミントの状況を確認・管理できます"
      />

      <CollectionTypeFilter
        value={query.collectionType || ''}
        onChange={handleCollectionTypeChange}
        apiBaseUrl={API_BASE_URL}
      />

      <MintManagementSection
        apiBaseUrl={API_BASE_URL}
        query={query}
        onQueryChange={setQuery}
      />
      
      <KeyboardShortcutsHelp />
    </AdminPageLayout>
  );
}

export default function AdminMintPage() {
  return (
    <ToastProvider>
      <AdminMintPageInner />
    </ToastProvider>
  );
}


