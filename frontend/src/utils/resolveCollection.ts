/**
 * 共通コレクション解決ユーティリティ
 * 全タブで統一的にNFT→コレクション、イベント→コレクションのマッチングを行う
 */

export interface CollectionLike {
  id: string;
  name: string;
  packageId?: string;
  typePath?: string;
  displayName?: string;
  originalId?: string;
  roleId?: string;
}

interface OwnedNFTLike {
  type: string;
  display?: {
    name?: string;
    collection_name?: string;
    [key: string]: unknown;
  };
}

interface EventLike {
  selectedCollectionId?: string;
  collectionName?: string;
  collectionId?: string;
}

/**
 * NFT からコレクションを解決する。
 * 優先順位:
 *   1. collection_name による名前一致
 *   2. nft.type による完全一致（id, packageId, typePath, originalId, roleId）
 */
export function resolveCollectionForNFT(
  nft: OwnedNFTLike | undefined,
  collections: CollectionLike[]
): CollectionLike | undefined {
  if (!nft) return undefined;

  const collectionName = nft.display?.collection_name?.trim().toLowerCase();
  if (collectionName) {
    for (const col of collections) {
      const colName = (col.name || '').trim().toLowerCase();
      const display = (col.displayName || col.name || '').trim().toLowerCase();
      if (colName === collectionName || display === collectionName) {
        return col;
      }
    }
  }

  const nftType = nft.type;
  if (!nftType) return undefined;

  for (const col of collections) {
    const ids = [col.id, col.packageId, col.typePath, col.originalId, col.roleId]
      .filter((v): v is string => Boolean(v));
    if (ids.includes(nftType)) {
      return col;
    }
  }

  return undefined;
}

/**
 * イベントからコレクションを解決する。
 * 優先順位:
 *   1. selectedCollectionId（直接一致）
 *   2. collectionName による名前一致
 *   3. collectionId による完全一致（id, packageId, typePath, originalId, roleId）
 */
export function resolveCollectionForEvent(
  event: EventLike | undefined,
  collections: CollectionLike[]
): CollectionLike | undefined {
  if (!event) return undefined;

  const collectionMap = new Map<string, CollectionLike>();
  for (const col of collections) {
    collectionMap.set(col.id, col);
  }

  if (event.selectedCollectionId && collectionMap.has(event.selectedCollectionId)) {
    return collectionMap.get(event.selectedCollectionId);
  }

  const name = event.collectionName?.trim().toLowerCase();
  if (name) {
    for (const col of collections) {
      const colName = (col.name || '').trim().toLowerCase();
      const display = (col.displayName || col.name || '').trim().toLowerCase();
      if (colName === name || display === name) {
        return col;
      }
    }
  }

  const colId = event.collectionId;
  if (colId) {
    if (collectionMap.has(colId)) {
      return collectionMap.get(colId);
    }
    for (const col of collections) {
      const ids = [col.id, col.packageId, col.typePath, col.originalId, col.roleId]
        .filter((v): v is string => Boolean(v));
      if (ids.includes(colId)) {
        return col;
      }
    }
  }

  return undefined;
}

/**
 * コレクションの表示名を取得
 */
export function getCollectionDisplayName(col: CollectionLike): string {
  return col.displayName || col.name || col.id;
}
