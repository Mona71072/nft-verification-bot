import React from 'react';
import { useKeyboardShortcut } from '../hooks/useKeyboard';

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: '検索にフォーカス' },
  { keys: ['Esc'], description: 'モーダル/パネルを閉じる' },
  { keys: ['?'], description: 'キーボードショートカット一覧' },
  { keys: ['Tab'], description: '次の要素へ移動' },
  { keys: ['Shift', 'Tab'], description: '前の要素へ移動' },
];

export default function KeyboardShortcutsHelp() {
  const [visible, setVisible] = React.useState(false);

  useKeyboardShortcut({
    key: '?',
    shift: true,
    action: () => setVisible(!visible),
    description: 'キーボードショートカット一覧を表示'
  });

  useKeyboardShortcut({
    key: 'Escape',
    action: () => setVisible(false),
    description: 'ヘルプを閉じる'
  });

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        aria-label="キーボードショートカットを表示"
        title="キーボードショートカット (Shift + ?)"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '1px solid #d1d5db',
          background: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 600,
          color: '#374151',
          zIndex: 9998,
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#f3f4f6';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#ffffff';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        ?
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setVisible(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 32,
          maxWidth: 500,
          width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 id="shortcuts-title" style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            キーボードショートカット
          </h2>
          <button
            onClick={() => setVisible(false)}
            aria-label="閉じる"
            style={{
              border: '1px solid #d1d5db',
              background: '#ffffff',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 18,
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {shortcuts.map((shortcut, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < shortcuts.length - 1 ? '1px solid #e5e7eb' : 'none'
              }}
            >
              <span style={{ color: '#374151', fontSize: 14 }}>{shortcut.description}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    style={{
                      padding: '4px 8px',
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#111827',
                      fontFamily: 'monospace'
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 24,
          padding: 12,
          background: '#eff6ff',
          borderRadius: 8,
          fontSize: 12,
          color: '#1e40af'
        }}>
          💡 ヒント: 多くの操作はキーボードだけで完結できます
        </div>
      </div>
    </div>
  );
}

