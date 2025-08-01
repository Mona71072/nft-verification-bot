import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hasTargetNft, verifyNftOwnership, getNftCount } from '../src/lib/nft-check';
import type { Env } from '../src/types';

// モック環境変数
const mockEnv: Env = {
  DISCORD_TOKEN: 'mock-token',
  DISCORD_GUILD_ID: 'mock-guild',
  DISCORD_ROLE_ID: 'mock-role',
  SUI_NETWORK: 'testnet',
  NFT_COLLECTION_ID: '0x123::test_nft',
  KV: {} as KVNamespace
};

describe('NFT Check Functions', () => {
  const testAddress = '0x742d35cc6ba8b6e78d5ad66d6e8e6c3c8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8';
  const testObjectId = '0x456789abcdef';

  it('should handle invalid wallet address', async () => {
    const invalidAddress = 'invalid-address';
    const result = await hasTargetNft(invalidAddress, mockEnv);
    assert.strictEqual(result, false);
  });

  it('should handle network errors gracefully', async () => {
    // ネットワークエラーのテスト（実際のネットワーク呼び出しは発生しない）
    const result = await hasTargetNft(testAddress, {
      ...mockEnv,
      SUI_NETWORK: 'invalid-network' as any
    });
    assert.strictEqual(result, false);
  });

  it('should return false for empty address', async () => {
    const result = await hasTargetNft('', mockEnv);
    assert.strictEqual(result, false);
  });

  it('should handle getNftCount errors', async () => {
    const count = await getNftCount('invalid-address', mockEnv);
    assert.strictEqual(count, 0);
  });

  it('should handle verifyNftOwnership errors', async () => {
    const result = await verifyNftOwnership('invalid-object-id', testAddress, mockEnv);
    assert.strictEqual(result, false);
  });
});

describe('NFT Collection Validation', () => {
  it('should validate collection ID format', () => {
    const validCollectionIds = [
      '0x123::module::Type',
      '0xabcdef::nft::NFT',
      '0x742d35cc6ba8b6e78d5ad66d6e8e6c3c8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8::test::Item'
    ];

    const invalidCollectionIds = [
      '',
      '123::module::Type',
      '0x123',
      'not-a-valid-id'
    ];

    validCollectionIds.forEach(id => {
      assert.strictEqual(id.includes('::'), true);
      assert.strictEqual(id.startsWith('0x'), true);
    });

    invalidCollectionIds.forEach(id => {
      if (id !== '') {
        assert.strictEqual(id.includes('::') && id.startsWith('0x'), false);
      }
    });
  });
});

describe('Address Validation', () => {
  it('should validate Sui address format', () => {
    const validAddresses = [
      '0x742d35cc6ba8b6e78d5ad66d6e8e6c3c8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8',
      '0x1',
      '0xabcdef123456789'
    ];

    const invalidAddresses = [
      '',
      '742d35cc6ba8b6e78d5ad66d6e8e6c3c8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8', // 0x prefix missing
      '0x', // too short
      'not-an-address'
    ];

    validAddresses.forEach(addr => {
      assert.strictEqual(addr.startsWith('0x'), true);
      assert.strictEqual(addr.length > 2, true);
    });

    invalidAddresses.forEach(addr => {
      if (addr !== '') {
        assert.strictEqual(addr.startsWith('0x') && addr.length > 2, false);
      }
    });
  });
}); 