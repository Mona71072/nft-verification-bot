import { describe, it } from 'node:test';
import assert from 'node:assert';
import { verifySignedMessage, validateNonce, generateVerificationMessage } from '../src/lib/verify';

describe('Signature Verification', () => {
  const testAddress = '0x742d35cc6ba8b6e78d5ad66d6e8e6c3c8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8';
  const testNonce = 'test-nonce-123';
  
  it('should generate correct verification message', () => {
    const message = generateVerificationMessage(testNonce, testAddress);
    const expected = `Verify NFT ownership for Discord role.\nNonce: ${testNonce}\nAddress: ${testAddress}`;
    
    assert.strictEqual(message, expected);
  });

  it('should validate nonce correctly', () => {
    const now = Date.now();
    const validNonceData = JSON.stringify({
      nonce: testNonce,
      created_at: now - 5000, // 5秒前
      expires_at: now + 300000 // 5分後
    });

    const expiredNonceData = JSON.stringify({
      nonce: testNonce,
      created_at: now - 600000, // 10分前
      expires_at: now - 300000 // 5分前（期限切れ）
    });

    assert.strictEqual(validateNonce(testNonce, validNonceData), true);
    assert.strictEqual(validateNonce(testNonce, expiredNonceData), false);
    assert.strictEqual(validateNonce('wrong-nonce', validNonceData), false);
  });

  it('should handle invalid nonce data', () => {
    assert.strictEqual(validateNonce(testNonce, 'invalid-json'), false);
    assert.strictEqual(validateNonce(testNonce, '{}'), false);
  });

  // 注意: 実際の署名検証テストには有効な署名が必要
  it('should reject invalid signature format', async () => {
    const invalidSignature = 'not-a-valid-base64-signature';
    const result = await verifySignedMessage(testAddress, testNonce, invalidSignature);
    assert.strictEqual(result, false);
  });
});

describe('Message Generation', () => {
  it('should create consistent message format', () => {
    const nonce1 = 'nonce-1';
    const nonce2 = 'nonce-2';
    const addr = '0x123';

    const msg1a = generateVerificationMessage(nonce1, addr);
    const msg1b = generateVerificationMessage(nonce1, addr);
    const msg2 = generateVerificationMessage(nonce2, addr);

    // 同じ入力からは同じメッセージ
    assert.strictEqual(msg1a, msg1b);
    
    // 異なるナンスからは異なるメッセージ
    assert.notStrictEqual(msg1a, msg2);
  });
}); 