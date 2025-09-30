/**
 * 公開ストレージ警告コンポーネント
 * Walrus.pdf 準拠のセキュリティ注意喚起
 */

import React from 'react';

interface SecurityWarningProps {
  type: 'upload' | 'display' | 'general';
  onAcknowledge?: () => void;
  showAcknowledge?: boolean;
}

export const SecurityWarning: React.FC<SecurityWarningProps> = ({ 
  type, 
  onAcknowledge, 
  showAcknowledge = true 
}) => {
  const getWarningContent = () => {
    switch (type) {
      case 'upload':
        return {
          title: '⚠️ 公開ストレージ注意',
          message: 'Walrus にアップロードされる画像は全て公開され、誰でもアクセス可能です。',
          details: [
            '個人情報や機密データは含めないでください',
            '必要に応じて事前に暗号化してください',
            'アップロード後は削除できません（permanent=true の場合）'
          ]
        };
      
      case 'display':
        return {
          title: '📷 公開画像表示',
          message: 'この画像は Walrus の公開ストレージから配信されています。',
          details: [
            'URL は推測可能で、直接アクセスできます',
            '画像の内容は誰でも閲覧可能です',
            '機密情報が含まれていないかご確認ください'
          ]
        };
      
      case 'general':
        return {
          title: '🔒 セキュリティ情報',
          message: 'Walrus.pdf 準拠のストレージシステムについて',
          details: [
            '全データは公開・探索可能です',
            '暗号化が必要な場合は事前に対応してください',
            '保存期間は明示的に設定されています'
          ]
        };
      
      default:
        return {
          title: '⚠️ 注意',
          message: 'セキュリティに関する重要な情報です。',
          details: []
        };
    }
  };

  const content = getWarningContent();

  return (
    <div style={{
      backgroundColor: '#fef3c7',
      border: '1px solid #f59e0b',
      borderRadius: '8px',
      padding: '12px',
      margin: '8px 0',
      fontSize: '14px'
    }}>
      <div style={{
        fontWeight: 'bold',
        color: '#92400e',
        marginBottom: '8px'
      }}>
        {content.title}
      </div>
      
      <div style={{
        color: '#92400e',
        marginBottom: '8px'
      }}>
        {content.message}
      </div>
      
      {content.details.length > 0 && (
        <ul style={{
          margin: '0',
          paddingLeft: '20px',
          color: '#92400e'
        }}>
          {content.details.map((detail, index) => (
            <li key={index} style={{ marginBottom: '4px' }}>
              {detail}
            </li>
          ))}
        </ul>
      )}
      
      {showAcknowledge && onAcknowledge && (
        <button
          onClick={onAcknowledge}
          style={{
            marginTop: '8px',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          理解しました
        </button>
      )}
    </div>
  );
};

/**
 * アップロード前の警告表示
 */
export const UploadSecurityWarning: React.FC<{ onAcknowledge: () => void }> = ({ onAcknowledge }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        margin: '20px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <SecurityWarning 
          type="upload" 
          onAcknowledge={onAcknowledge}
          showAcknowledge={true}
        />
      </div>
    </div>
  );
};

export default SecurityWarning;
