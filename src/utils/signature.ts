/**
 * 署名検証ユーティリティ
 * 既存の署名検証ロジックを抽出・整理
 */

import * as ed25519 from '@noble/ed25519';
import { blake2b } from '@noble/hashes/blake2b';
import { sha512 } from '@noble/hashes/sha512';
import { logDebug, logError, logWarning } from './logger';

// noble-ed25519 が内部で使用する SHA-512 を設定（Workers環境向け）
{
  const edAny: any = ed25519 as any;
  if (edAny && edAny.etc && typeof edAny.etc.sha512Sync !== 'function') {
    edAny.etc.sha512Sync = (msg: Uint8Array) => sha512(msg);
  }
}

export interface SignatureData {
  signature: string | Uint8Array;
  bytes: string | Uint8Array;
  publicKey?: string | Uint8Array;
}

function fromBase64(base64: string): Uint8Array {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function toUint8Array(input: any): Uint8Array | null {
  try {
    if (!input) return null;
    if (input instanceof Uint8Array) return input;
    if (Array.isArray(input)) return new Uint8Array(input);
    if (typeof input === 'string') return fromBase64(input);
    if (typeof input === 'object') {
      // 数値キーを昇順で取り出してUint8Arrayへ（JSON化されたTypedArray対策）
      const keys = Object.keys(input).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
      if (keys.length > 0) {
        const values = keys.map(k => input[k] as number);
        return new Uint8Array(values);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// BCS: ULEB128 で長さをエンコード（vector<u8> のプレフィックス用）
function encodeUleb128(value: number): Uint8Array {
  const out: number[] = [];
  let v = value >>> 0; // ensure unsigned
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return new Uint8Array(out);
}

export async function verifySignedMessage(
  signatureData: SignatureData, 
  expectedMessageBytes: Uint8Array | null
): Promise<boolean> {
  const verificationStartTime = Date.now();
  
  try {
    if (!signatureData) {
      logError('SignatureData is null or undefined');
      return false;
    }
    
    // ウォレット形式の推定
    const walletHints = [];
    if (signatureData?.signature) {
      const sigStr = String(signatureData.signature);
      if (sigStr.length === 88) walletHints.push('Slash (88 chars)');
      if (sigStr.length === 128) walletHints.push('Suiet (128 chars)');
      if (sigStr.length === 184) walletHints.push('SerializedSignature (184 chars)');
    }
    
    logDebug('Signature data received', {
      hasSignature: !!signatureData?.signature,
      hasBytes: !!signatureData?.bytes,
      hasPublicKey: !!signatureData?.publicKey,
      signatureType: typeof signatureData?.signature,
      bytesType: typeof signatureData?.bytes,
      publicKeyType: typeof signatureData?.publicKey,
      signatureLength: String(signatureData?.signature || '').length,
      bytesLength: signatureData?.bytes ? 
        (typeof signatureData.bytes === 'string' ? signatureData.bytes.length : signatureData.bytes.length) : 0,
      estimatedWallet: walletHints.length > 0 ? walletHints.join(', ') : 'Unknown'
    });

    const { signature, bytes, publicKey } = signatureData ?? {};

    if (!signature || !bytes) {
      logError('Missing signature or bytes', { 
        hasSignature: !!signature, 
        hasBytes: !!bytes 
      });
      return false;
    }

    // ウォレットから送信されたbytesを直接使用
    const receivedDecoded = toUint8Array(bytes);
    if (!receivedDecoded) {
      logError('Invalid bytes payload', { 
        bytesType: typeof bytes, 
        bytesLength: bytes?.length 
      });
      return false;
    }

    logDebug('Bytes decoded successfully', {
      originalLength: typeof bytes === 'string' ? bytes.length : bytes?.length,
      decodedLength: receivedDecoded.length,
      decodedFirst16: Array.from(receivedDecoded.slice(0, 16))
    });

    // メッセージ候補を生成（より多くのパターンに対応）
    const candidateMessages: Array<{ name: string; data: Uint8Array }> = [];
    
    // 候補1: サーバーが期待するメッセージ
    if (expectedMessageBytes) {
      candidateMessages.push({ name: 'expectedBytes', data: expectedMessageBytes });
    }
    
    // 候補2: ウォレットから受信したbytes（デコード済み）
    candidateMessages.push({ name: 'receivedDecoded', data: receivedDecoded });
    
    // 候補3: bytesがBase64文字列としてASCIIエンコードされている場合
    if (typeof bytes === 'string') {
      try {
        const receivedAscii = new TextEncoder().encode(bytes);
        candidateMessages.push({ name: 'receivedAscii', data: receivedAscii });
      } catch {
        logDebug('Failed to encode bytes as ASCII');
      }
    }
    
    // 候補4: UTF-8エンコーディングの試行
    if (typeof bytes === 'string') {
      try {
        const utf8Bytes = new TextEncoder().encode(bytes);
        if (utf8Bytes.length !== receivedDecoded.length) { // 重複を避ける
          candidateMessages.push({ name: 'receivedUTF8', data: utf8Bytes });
        }
      } catch {
        logDebug('Failed to encode bytes as UTF-8');
      }
    }
    
    // 候補5: HEX文字列として解釈（0xプレフィックスありなし両方）
    if (typeof bytes === 'string' && bytes.length > 2) {
      try {
        // HEX文字列をUint8Arrayに変換するヘルパー関数
        const hexToBytes = (hex: string): Uint8Array => {
          const cleanHex = hex.replace(/^0x/, '');
          const bytes = new Uint8Array(cleanHex.length / 2);
          for (let i = 0; i < cleanHex.length; i += 2) {
            bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
          }
          return bytes;
        };
        
        // 0xプレフィックス付きの場合
        if (bytes.startsWith('0x') && bytes.length % 2 === 0) {
          const hexBytes = hexToBytes(bytes);
          candidateMessages.push({ name: 'receivedHex0x', data: hexBytes });
        }
        // 0xプレフィックスなしの場合
        else if (!bytes.startsWith('0x') && bytes.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(bytes)) {
          const hexBytes = hexToBytes('0x' + bytes);
          candidateMessages.push({ name: 'receivedHexPlain', data: hexBytes });
        }
      } catch {
        logDebug('Failed to parse bytes as hex');
      }
    }
    
    logDebug('Generated message candidates', {
      totalCandidates: candidateMessages.length,
      candidateNames: candidateMessages.map(c => c.name),
      candidateLengths: candidateMessages.map(c => c.data.length)
    });

    // 署名・公開鍵の抽出（スラッシュウォレット対応）
    const rawSig = toUint8Array(signature);
    if (!rawSig) {
      logError('Invalid signature format', {
        signatureType: typeof signature,
        rawSigExists: false
      });
      return false;
    }

    logDebug('Raw signature extracted', {
      length: rawSig.length,
      first16: Array.from(rawSig.slice(0, 16)),
      last16: Array.from(rawSig.slice(-16))
    });

    let sigBytes: Uint8Array | null = null;
    let pubBytes: Uint8Array | null = null;

    // 優先: body.publicKey を利用（32 or 33bytes想定）
    if (publicKey) {
      const pk = toUint8Array(publicKey);
      if (pk) {
        logDebug('Public key extracted', {
          length: pk.length,
          first8: Array.from(pk.slice(0, 8)),
          willTrimScheme: pk.length === 33
        });
        // 先頭1バイトがスキームの場合(33bytes) → 取り除く
        pubBytes = pk.length === 33 ? pk.slice(1) : pk;
      } else {
        logWarning('Public key provided but could not be converted to Uint8Array');
      }
    } else {
      logDebug('No public key provided - will extract from signature');
    }

    // ケース1: 純粋な64byte署名（publicKeyは別途提供される必要あり）
    if (rawSig.length === 64) {
      logDebug('Detected 64-byte signature format');
      if (!pubBytes) {
        logError('64-byte signature provided but publicKey is missing', {
          signatureLength: rawSig.length,
          hasPublicKey: !!pubBytes
        });
        return false;
      }
      sigBytes = rawSig;
      logDebug('Using 64-byte signature directly');
    }

    // ケース2: scheme(1)+signature(64) の65byte（publicKeyは別途提供される必要あり）
    if (!sigBytes && rawSig.length === 65) {
      const scheme = rawSig[0];
      logDebug('Detected 65-byte signature format', { scheme: `0x${scheme.toString(16)}` });
      if (scheme !== 0x00) {
        logError(`Unsupported signature scheme for 65-byte sig: ${scheme}`, {
          schemeHex: `0x${scheme.toString(16)}`,
          expected: '0x00 (Ed25519)'
        });
        return false;
      }
      if (!pubBytes) {
        logError('65-byte (scheme+sig) provided but publicKey is missing', {
          signatureLength: rawSig.length,
          hasPublicKey: !!pubBytes
        });
        return false;
      }
      sigBytes = rawSig.slice(1, 65);
      logDebug('Extracted signature from 65-byte format (trimmed scheme)');
    }

    // ケース3: SerializedSignature (scheme(1)+signature(64)+publicKey(32 or 33))
    if (!sigBytes && rawSig.length >= 1 + 64 + 32) {
      const scheme = rawSig[0];
      logDebug('Detected SerializedSignature format', { 
        scheme: `0x${scheme.toString(16)}`,
        totalLength: rawSig.length,
        expectedMinLength: 1 + 64 + 32,
        expectedMaxLength: 1 + 64 + 33
      });
      
      if (scheme !== 0x00) {
        logError(`Unsupported signature scheme: ${scheme}`, {
          schemeHex: `0x${scheme.toString(16)}`,
          expected: '0x00 (Ed25519)'
        });
        return false;
      }
      
      sigBytes = rawSig.slice(1, 1 + 64);
      
      // 公開鍵の抽出（末尾32または33バイト）
      if (rawSig.length === 1 + 64 + 32) {
        // 32バイト公開鍵
        pubBytes = rawSig.slice(1 + 64, 1 + 64 + 32);
        logDebug('Extracted 32-byte public key from SerializedSignature');
      } else if (rawSig.length === 1 + 64 + 33) {
        // 33バイト公開鍵（先頭1バイトはスキーム）
        const pubWithScheme = rawSig.slice(1 + 64, 1 + 64 + 33);
        if (pubWithScheme[0] === 0x00) {
          pubBytes = pubWithScheme.slice(1);
          logDebug('Extracted 32-byte public key from 33-byte (trimmed scheme)');
        } else {
          logError(`Unexpected public key scheme in 33-byte format: ${pubWithScheme[0]}`);
          return false;
        }
      } else {
        logError(`Unexpected SerializedSignature length: ${rawSig.length}`, {
          expectedLengths: [1 + 64 + 32, 1 + 64 + 33],
          actualLength: rawSig.length
        });
        return false;
      }
    }

    if (!sigBytes || !pubBytes) {
      logError('Failed to extract signature and public key', {
        hasSignatureBytes: !!sigBytes,
        hasPublicKeyBytes: !!pubBytes,
        rawSignatureLength: rawSig.length
      });
      return false;
    }

    logDebug('Final signature and public key', {
      signatureLength: sigBytes.length,
      publicKeyLength: pubBytes.length,
      signatureFirst8: Array.from(sigBytes.slice(0, 8)),
      publicKeyFirst8: Array.from(pubBytes.slice(0, 8))
    });

    // 各メッセージ候補で署名検証を試行
    for (const candidate of candidateMessages) {
      try {
        logDebug(`Trying verification with candidate: ${candidate.name}`, {
          messageLength: candidate.data.length,
          messageFirst16: Array.from(candidate.data.slice(0, 16))
        });

        // メッセージのハッシュ化（Ed25519検証用）
        const messageHash = blake2b(candidate.data, { dkLen: 32 });
        
        // Ed25519署名検証
        const isValid = ed25519.verify(sigBytes, messageHash, pubBytes);
        
        if (isValid) {
          logDebug(`Signature verification succeeded with candidate: ${candidate.name}`);
          return true;
        } else {
          logDebug(`Signature verification failed with candidate: ${candidate.name}`);
        }
      } catch (error) {
        logDebug(`Verification error with candidate ${candidate.name}:`, error);
      }
    }

    logError('All signature verification attempts failed');
    return false;

  } catch (error) {
    logError('Signature verification error', error);
    return false;
  } finally {
    const verificationTime = Date.now() - verificationStartTime;
    logDebug(`Signature verification took ${verificationTime}ms`);
  }
}
