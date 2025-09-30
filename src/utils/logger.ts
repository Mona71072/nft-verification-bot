/**
 * ログユーティリティ
 * 本番環境では最小限のログ出力に制限
 */

export function logInfo(message: string, data?: any): void {
  // 本番環境では情報ログを無効化
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data || '');
  }
}

export function logDebug(message: string, data?: any): void {
  // デバッグログは本番環境では無効化
  if (process.env.NODE_ENV !== 'production') {
    console.debug(message, data || '');
  }
}

export function logSuccess(message: string, data?: any): void {
  // 成功ログは本番環境でも出力
  console.log(`✅ ${message}`, data || '');
}

export function logWarning(message: string, data?: any): void {
  console.warn(`⚠️ ${message}`, data || '');
}

export function logError(message: string, error?: any): void {
  console.error(`❌ ${message}`, error || '');
}
