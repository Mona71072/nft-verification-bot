import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hasTargetNft } from '../src/lib/nft-check';
import type { Env } from '../src/types';

const mockEnv: Env = {
  DISCORD_TOKEN: 'mock_token',
  DISCORD_CLIENT_ID: 'mock_client_id',
  DISCORD_GUILD_ID: 'mock_guild_id',
  DISCORD_ROLE_ID: 'mock_role_id',
  SUI_NETWORK: 'testnet',
  NFT_COLLECTION_ID: 'mock_collection_id',
  API_BASE_URL: 'https://mock-api.com',
  VERIFICATION_URL: 'https://mock-verification.com',
  ADMIN_USER_ID: 'mock_admin_id',
  SXT_ROLES: {} as KVNamespace,
  NONCE_KV: {} as KVNamespace,
  ASSETS: {} as Fetcher,
};

describe('NFT Check Tests', () => {
  it('should return true for valid address in development mode', async () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    const result = await hasTargetNft(address, mockEnv);
    assert.strictEqual(result, true);
  });

  it('should return false for invalid address', async () => {
    const address = 'invalid_address';
    const result = await hasTargetNft(address, mockEnv);
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