import React from 'react';

interface WalrusImageUploadProps {
  imageCid?: string;
  imageMimeType?: string;
  onUpload: (cid: string, mimeType: string) => void;
  apiBase?: string;
  onMessage?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export default function WalrusImageUpload({ imageCid, imageMimeType, onUpload, apiBase, onMessage }: WalrusImageUploadProps) {
  const showToast = onMessage || ((msg, type) => console.log(`[${type}] ${msg}`));
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const API_BASE = apiBase || (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('画像ファイルを選択してください', 'error');
      return;
    }

    setUploading(true);
    showToast('Walrusに画像をアップロード中...', 'info');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('epochs', '10'); // デフォルト10エポック

      const response = await fetch(`${API_BASE}/api/walrus/store`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `アップロードに失敗しました (${response.status})`);
      }

      const { blobId } = result.data || result;
      if (!blobId) throw new Error('Blob IDが返されませんでした');

      onUpload(blobId, file.type);
      showToast('画像をアップロードしました', 'success');
    } catch (error: any) {
      showToast(`アップロード失敗: ${error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (uploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (uploading) return;

    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>画像 (Walrus)</label>
      
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: dragActive ? '2px dashed #2563eb' : '2px dashed #e5e7eb',
          borderRadius: 12,
          padding: 32,
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          background: dragActive ? '#eff6ff' : imageCid ? '#f0fdf4' : '#fafafa',
          position: 'relative'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          disabled={uploading}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div>
            <div style={{
              width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb',
              borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite'
            }} />
            <div style={{ color: '#64748b' }}>アップロード中...</div>
          </div>
        ) : imageCid ? (
          <div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: 8 }}>
              画像がアップロード済み
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              Blob ID: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{imageCid}</code>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              MIME: {imageMimeType}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              クリックまたはドラッグ&ドロップで再アップロード
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              画像をドラッグ&ドロップまたはクリックして選択
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              JPG, PNG, GIF対応 • Walrusに直接アップロード
            </div>
          </div>
        )}
      </div>

      {imageCid && (
        <div style={{ marginTop: 12, padding: 12, background: '#eff6ff', borderRadius: 8, fontSize: 12 }}>
          <div style={{ color: '#1e40af', marginBottom: 4 }}>
            📌 Walrus.pdf準拠の画像管理
          </div>
          <div style={{ color: '#64748b' }}>
            • Blob IDはコンテンツアドレス（同じ画像 = 同じID）
            <br />
            • すべてのBlobは公開・探索可能
            <br />
            • 保存期間: 10エポック（約20週間）
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

