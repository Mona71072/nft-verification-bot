import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NFTDetail {
  objectId: string;
  type: string;
  display?: {
    name?: string;
    description?: string;
    image_url?: string;
    event_date?: string;
    [key: string]: any;
  };
  owner?: any;
}

interface NFTDetailDrawerProps {
  nft: NFTDetail | null;
  open: boolean;
  onClose: () => void;
}

import { convertIpfsUrl } from '../../utils/ipfs';

// Copy to clipboard
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
};

export function NFTDetailDrawer({ nft, open, onClose }: NFTDetailDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!nft) {
    return (
      <Drawer open={false} onOpenChange={onClose}>
        <DrawerContent side="right" />
      </Drawer>
    );
  }

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Extract display attributes
  const attributes = Object.entries(nft.display || {})
    .filter(([key]) => !['name', 'description', 'image_url'].includes(key))
    .map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent side="right">
        {/* Header */}
        <DrawerHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <DrawerTitle className="text-2xl font-bold mb-1">
                {nft.display?.name || 'Unnamed NFT'}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                NFT details and information
              </DrawerDescription>
              <button
                onClick={() => handleCopy(nft.objectId, 'objectId')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono flex items-center gap-2 group"
                title="Click to copy Object ID"
              >
                <span className="truncate max-w-[200px]">{nft.objectId}</span>
                <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  {copiedField === 'objectId' ? '✓' : '📋'}
                </span>
              </button>
            </div>
            <DrawerClose className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {/* Content */}
        <ScrollArea className="flex-1 h-[calc(100vh-100px)]">
          <div className="p-6 space-y-6">
            {/* Image */}
            {nft.display?.image_url && (
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                <img
                  src={convertIpfsUrl(nft.display.image_url)}
                  alt={nft.display.name || 'NFT'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}

            {/* Description */}
            {nft.display?.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Description
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {nft.display.description}
                </p>
              </div>
            )}

            {/* Type Path */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Type
              </h3>
              <button
                onClick={() => handleCopy(nft.type, 'type')}
                className="w-full text-left p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono text-foreground break-all">
                    {nft.type}
                  </code>
                  <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    {copiedField === 'type' ? '✓ Copied' : '📋 Copy'}
                  </span>
                </div>
              </button>
            </div>

            {/* Attributes */}
            {attributes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Attributes
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {attributes.map(({ key, value }) => (
                    <div
                      key={key}
                      className="p-3 rounded-lg bg-muted"
                    >
                      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-foreground font-medium break-words">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Owner Information */}
            {nft.owner && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Owner
                </h3>
                <div className="p-3 rounded-lg bg-muted">
                  <pre className="text-xs font-mono text-foreground overflow-x-auto">
                    {JSON.stringify(nft.owner, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Sui Explorer Link */}
            <div className="pt-4 border-t border-border">
              <a
                href={`https://suiscan.xyz/mainnet/object/${nft.objectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                <span>View on Sui Explorer</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

