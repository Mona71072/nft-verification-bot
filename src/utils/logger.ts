/**
 * ログユーティリティ
 * 本番環境では最小限のログ出力に制限
 */

export function logInfo(message: string, data?: any): void {
  // Logging disabled
}

export function logDebug(message: string, data?: any): void {
  // Logging disabled
}

export function logSuccess(message: string, data?: any): void {
  // Logging disabled
}

export function logWarning(message: string, data?: any): void {
  // 一時的にログを有効化（デバッグ用）
  try {
    if (data) {
      const dataInfo = typeof data === 'object' ? JSON.stringify(data) : String(data);
      console.warn(`[WARNING] ${message}`, dataInfo);
    } else {
      console.warn(`[WARNING] ${message}`);
    }
  } catch (e) {
    console.warn(`[WARNING] ${message}`, String(data));
  }
}

export function logError(message: string, error?: any): void {
  // 一時的にログを有効化（デバッグ用）
  try {
    if (error) {
      const errorInfo = {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        ...(typeof error === 'object' ? error : { value: String(error) })
      };
      console.error(`[ERROR] ${message}`, JSON.stringify(errorInfo));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  } catch (e) {
    console.error(`[ERROR] ${message}`, String(error));
  }
}
