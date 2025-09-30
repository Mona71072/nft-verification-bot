import React, { useState, useEffect } from 'react';
import type { DmSettings, DmMode } from './types';

import type { NFTCollection, DiscordRole, BatchConfig, BatchStats, VerifiedUser, AdminMintEvent } from './types';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { getImageDisplayUrl } from './utils/walrus';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

type AdminMode = 'admin' | 'roles' | 'mint' | undefined;

function AdminPanel({ mode }: { mode?: AdminMode }) {
  const { account, connected, signPersonalMessage } = useWalletWithErrorHandling() as any;
  
  // スピンアニメーション用のCSS
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingCollection, setEditingCollection] = useState<NFTCollection | null>(null);
  
  // バッチ処理関連の状態
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'collections' | 'events' | 'batch' | 'users' | 'admins' | 'dm-settings' | 'history'>(
    mode === 'mint' ? 'events' : mode === 'admin' ? 'admins' : 'collections'
  );

  // 表示タブをmodeで制限
  const allowedTabs: Array<'collections' | 'events' | 'batch' | 'users' | 'admins' | 'dm-settings' | 'history'> =
    mode === 'mint'
      ? ['events', 'history']
      : mode === 'roles'
      ? ['collections', 'batch', 'users', 'dm-settings']
      : ['collections', 'events', 'batch', 'users', 'admins', 'dm-settings', 'history']; // admin mode: 全タブアクセス可能

  // Events 管理用ステート
  const [events, setEvents] = useState<AdminMintEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<AdminMintEvent | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<AdminMintEvent>>({
    name: '',
    description: '',
    collectionId: '',
    imageUrl: '',
    active: true,
    startAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    moveCall: { target: '', typeArguments: [], argumentsTemplate: ['{recipient}', '{imageCid}', '{imageMimeType}'], gasBudget: 20000000 },
    totalCap: undefined
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // コレクション作成UI用ステート
  const [createColName, setCreateColName] = useState<string>('');
  const [createColSymbol, setCreateColSymbol] = useState<string>('');
  const [createColTypePath, setCreateColTypePath] = useState<string>('');
  const [creatingCollection, setCreatingCollection] = useState<boolean>(false);
  const [createColMessage, setCreateColMessage] = useState<string>('');
  const [createColResult, setCreateColResult] = useState<any>(null);

  // パッケージ公開（本番）用ステート
  const [artifactModules, setArtifactModules] = useState<string[] | null>(null);
  const [artifactDeps, setArtifactDeps] = useState<string[] | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishMessage, setPublishMessage] = useState<string>('');
  const [publishResult, setPublishResult] = useState<any>(null);

  const handleArtifactChange = async (file: File | null) => {
    try {
      setArtifactModules(null);
      setArtifactDeps(null);
      setPublishMessage('');
      setPublishResult(null);
      if (!file) return;
      const text = await file.text();
      const json = JSON.parse(text);
      const modules = Array.isArray(json.modules) ? json.modules : null;
      const deps = Array.isArray(json.dependencies) ? json.dependencies : null;
      if (!modules || !deps) {
        setPublishMessage('不正なアーティファクトです（modules/dependenciesが見つかりません）');
        return;
      }
      setArtifactModules(modules);
      setArtifactDeps(deps);
      setPublishMessage(`読み込み完了: modules=${modules.length}, dependencies=${deps.length}`);
    } catch (e: any) {
      setPublishMessage(e?.message || 'アーティファクトの読み込みに失敗しました');
    }
  };

  const handlePublishPackage = async () => {
    try {
      if (publishing) return;
      if (!connected || !account?.address) { setPublishMessage('ウォレットを接続してください'); return; }
      if (!artifactModules || !artifactDeps) { setPublishMessage('アーティファクト（build.artifacts.json）を選択してください'); return; }
      setPublishing(true);
      setPublishMessage('パッケージ公開中...');
      setPublishResult(null);

      const timestamp = new Date().toISOString();
      const authMessage = `SXT Admin Publish\naddress=${account.address}\ntimestamp=${timestamp}`;
      const msgBytes = new TextEncoder().encode(authMessage);
      const sig = typeof signPersonalMessage === 'function' ? await signPersonalMessage({ message: msgBytes }) : null;
      const signature = sig?.signature;
      const bytes = sig?.bytes;
      const publicKey = (sig as any)?.publicKey ?? (account as any)?.publicKey;
      try { localStorage.setItem('currentWalletAddress', account.address); } catch {}

      const resp = await fetch(`${API_BASE_URL}/api/admin/publish`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ modules: artifactModules, dependencies: artifactDeps, gasBudget: 100_000_000, signature, bytes, publicKey, authMessage })
      });
      const data = await resp.json();
      if (!data?.success) {
        setPublishMessage(data?.error || '公開に失敗しました');
      } else {
        setPublishMessage('公開に成功しました');
        setPublishResult(data);
      }
    } catch (e: any) {
      setPublishMessage(e?.message || 'エラーが発生しました');
    } finally {
      setPublishing(false);
    }
  };

  const proposeSymbol = (name: string | undefined) => {
    if (!name) return '';
    const ascii = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return ascii.slice(0, 6) || 'EVENT';
  };

  const handleCreateCollectionViaMove = async () => {
    try {
      if (creatingCollection) return;
      if (!connected || !account?.address) {
        setCreateColMessage('ウォレットを接続してください');
        return;
      }
      setCreatingCollection(true);
      setCreateColMessage('コレクション作成中...');
      setCreateColResult(null);

      // 認証メッセージ（管理操作）と署名
      const timestamp = new Date().toISOString();
      const authMessage = `SXT Admin Collection Create\naddress=${account.address}\ntimestamp=${timestamp}`;
      const msgBytes = new TextEncoder().encode(authMessage);
      const sig = typeof signPersonalMessage === 'function' ? await signPersonalMessage({ message: msgBytes }) : null;
      const signature = sig?.signature;
      const bytes = sig?.bytes;
      const publicKey = (sig as any)?.publicKey ?? (account as any)?.publicKey;
      try { localStorage.setItem('currentWalletAddress', account.address); } catch {}

      const body: any = {
        name: createColName || (newEvent.name || 'Event Collection'),
        symbol: createColSymbol || proposeSymbol(newEvent.name),
        imageCid: (newEvent as any).imageCid || '',
        imageMimeType: (newEvent as any).imageMimeType || '',
        typePath: createColTypePath || undefined,
        signature,
        bytes,
        publicKey,
        authMessage
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/collections/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data?.success) {
        setCreateColMessage(data?.error || 'コレクション作成に失敗しました');
      } else {
        setCreateColMessage('コレクションを作成しました');
        setCreateColResult(data);
        try { await fetchCollections(); } catch {}
      }
    } catch (e: any) {
      setCreateColMessage(e?.message || 'エラーが発生しました');
    } finally {
      setCreatingCollection(false);
    }
  };

  // Walrus アップロードUI用
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);


  const resolveCidFromResponse = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    const candidates = ['cid', 'hash', 'digest', 'id'];
    for (const key of candidates) {
      if (typeof obj[key] === 'string' && obj[key]) return obj[key];
    }
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      if (v && typeof v === 'object') {
        for (const key of candidates) {
          if (typeof v[key] === 'string' && v[key]) return v[key];
        }
      }
    }
    return null;
  };

  // 画像自動圧縮（512KB以下に、より積極的）
  const compressImage = async (file: File): Promise<File> => {
    const maxSize = 512 * 1024; // 512KB（より厳しく）
    if (file.size <= maxSize) return file;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // より小さく縮小（最大800x600）
        const maxW = 800, maxH = 600;
        let { width, height } = img;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // より低い品質から開始、512KB以下になるまで調整
        let quality = 0.7;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (blob) {
              console.log(`Compression attempt: quality=${quality}, size=${Math.round(blob.size/1024)}KB`);
              if (blob.size <= maxSize || quality <= 0.05) {
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
                console.log(`Final compressed: ${Math.round(compressedFile.size/1024)}KB`);
                resolve(compressedFile);
              } else {
                quality -= 0.05; // より細かく調整
                tryCompress();
              }
            } else {
              resolve(file); // フォールバック
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      
      img.onerror = () => resolve(file); // エラー時はそのまま
      img.src = URL.createObjectURL(file);
    });
  };

  const handleWalrusUpload = async () => {
    try {
      if (!uploadFile) { setMessage('アップロードする画像ファイルを選択してください'); return; }
      
      setUploading(true);
      setMessage('画像を処理中...');
      console.log(`Original file: ${uploadFile.name}, size: ${Math.round(uploadFile.size/1024)}KB`);
      
      // 自動圧縮（512KB以下に）
      const compressedFile = await compressImage(uploadFile);
      if (compressedFile.size !== uploadFile.size) {
        setMessage(`画像を圧縮しました: ${Math.round(uploadFile.size/1024)}KB → ${Math.round(compressedFile.size/1024)}KB`);
      }
      console.log(`Using file: ${compressedFile.name}, size: ${Math.round(compressedFile.size/1024)}KB, type: ${compressedFile.type}`);
      
      setMessage('アップロード中...');
      
      // Workersのプロキシ経由でアップロード
      const endpoint = `${API_BASE_URL}/api/walrus/upload`;

      // プロキシ経由（Workersがtip処理）
      const form = new FormData();
      form.append('file', compressedFile);
      const res = await fetch(endpoint, { method: 'POST', body: form });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`Upload failed (${res.status}): ${t}`);
      }
      const data = await res.json().catch(() => ({}));
      const cid = resolveCidFromResponse(data);
      const returnedUrl = (data && (data.url || data.gatewayUrl)) as string | undefined;
      let finalUrl = '';
      if (returnedUrl && /^https?:\/\//.test(returnedUrl)) {
        finalUrl = returnedUrl;
      } else if (cid) {
        // Walrus.pdf準拠のAggregator API URL生成
        const base = 'https://aggregator.mainnet.walrus.space/v1/blobs/';
        finalUrl = `${base}${cid}`;
      }

      if (!finalUrl && cid) {
        // 最低限CIDは保持
        finalUrl = cid;
      }

      if (!finalUrl) {
        setMessage('アップロードは成功しましたがURLを特定できませんでした。手動で設定してください。');
      } else {
        // CIDとURLの両方を設定（CID優先の運用）
        const updates = {
          imageUrl: finalUrl,
          imageCid: cid || '',
          imageMimeType: compressedFile.type || 'application/octet-stream'
        };
        if (editingEvent) setEditingEvent({ ...(editingEvent as AdminMintEvent), ...updates });
        else setNewEvent({ ...newEvent, ...updates });
        setMessage(`画像アップロード完了: ${cid ? `CID=${cid}` : 'URL設定済み'}`);
      }
    } catch (e: any) {
      setMessage(e?.message || 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };


  // カウントダウン用（1秒ごとに更新）
  const [nowTs, setNowTs] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // WorkersのWalrus設定を取得し、自動適用（初回）
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/walrus/config`);
        const data = await res.json();
        if (data?.success) {
          // ゲートウェイ設定は固定値を使用
          // uploadはプロキシを標準にするため、空のままでもOK
        }
      } catch {}
    })();
  }, []);

  // 認証済みユーザー関連の状態
  const [verifiedUsers, setVerifiedUsers] = useState<VerifiedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // 管理者関連の状態
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // DM通知設定
  const [dmSettings, setDmSettings] = useState<DmSettings | null>(null);
  const [dmEditing, setDmEditing] = useState(false);
  const [editingDm, setEditingDm] = useState<DmSettings | null>(null);

  const [newCollection, setNewCollection] = useState({
    name: '',
    packageId: '',
    roleId: '',
    roleName: '',
    description: ''
  });

  // メッセージを5秒後に自動で消すためのuseEffect
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  // 管理者認証ヘッダーを生成
  const getAuthHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const addr = localStorage.getItem('currentWalletAddress');
      if (addr) headers['X-Admin-Address'] = addr;
    } catch {}
    return headers;
  };

  const fetchCollections = async () => {
    try {
      // ミント用コレクションを取得
      const response = await fetch(`${API_BASE_URL}/api/mint-collections`);
      const data = await response.json();
      if (data.success) {
        setCollections(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  };

  // Discordロール取得
  const fetchDiscordRoles = async () => {
    try {
      console.log('🔄 Fetching Discord roles...');
      const response = await fetch(`${API_BASE_URL}/api/discord/roles`);
      const data = await response.json();
      if (data.success) {
        setDiscordRoles(data.data);
        console.log(`✅ Loaded ${data.data.length} Discord roles`);
      } else {
        console.error('❌ Failed to fetch Discord roles:', data.error);
      }
    } catch (error) {
      console.error('❌ Error fetching Discord roles:', error);
    }
  };

  // Events 取得
  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch (e) {
      console.error('❌ Failed to fetch events', e);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent?.name || !newEvent?.collectionId || !newEvent?.startAt || !newEvent?.endAt) {
      setMessage('必須項目（イベント名・コレクション・開始/終了）を入力してください');
      return;
    }

    setLoading(true);
    setMessage('🔄 イベントを作成中...');

    try {
      // 1. 画像自動アップロード＆BLOB登録（未設定の場合）
      if (!((newEvent as any).imageUrl) && !((newEvent as any).imageCid) && uploadFile) {
        setMessage('🔄 画像をWalrusにアップロード中...（約30秒かかります）');
        
        try {
          // 画像圧縮（高速化）
          setMessage('🔄 画像を圧縮中...');
          const compressedFile = await compressImage(uploadFile);
          setMessage('🔄 Walrusにアップロード中...（BLOB登録含む）');
          
          const form = new FormData();
          form.append('file', compressedFile);
          
          // タイムアウトを60秒に設定
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          
          const uploadRes = await fetch(`${API_BASE_URL}/api/walrus/upload`, {
            method: 'POST',
            body: form,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!uploadRes.ok) {
            throw new Error(`アップロード失敗 (${uploadRes.status}): ${await uploadRes.text()}`);
          }
          
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.data) {
            const cid = uploadData.data.blob_id || uploadData.data.blobId;
            if (cid) {
              (newEvent as any).imageCid = cid;
              (newEvent as any).imageMimeType = compressedFile.type || 'application/octet-stream';
              (newEvent as any).imageUrl = `https://aggregator.mainnet.walrus.space/v1/blobs/${cid}`;
              setMessage('✅ 画像アップロード完了！BLOB登録済み');
            }
          } else {
            throw new Error(uploadData.error || '画像アップロードに失敗しました');
          }
        } catch (uploadError: any) {
          console.error('Image upload error:', uploadError);
          
          // ユーザーフレンドリーなエラーメッセージ
          let userMessage = uploadError.message;
          if (uploadError.message?.includes('reserved for another transaction') || 
              uploadError.message?.includes('object is locked') ||
              uploadError.message?.includes('quorum of validators')) {
            userMessage = '⏳ ネットワークが混雑しています。少し待ってから再試行してください。';
          } else if (uploadError.message?.includes('502') || uploadError.message?.includes('Bad Gateway')) {
            userMessage = '🔄 サーバーが一時的に利用できません。しばらく待ってから再試行してください。';
          } else if (uploadError.message?.includes('timeout')) {
            userMessage = '⏰ アップロードがタイムアウトしました。ネットワーク接続を確認してください。';
          }
          
          setMessage(`❌ 画像アップロードエラー: ${userMessage}`);
          
          // リトライ可能なエラーの場合、リトライボタンを表示
          if (uploadError.message?.includes('reserved for another transaction') || 
              uploadError.message?.includes('object is locked') ||
              uploadError.message?.includes('quorum of validators') ||
              uploadError.message?.includes('502')) {
            
            // 3秒後に自動リトライを提案
            setTimeout(() => {
              if (confirm('🔄 自動でリトライしますか？（キャンセルで手動操作に戻ります）')) {
                handleCreateEvent(); // 再実行
              }
            }, 3000);
          }
          
          setLoading(false);
          return;
        }
      }

      // 2. Moveターゲットの自動補完
      if (!newEvent?.moveCall?.target) {
        setMessage('🔄 Move設定を準備中...');
        try {
          const mt = await fetch(`${API_BASE_URL}/api/move-targets`).then(r => r.json()).catch(() => null);
          const target = mt?.data?.defaultMoveTarget || '';
          if (target) {
            (newEvent as any).moveCall = {
              target,
              typeArguments: [],
              argumentsTemplate: ['{recipient}', '{imageCid}', '{imageMimeType}'],
              gasBudget: 50_000_000
            };
            setMessage('✅ Move設定完了');
          }
        } catch (moveError) {
          console.warn('Move target setup failed:', moveError);
        }
      }

      // 3. 日時の整合性チェック
      try {
        const st = Date.parse(newEvent.startAt as string);
        const ed = Date.parse(newEvent.endAt as string);
        if (isFinite(st) && isFinite(ed) && ed <= st) {
          setMessage('❌ 終了日時は開始日時より後に設定してください');
          setLoading(false);
          return;
        }
      } catch (dateError) {
        console.warn('Date validation error:', dateError);
      }

      // 4. イベント作成
      setMessage('🚀 イベントを作成中...');
      
      // イベントデータに画像情報を明示的に追加
      const eventData = {
        ...newEvent,
        imageUrl: (newEvent as any).imageUrl || '',
        imageCid: (newEvent as any).imageCid || '',
        imageMimeType: (newEvent as any).imageMimeType || ''
      };
      
      console.log('📤 Sending event data:', eventData);
      
      // イベント作成のタイムアウト設定
      const createController = new AbortController();
      const createTimeoutId = setTimeout(() => createController.abort(), 30000);
      
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(eventData),
        signal: createController.signal
      });
      
      clearTimeout(createTimeoutId);
      
      const data = await res.json();
      if (data.success) {
        setMessage('🎉 イベントを作成しました！');
        
        // フォームリセット
        setNewEvent({
          name: '', 
          description: '', 
          collectionId: '', 
          imageUrl: '', 
          active: true,
          startAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          moveCall: { 
            target: '', 
            typeArguments: [], 
            argumentsTemplate: ['{recipient}', '{imageCid}', '{imageMimeType}'], 
            gasBudget: 50_000_000 
          }
        });
        setUploadFile(null); // アップロードファイルもリセット
        
        // イベントリスト更新
        fetchEvents();
        
        // 成功メッセージを少し長めに表示
        setTimeout(() => {
          setMessage('');
        }, 3000);
      } else {
        throw new Error(data.error || 'イベントの作成に失敗しました');
      }
    } catch (e: any) {
      console.error('Event creation error:', e);
      setMessage(`❌ ${e?.message || 'イベントの作成に失敗しました'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;
    // 更新時も日時整合性を軽くチェック
    try {
      const st = Date.parse(editingEvent.startAt);
      const ed = Date.parse(editingEvent.endAt);
      if (isFinite(st) && isFinite(ed) && ed <= st) {
        setMessage('終了日時は開始日時より後に設定してください');
        return;
      }
    } catch {}
    setLoading(true);
    try {
      // 画像自動アップロード（未設定でファイル選択がある場合）
      if (!((editingEvent as any).imageUrl) && !((editingEvent as any).imageCid) && uploadFile) {
        try {
          const tipRes = await fetch(`${API_BASE_URL}/api/walrus/tip-config`).catch(() => null);
          let needsTip = false;
          if (tipRes && tipRes.ok) {
            const tipJson = await tipRes.json().catch(() => ({}));
            const cfg = tipJson?.data || tipJson;
            needsTip = !!cfg?.send_tip;
          }
          if (!needsTip) {
            const relayUrl = `${API_BASE_URL}/api/walrus/upload-relay`;
            const r = await fetch(relayUrl, { method: 'POST', headers: { 'Content-Type': uploadFile.type || 'application/octet-stream' }, body: uploadFile });
            if (r.ok) {
              const d = await r.json().catch(() => ({}));
              const cid = resolveCidFromResponse(d);
              const base = 'https://aggregator.mainnet.walrus.space/v1/blobs/';
              const url = cid && base ? `${base}${cid}` : cid || '';
              if (cid) {
                (editingEvent as any).imageCid = cid;
                (editingEvent as any).imageMimeType = uploadFile.type || 'application/octet-stream';
                (editingEvent as any).imageUrl = url;
              }
            }
          }
        } catch {}
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingEvent)
      });
      const data = await res.json();
      if (data.success) {
        setMessage('イベントを更新しました');
        setEditingEvent(null);
        fetchEvents();
      } else {
        setMessage(data.error || 'イベントの更新に失敗しました');
      }
    } catch (e) {
      setMessage('イベントの更新に失敗しました');
    }
    setLoading(false);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('このイベントを削除しますか？')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMessage('イベントを削除しました');
        fetchEvents();
      } else {
        setMessage(data.error || 'イベントの削除に失敗しました');
      }
    } catch (e) {
      setMessage('イベントの削除に失敗しました');
    }
    setLoading(false);
  };

  // DM通知設定の取得
  const fetchDmSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/dm-settings`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setDmSettings(data.data);
        // テンプレートが空の場合は初期化を試行
        if (!data.data.templates || 
            !data.data.templates.successNew?.title || 
            !data.data.templates.successUpdate?.title || 
            !data.data.templates.failed?.title || 
            !data.data.templates.revoked?.title ||
            !data.data.channelTemplates ||
            !data.data.channelTemplates.verificationChannel?.title ||
            !data.data.channelTemplates.verificationStart?.title ||
            !data.data.channelTemplates.verificationUrl) {
          console.log('⚠️ DM templates or channel templates are empty, attempting to initialize...');
          await initializeDmSettings();
        }
      }
    } catch (e) {
      console.error('❌ Failed to fetch DM settings', e);
    }
  };

  // DM通知設定の初期化
  const initializeDmSettings = async () => {
    try {
      console.log('🔄 Initializing DM settings...');
      const res = await fetch(`${API_BASE_URL}/api/admin/dm-settings/initialize`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setDmSettings(data.data);
        console.log('✅ DM settings initialized successfully');
      } else {
        console.error('❌ Failed to initialize DM settings:', data.error);
      }
    } catch (e) {
      console.error('❌ Failed to initialize DM settings', e);
    }
  };

  // DM通知設定の保存
  const saveDmSettings = async () => {
    if (!editingDm) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/dm-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingDm)
      });
      const data = await res.json();
      if (data.success) {
        setDmSettings(data.data);
        setDmEditing(false);
        setEditingDm(null);
        setMessage('DM通知設定を保存しました');
      } else {
        setMessage('DM通知設定の保存に失敗しました');
      }
    } catch (e) {
      console.error('❌ Failed to save DM settings', e);
      setMessage('DM通知設定の保存に失敗しました');
    }
  };

  // 認証済みユーザー一覧取得
  const fetchVerifiedUsers = async () => {
    setUsersLoading(true);
    try {
      console.log('🔄 Fetching verified users...');
      const response = await fetch(`${API_BASE_URL}/api/admin/verified-users`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setVerifiedUsers(data.data);
        console.log(`✅ Loaded ${data.data.length} verified users`);
      } else {
        console.error('❌ Failed to fetch verified users:', data.error);
        setMessage('認証済みユーザーの取得に失敗しました');
      }
    } catch (error) {
      console.error('❌ Error fetching verified users:', error);
      setMessage('認証済みユーザーの取得中にエラーが発生しました');
    }
    setUsersLoading(false);
  };

  // 管理者アドレス一覧取得
  const fetchAdminAddresses = async () => {
    setAdminLoading(true);
    try {
      console.log('🔄 Fetching admin addresses...');
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        console.log(`✅ Loaded ${data.data.length} admin addresses`);
      } else {
        console.error('❌ Failed to fetch admin addresses:', data.error);
        setMessage('管理者アドレスの取得に失敗しました');
      }
    } catch (error) {
      console.error('❌ Error fetching admin addresses:', error);
      setMessage('管理者アドレスの取得中にエラーが発生しました');
    }
    setAdminLoading(false);
  };

  // 管理者アドレス追加
  const handleAddAdminAddress = async () => {
    if (!newAdminAddress || !newAdminAddress.trim()) {
      setMessage('有効なアドレスを入力してください');
      return;
    }

    // 既に存在するかチェック
    if (adminAddresses.some(addr => addr.toLowerCase() === newAdminAddress.toLowerCase())) {
      setMessage('このアドレスは既に管理者として登録されています');
      return;
    }

    setAdminLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ address: newAdminAddress.trim() })
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        setNewAdminAddress('');
        setMessage('管理者アドレスが正常に追加されました');
        console.log('✅ Admin address added successfully');
      } else {
        console.error('❌ Failed to add admin address:', data.error);
        setMessage(`管理者アドレスの追加に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Failed to add admin address:', error);
      setMessage('管理者アドレスの追加に失敗しました');
    }
    setAdminLoading(false);
  };

  // 管理者アドレス削除
  const handleRemoveAdminAddress = async (address: string) => {
    if (adminAddresses.length <= 1) {
      setMessage('管理者アドレスを全て削除することはできません。最低1つの管理者アドレスが必要です');
      return;
    }

    if (!confirm(`管理者アドレス "${address}" を削除しますか？`)) {
      return;
    }

    setAdminLoading(true);
    try {
      console.log(`🗑️ Removing admin address: ${address}`);
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses/${encodeURIComponent(address)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        setMessage('管理者アドレスが正常に削除されました');
        console.log('✅ Admin address removed successfully');
      } else {
        console.error('❌ Failed to remove admin address:', data.error);
        setMessage(`管理者アドレスの削除に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Failed to remove admin address:', error);
      setMessage('管理者アドレスの削除に失敗しました');
    }
    setAdminLoading(false);
  };

  // ロール選択時の処理
  const handleRoleSelect = (roleId: string) => {
    const selectedRole = discordRoles.find(role => role.id === roleId);
    if (selectedRole) {
      setNewCollection({
        ...newCollection,
        roleId: selectedRole.id,
        roleName: selectedRole.name
      });
    } else {
      setNewCollection({
        ...newCollection,
        roleId: '',
        roleName: ''
      });
    }
  };

  const handleAddCollection = async () => {
    if (!newCollection.name || !newCollection.packageId || !newCollection.roleId || !newCollection.roleName) {
      setMessage('すべての必須フィールドを入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newCollection)
      });

      const data = await response.json();
      if (data.success) {
        setMessage('コレクションが正常に追加されました');
        setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
        fetchCollections();
      } else {
        setMessage('コレクションの追加に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setLoading(false);
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('このコレクションを削除しますか？')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (data.success) {
        setMessage('コレクションが正常に削除されました');
        fetchCollections();
      } else {
        setMessage('コレクションの削除に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setLoading(false);
  };

  // コレクション編集開始
  const handleEditCollection = (collection: NFTCollection) => {
    setEditingCollection(collection);
    setNewCollection({
      name: collection.name,
      packageId: collection.packageId,
      roleId: collection.roleId,
      roleName: collection.roleName,
      description: collection.description
    });
  };

  // コレクション編集キャンセル
  const handleCancelEdit = () => {
    setEditingCollection(null);
    setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
  };

  // コレクション更新
  const handleUpdateCollection = async () => {
    if (!editingCollection || !newCollection.name || !newCollection.packageId || !newCollection.roleId || !newCollection.roleName) {
      setMessage('すべての必須フィールドを入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(newCollection)
      });

      const data = await response.json();
      if (data.success) {
        setMessage('コレクションが正常に更新されました');
        setEditingCollection(null);
        setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
        fetchCollections();
      } else {
        setMessage('コレクションの更新に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setLoading(false);
  };

  // バッチ処理設定取得
  const fetchBatchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-config`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setBatchConfig(data.data.config);
        setBatchStats(data.data.stats);
      }
    } catch {
      console.error('Failed to fetch batch config');
    }
  };

  // バッチ処理実行
  const executeBatchProcess = async () => {
    if (!confirm('バッチ処理を実行しますか？')) return;

    setBatchLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-execute`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await response.json();
      if (data.success) {
        setMessage('バッチ処理が正常に実行されました');
        fetchBatchConfig(); // 統計を更新
      } else {
        setMessage('バッチ処理の実行に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setBatchLoading(false);
  };

  // バッチ処理設定の編集用状態
  const [editingBatchConfig, setEditingBatchConfig] = useState<BatchConfig | null>(null);
  const [batchConfigEditing, setBatchConfigEditing] = useState(false);

  // バッチ処理設定更新
  const updateBatchConfig = async (config: Partial<BatchConfig>) => {
    setBatchLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });

      const data = await response.json();
      if (data.success) {
        setMessage('バッチ処理設定が正常に更新されました');
        setBatchConfig(data.data);
        setBatchConfigEditing(false);
        setEditingBatchConfig(null);
      } else {
        setMessage('バッチ処理設定の更新に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setBatchLoading(false);
  };

  // バッチ処理設定編集開始
  const handleEditBatchConfig = () => {
    if (batchConfig) {
      setEditingBatchConfig({ ...batchConfig });
      setBatchConfigEditing(true);
    }
  };

  // バッチ処理設定編集キャンセル
  const handleCancelBatchConfigEdit = () => {
    setBatchConfigEditing(false);
    setEditingBatchConfig(null);
  };

  // バッチ処理設定保存
  const handleSaveBatchConfig = () => {
    if (editingBatchConfig) {
      updateBatchConfig(editingBatchConfig);
    }
  };

  // 総ユーザー数クリック時の処理
  const handleTotalUsersClick = () => {
    setActiveTab('users');
    fetchVerifiedUsers();
  };

  // コンポーネントマウント時にデータを取得
  useEffect(() => {
    fetchCollections();
    fetchDiscordRoles();
    fetchBatchConfig();
    fetchDmSettings();
    fetchEvents();
  }, []);

  // タブ変更時にデータを取得
  useEffect(() => {
    if (activeTab === 'users') {
      fetchVerifiedUsers();
    } else if (activeTab === 'admins') {
      fetchAdminAddresses();
    } else if (activeTab === 'dm-settings') {
      fetchDmSettings();
    } else if (activeTab === 'events') {
      fetchEvents();
    }
  }, [activeTab]);

  // コレクション別ミント履歴
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<Array<{ txDigest: string; eventId?: string; recipient?: string; objectIds?: string[]; at?: string }>>([]);
  const [historyCollection, setHistoryCollection] = useState<string>('');

  const fetchCollectionHistory = async (typePath: string, limit: number = 50) => {
    if (!typePath) return;
    setHistoryLoading(true);
    try {
      const encoded = encodeURIComponent(typePath);
      const res = await fetch(`${API_BASE_URL}/api/mint-collections/${encoded}/mints?limit=${limit}`);
      const data = await res.json();
      if (data.success) {
        setHistoryItems(Array.isArray(data.data) ? data.data : []);
      } else {
        setMessage(`履歴の取得に失敗しました: ${data.error || 'unknown error'}`);
        setHistoryItems([]);
      }
    } catch (e) {
      console.error('Failed to fetch collection history', e);
      setMessage('履歴の取得に失敗しました');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>
        {mode === 'admin' ? '管理者ページ' : mode === 'mint' ? 'ミント管理' : mode === 'roles' ? 'ロール管理' : 'NFT Verification 管理パネル'}
      </h1>

      {mode === 'admin' && (
        <div style={{ marginBottom: '2rem', display: 'grid', gap: '0.75rem', maxWidth: '400px' }}>
          <a href="/admin/roles" style={{ padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: '#1f2937', textAlign: 'center', border: '1px solid #d1d5db' }}>ロール管理へ</a>
          <a href="/admin/mint" style={{ padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: '#1f2937', textAlign: 'center', border: '1px solid #d1d5db' }}>ミント管理へ</a>
        </div>
      )}

      {mode === 'admin' && (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #d1d5db', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 0.75rem 0' }}>パッケージ公開（本番）</h3>
          <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 720 }}>
            <div>
              <input type="file" accept="application/json" onChange={(e) => handleArtifactChange(e.target.files?.[0] || null)} />
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>sxt_nft/build.artifacts.json を選択してください</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handlePublishPackage} disabled={publishing || !artifactModules || !artifactDeps} style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: publishing || !artifactModules || !artifactDeps ? 'not-allowed' : 'pointer', opacity: publishing || !artifactModules || !artifactDeps ? 0.6 : 1 }}>
                {publishing ? '公開中...' : 'パッケージ公開（本番）'}
              </button>
              {publishMessage && <div style={{ alignSelf: 'center', color: '#111827' }}>{publishMessage}</div>}
            </div>
            {publishResult && (
              <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Tx Digest:</strong> <span style={{ fontFamily: 'monospace' }}>{publishResult?.data?.tx?.txDigest || publishResult?.txDigest || '-'}</span>
                </div>
                <details>
                  <summary>詳細</summary>
                  <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8rem' }}>{JSON.stringify(publishResult, null, 2)}</pre>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {/* タブナビゲーション */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '2rem',
        borderBottom: '1px solid #ccc',
        paddingBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        {allowedTabs.includes('collections') && (
        <button
          onClick={() => setActiveTab('collections')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'collections' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'collections' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          コレクション管理
        </button>
        )}
        {allowedTabs.includes('events') && (
        <button
          onClick={() => setActiveTab('events')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'events' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'events' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          イベント管理
        </button>
        )}
        {allowedTabs.includes('batch') && (
        <button
          onClick={() => setActiveTab('batch')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'batch' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'batch' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          バッチ処理管理
        </button>
        )}
        {allowedTabs.includes('users') && (
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'users' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'users' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          認証済みユーザー
        </button>
        )}
        {allowedTabs.includes('admins') && (
        <button
          onClick={() => setActiveTab('admins')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'admins' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'admins' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          管理者管理
        </button>
        )}
        {allowedTabs.includes('dm-settings') && (
        <button
          onClick={() => setActiveTab('dm-settings')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'dm-settings' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'dm-settings' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          DM通知設定
        </button>
        )}
        {allowedTabs.includes('history') && (
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'history' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'history' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          コレクション履歴
        </button>
        )}
      </div>

      {activeTab === 'collections' && (
        <>
          {/* New Collection Add Form */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h3>{editingCollection ? 'コレクション編集' : '新しいコレクション追加'}</h3>
            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '600px' }}>
              <input 
                type="text" 
                placeholder="コレクション名" 
                value={newCollection.name} 
                onChange={(e) => setNewCollection({...newCollection, name: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input 
                type="text" 
                placeholder="Package ID (例: 0x123...::nft::NFT)" 
                value={newCollection.packageId} 
                onChange={(e) => setNewCollection({...newCollection, packageId: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <select
                value={newCollection.roleId}
                onChange={(e) => handleRoleSelect(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">ロールを選択してください</option>
                {discordRoles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name} (ID: {role.id})
                  </option>
                ))}
              </select>
              <input 
                type="text" 
                placeholder="ロール名（自動設定）" 
                value={newCollection.roleName} 
                onChange={(e) => setNewCollection({...newCollection, roleName: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                readOnly
              />
              <textarea 
                placeholder="説明" 
                value={newCollection.description} 
                onChange={(e) => setNewCollection({...newCollection, description: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {editingCollection ? (
                  <>
                    <button 
                      onClick={handleUpdateCollection}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        flex: 1
                      }}
                    >
                      {loading ? '更新中...' : 'コレクション更新'}
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        flex: 1
                      }}
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleAddCollection}
                    disabled={loading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? '追加中...' : 'コレクション追加'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Existing Collections List */}
          <div>
            <h3>既存コレクション一覧</h3>
            {collections.map(collection => (
              <div key={collection.id} style={{
                border: '1px solid #ccc',
                padding: '1rem',
                margin: '0.5rem 0',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>{collection.name}</h4>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Package ID:</strong> {collection.packageId}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Role:</strong> {collection.roleName} ({collection.roleId})
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Status:</strong> {collection.isActive ? 'Active' : 'Inactive'}
                  </p>
                  {collection.description && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                      {collection.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEditCollection(collection)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteCollection(collection.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
            {collections.length === 0 && (
              <p style={{ color: '#666', fontStyle: 'italic' }}>コレクションがありません</p>
            )}
          </div>
        </>
      )}

      {activeTab === 'batch' && (
        <div>
          <h3>バッチ処理管理</h3>
          
          {/* バッチ処理設定 */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h4>バッチ処理設定</h4>
              {!batchConfigEditing && (
                <button
                  onClick={handleEditBatchConfig}
                  disabled={batchLoading || !batchConfig}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: batchLoading || !batchConfig ? 'not-allowed' : 'pointer',
                    opacity: batchLoading || !batchConfig ? 0.6 : 1,
                    fontSize: '0.9rem'
                  }}
                >
                  設定を編集
                </button>
              )}
            </div>

            {batchConfig && (
              <div style={{ display: 'grid', gap: '1rem', maxWidth: '600px' }}>
                {/* 現在の設定表示 */}
                {!batchConfigEditing && (
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: '#495057' }}>現在の設定</h5>
                                         <div style={{ display: 'grid', gap: '0.5rem' }}>
                       <div>
                         <strong>バッチ処理:</strong> {batchConfig.enabled ? '有効' : '無効'}
                       </div>
                       <div>
                         <strong>実行間隔:</strong> {batchConfig.interval}分
                       </div>
                       <div>
                         <strong>バッチサイズ:</strong> {batchConfig.maxUsersPerBatch}ユーザー
                       </div>
                       <div>
                         <strong>リトライ回数:</strong> {batchConfig.retryAttempts}回
                       </div>
                       <div>
                         <strong>DM通知:</strong> {batchConfig.enableDmNotifications ? '有効' : '無効'}
                       </div>
                       <div>
                         <strong>最終実行:</strong> {batchConfig.lastRun ? new Date(batchConfig.lastRun).toLocaleString('ja-JP') : '未実行'}
                       </div>
                       <div>
                         <strong>次回実行予定:</strong> {batchConfig.nextRun ? new Date(batchConfig.nextRun).toLocaleString('ja-JP') : '未設定'}
                       </div>
                     </div>
                  </div>
                )}

                {/* 編集フォーム */}
                {batchConfigEditing && editingBatchConfig && (
                  <div style={{ 
                    background: '#fff3cd', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    border: '1px solid #ffeaa7',
                    marginBottom: '1rem'
                  }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: '#856404' }}>設定を編集</h5>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={editingBatchConfig.enabled}
                            onChange={(e) => setEditingBatchConfig({
                              ...editingBatchConfig,
                              enabled: e.target.checked
                            })}
                            disabled={batchLoading}
                          />
                          バッチ処理を有効にする
                        </label>
                      </div>
                      
                      <div>
                        <label>実行間隔（分）:</label>
                        <input
                          type="number"
                          value={editingBatchConfig.interval}
                          onChange={(e) => setEditingBatchConfig({
                            ...editingBatchConfig,
                            interval: parseInt(e.target.value) || 0
                          })}
                          disabled={batchLoading}
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem', width: '100px' }}
                        />
                      </div>
                      
                      <div>
                        <label>バッチサイズ（最大ユーザー数）:</label>
                        <input
                          type="number"
                          value={editingBatchConfig.maxUsersPerBatch}
                          onChange={(e) => setEditingBatchConfig({
                            ...editingBatchConfig,
                            maxUsersPerBatch: parseInt(e.target.value) || 0
                          })}
                          disabled={batchLoading}
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem', width: '100px' }}
                        />
                      </div>
                      
                                             <div>
                         <label>リトライ回数:</label>
                         <input
                           type="number"
                           value={editingBatchConfig.retryAttempts}
                           onChange={(e) => setEditingBatchConfig({
                             ...editingBatchConfig,
                             retryAttempts: parseInt(e.target.value) || 0
                           })}
                           disabled={batchLoading}
                           style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem', width: '100px' }}
                         />
                       </div>

                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <label>
                           <input
                             type="checkbox"
                             checked={editingBatchConfig.enableDmNotifications}
                             onChange={(e) => setEditingBatchConfig({
                               ...editingBatchConfig,
                               enableDmNotifications: e.target.checked
                             })}
                             disabled={batchLoading}
                           />
                           バッチ処理時のDM通知を有効にする
                         </label>
                       </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                          onClick={handleSaveBatchConfig}
                          disabled={batchLoading}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: batchLoading ? 'not-allowed' : 'pointer',
                            opacity: batchLoading ? 0.6 : 1
                          }}
                        >
                          {batchLoading ? '保存中...' : '設定を保存'}
                        </button>
                        <button
                          onClick={handleCancelBatchConfigEdit}
                          disabled={batchLoading}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: batchLoading ? 'not-allowed' : 'pointer',
                            opacity: batchLoading ? 0.6 : 1
                          }}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* バッチ処理実行 */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h4>手動実行</h4>
            <button
              onClick={executeBatchProcess}
              disabled={batchLoading}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchLoading ? 'not-allowed' : 'pointer',
                opacity: batchLoading ? 0.6 : 1
              }}
            >
              {batchLoading ? '実行中...' : 'バッチ処理を実行'}
            </button>
          </div>

          {/* バッチ処理統計 */}
          <div style={{ 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h4>バッチ処理統計</h4>
            {batchStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div 
                  style={{ 
                    padding: '1rem', 
                    background: '#f8f9fa', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onClick={handleTotalUsersClick}
                >
                  <h5>総ユーザー数</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{batchStats.totalUsers}</p>
                  <small style={{ color: '#6c757d' }}>クリックして詳細を表示</small>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>処理完了</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{batchStats.processed}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>ロール削除</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#dc3545' }}>{batchStats.revoked}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>エラー数</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#ffc107' }}>{batchStats.errors}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>処理時間</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{batchStats.duration}ms</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>最終実行</h5>
                  <p style={{ fontSize: '1rem', margin: 0 }}>{batchStats.lastRun ? new Date(batchStats.lastRun).toLocaleString('ja-JP') : '未実行'}</p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'events' && (
        <div>
          <h3>イベント管理</h3>

          {/* コレクション作成（Move呼び出し） */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #d1d5db', borderRadius: 8, background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0 }}>コレクション作成</h4>
              <small style={{ color: '#6b7280' }}>Walrus CIDがある場合は自動で使用</small>
            </div>
            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 720 }}>
              <input
                type="text"
                placeholder={`コレクション名（例: ${(newEvent.name || 'Event Collection')}）`}
                value={createColName}
                onChange={(e) => setCreateColName(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
              <input
                type="text"
                placeholder={`シンボル（例: ${proposeSymbol(newEvent.name)}）`}
                value={createColSymbol}
                onChange={(e) => setCreateColSymbol(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
              <input
                type="text"
                placeholder="型パス（任意・例: 0x...::module::Struct）未指定時は既定から推測"
                value={createColTypePath}
                onChange={(e) => setCreateColTypePath(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleCreateCollectionViaMove}
                  disabled={creatingCollection}
                  style={{ padding: '0.5rem 1rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 6, cursor: creatingCollection ? 'not-allowed' : 'pointer', opacity: creatingCollection ? 0.6 : 1 }}
                >
                  {creatingCollection ? '作成中...' : 'コレクション作成'}
                </button>
                {createColMessage && (
                  <div style={{ alignSelf: 'center', color: '#374151' }}>{createColMessage}</div>
                )}
              </div>
            </div>
          </div>

          {/* 作成結果モーダル */}
          {createColResult && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={() => setCreateColResult(null)}>
              <div style={{ background: 'white', borderRadius: 12, padding: '1rem', width: 'min(92vw, 720px)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>コレクション作成結果</h4>
                  <button onClick={() => setCreateColResult(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>登録コレクション:</strong>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{createColResult?.data?.collection?.packageId || '-'}</div>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Tx Digest:</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{createColResult?.data?.moveResult?.txDigest || '-'}</span>
                      {createColResult?.data?.moveResult?.txDigest && (
                        <button
                          onClick={async () => { try { await navigator.clipboard.writeText(createColResult?.data?.moveResult?.txDigest); setCreateColMessage('Tx Digestをコピーしました'); } catch {} }}
                          style={{ padding: '0.25rem 0.5rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          コピー
                        </button>
                      )}
                    </div>
                  </div>
                  {(createColResult?.data?.moveResult?.events || createColResult?.data?.moveResult?.objectChanges) && (
                    <details style={{ background: '#f9fafb', padding: '0.5rem', borderRadius: 6 }}>
                      <summary>詳細</summary>
                      <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8rem' }}>{JSON.stringify({
                        events: createColResult?.data?.moveResult?.events || [],
                        objectChanges: createColResult?.data?.moveResult?.objectChanges || []
                      }, null, 2)}</pre>
                    </details>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                  <button onClick={() => setCreateColResult(null)} style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>閉じる</button>
                </div>
              </div>
            </div>
          )}

          {/* 作成/編集フォーム */}
          <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '800px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '24px',
              fontWeight: '800',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              {editingEvent ? '✏️ イベント編集' : '✨ 新規イベント作成'}
            </div>
            
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* 最小限の基本情報 */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #e2e8f0'
              }}>
                <h5 style={{
                  margin: '0 0 16px 0',
                  color: '#1e293b',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ✨ イベント作成（最小限入力）
                </h5>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  {/* イベント名（必須） */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '6px'
                    }}>
                      イベント名 *
                    </label>
                    <input
                      type="text"
                      placeholder="例: SyndicateX Tokyo NFT Drop"
                      value={(editingEvent?.name) ?? (newEvent.name || '')}
                      onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), name: e.target.value }) : setNewEvent({ ...newEvent, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        fontSize: '16px',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        background: 'white'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                  
                  {/* 説明（任意・簡潔） */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '6px'
                    }}>
                      説明（任意）
                    </label>
                    <input
                      type="text"
                      placeholder="簡単な説明を入力..."
                      value={(editingEvent?.description) ?? (newEvent.description || '')}
                      onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), description: e.target.value }) : setNewEvent({ ...newEvent, description: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        fontSize: '16px',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        background: 'white'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#667eea'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                </div>
              </div>
              {/* コレクション選択セクション */}
              <div style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #bae6fd'
              }}>
                <h5 style={{
                  margin: '0 0 16px 0',
                  color: '#1e293b',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🎯 対象コレクション
                </h5>
                
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '6px'
                    }}>
                      コレクション選択 *
                    </label>
                    <select
                      value={(editingEvent?.collectionId) ?? (newEvent.collectionId || '')}
                      onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), collectionId: e.target.value }) : setNewEvent({ ...newEvent, collectionId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        fontSize: '16px',
                        background: 'white',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    >
                      <option value="">📋 コレクションを選択してください</option>
                      {collections.map(col => (
                        <option key={col.id} value={col.packageId}>
                          🎨 {col.name} ({(col.packageId || '').slice(0, 10)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{
                    padding: '12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e40af'
                  }}>
                    💡 手動入力: 0x...::module::Struct 形式でも入力可能
                  </div>
                </div>
              </div>
              <input
                type="text"
                placeholder="Walrus画像URL（任意）"
                value={(editingEvent?.imageUrl) ?? (newEvent.imageUrl || '')}
                onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), imageUrl: e.target.value }) : setNewEvent({ ...newEvent, imageUrl: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="text"
                placeholder="Walrus CID（任意）"
                value={(editingEvent?.imageCid) ?? ((newEvent as any).imageCid ?? '')}
                onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), imageCid: e.target.value as any }) : setNewEvent({ ...newEvent, imageCid: e.target.value as any })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="text"
                placeholder="MIME Type（例: image/png）"
                value={(editingEvent?.imageMimeType) ?? ((newEvent as any).imageMimeType ?? '')}
                onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), imageMimeType: e.target.value as any }) : setNewEvent({ ...newEvent, imageMimeType: e.target.value as any })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              {/* 1クリック画像アップロード */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #bbf7d0'
              }}>
                <h5 style={{
                  margin: '0 0 16px 0',
                  color: '#1e293b',
                  fontSize: '16px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🖼️ NFT画像（1クリック自動設定）
                </h5>
                
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '12px',
                    background: 'white',
                    borderRadius: '12px',
                    border: '2px dashed #10b981'
                  }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                      id="image-upload"
                    />
                    <label 
                      htmlFor="image-upload"
                      style={{
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        border: 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      📁 画像を選択
                    </label>
                    
                    {uploadFile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>
                          📎 {uploadFile.name} ({Math.round(uploadFile.size/1024)}KB)
                        </span>
                        <button 
                          onClick={handleWalrusUpload} 
                          disabled={uploading}
                          style={{
                            padding: '8px 16px',
                            background: uploading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            fontSize: '14px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {uploading ? '⏳ アップロード中...' : '🚀 自動設定'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* アップロード結果の表示 */}
                  {((newEvent as any).imageCid || (newEvent as any).imageUrl) && (
                    <div style={{
                      padding: '12px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#065f46'
                    }}>
                      ✅ 画像設定完了: {((newEvent as any).imageCid) ? `CID: ${(newEvent as any).imageCid}` : `URL: ${(newEvent as any).imageUrl}`}
                    </div>
                  )}
                </div>
              </div>
              {/* 詳細設定（折りたたみ） */}
              <div style={{
                background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {advancedOpen ? '🔽 詳細設定を隠す' : '⚙️ 詳細設定を開く'}
                </button>
                
                {advancedOpen && (
                  <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                    <div style={{
                      padding: '12px',
                      background: 'rgba(107, 114, 128, 0.1)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      💡 通常は自動設定で十分です。上級者向けオプションです。
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input
                  type="datetime-local"
                  value={(() => {
                    const v = (editingEvent?.startAt) ?? (newEvent.startAt || '');
                    return v ? new Date(v).toISOString().slice(0,16) : '';
                  })()}
                  onChange={(e) => {
                    const iso = new Date(e.target.value).toISOString();
                    editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), startAt: iso }) : setNewEvent({ ...newEvent, startAt: iso });
                  }}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <input
                  type="datetime-local"
                  value={(() => {
                    const v = (editingEvent?.endAt) ?? (newEvent.endAt || '');
                    return v ? new Date(v).toISOString().slice(0,16) : '';
                  })()}
                  onChange={(e) => {
                    const iso = new Date(e.target.value).toISOString();
                    editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), endAt: iso }) : setNewEvent({ ...newEvent, endAt: iso });
                  }}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={Boolean((editingEvent?.active) ?? (newEvent.active ?? true))}
                  onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), active: e.target.checked }) : setNewEvent({ ...newEvent, active: e.target.checked })}
                />
                有効化
              </label>
              <input
                type="number"
                placeholder="総ミント上限（未設定可）"
                value={typeof (editingEvent?.totalCap ?? newEvent.totalCap) === 'number' ? (editingEvent?.totalCap ?? (newEvent.totalCap as number)) : ''}
                onChange={(e) => {
                  const v = e.target.value.trim() === '' ? undefined : Number(e.target.value);
                  if (editingEvent) setEditingEvent({ ...(editingEvent as AdminMintEvent), totalCap: v as any });
                  else setNewEvent({ ...newEvent, totalCap: v as any });
                }}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              {/* 詳細設定（折り畳み） */}
              <div style={{ marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} style={{ padding: '0.35rem 0.6rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                  {advancedOpen ? '詳細設定を閉じる' : '詳細設定を開く'}
                </button>
                {advancedOpen && (
                  <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem', background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: '0.75rem' }}>
                    <input
                      type="text"
                      placeholder="Move呼び出しターゲット（例: 0xabc::module::mint)"
                      value={(editingEvent?.moveCall?.target) ?? (newEvent.moveCall?.target || '')}
                      onChange={(e) => editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), moveCall: { ...(editingEvent.moveCall || {}), target: e.target.value } }) : setNewEvent({ ...newEvent, moveCall: { ...(newEvent.moveCall || {}), target: e.target.value } })}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      placeholder="Type Arguments（カンマ区切り）"
                      value={((editingEvent?.moveCall?.typeArguments) ?? (newEvent.moveCall?.typeArguments || [])).join(',')}
                      onChange={(e) => {
                        const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), moveCall: { ...(editingEvent.moveCall || {}), typeArguments: arr } }) : setNewEvent({ ...newEvent, moveCall: { ...(newEvent.moveCall || {}), typeArguments: arr } });
                      }}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="text"
                      placeholder="Arguments Template（カンマ区切り）。例: {recipient},{imageUrl}"
                      value={((editingEvent?.moveCall?.argumentsTemplate) ?? (newEvent.moveCall?.argumentsTemplate || [])).join(',')}
                      onChange={(e) => {
                        const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), moveCall: { ...(editingEvent.moveCall || {}), argumentsTemplate: arr } }) : setNewEvent({ ...newEvent, moveCall: { ...(newEvent.moveCall || {}), argumentsTemplate: arr } });
                      }}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <input
                      type="number"
                      placeholder="Gas Budget（任意）"
                      value={Number((editingEvent?.moveCall?.gasBudget) ?? (newEvent.moveCall?.gasBudget || '')) || ''}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        editingEvent ? setEditingEvent({ ...(editingEvent as AdminMintEvent), moveCall: { ...(editingEvent.moveCall || {}), gasBudget: v } }) : setNewEvent({ ...newEvent, moveCall: { ...(newEvent.moveCall || {}), gasBudget: v } });
                      }}
                      style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {editingEvent ? (
                  <>
                    <button onClick={handleUpdateEvent} disabled={loading} style={{ padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>更新</button>
                    <button onClick={() => setEditingEvent(null)} disabled={loading} style={{ padding: '0.5rem 1rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>キャンセル</button>
                  </>
                ) : (
                  <button 
                    onClick={handleCreateEvent} 
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '16px 24px',
                      background: loading 
                        ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: '700',
                      fontSize: '16px',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        const target = e.target as HTMLButtonElement;
                        target.style.transform = 'translateY(-2px)';
                        target.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        const target = e.target as HTMLButtonElement;
                        target.style.transform = 'translateY(0)';
                        target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {loading && (
                      <div style={{
                        position: 'absolute',
                        left: '20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '20px',
                        height: '20px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                    )}
                    <span style={{ marginLeft: loading ? '32px' : '0' }}>
                      {loading ? 'イベント作成中...' : '🚀 イベントを作成'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* イベント一覧 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>イベント一覧</h4>
              <button
                onClick={fetchEvents}
                style={{ padding: '0.25rem 0.75rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                一覧を更新
              </button>
            </div>
            {events.map(ev => (
              <div key={ev.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ev.name}</div>
                    <div style={{ fontSize: '0.9rem', color: '#555' }}>{ev.description}</div>
                    <div style={{ fontSize: '0.85rem', color: '#333' }}>期間: {new Date(ev.startAt).toLocaleString('ja-JP')} - {new Date(ev.endAt).toLocaleString('ja-JP')}</div>
                    <div style={{ fontSize: '0.85rem', color: '#333' }}>状態: {ev.active ? 'Active' : 'Inactive'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#333' }}>
                      ID: <span style={{ fontFamily: 'monospace' }}>{ev.id}</span>
                      <button
                        onClick={async () => { try { await navigator.clipboard.writeText(ev.id); setMessage('イベントIDをコピーしました'); } catch { setMessage(ev.id); } }}
                        style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        コピー
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#333' }}>
                      ミント進捗: {typeof ev.mintedCount === 'number' ? ev.mintedCount : 0}
                      {typeof ev.totalCap === 'number' ? ` / ${ev.totalCap}（残り ${Math.max((ev.totalCap || 0) - (ev.mintedCount || 0), 0)}）` : ' / 上限なし'}
                    </div>
                    {/* カウントダウン */}
                    <div style={{ fontSize: '0.85rem', color: '#1f2937' }}>
                      {(() => {
                        const start = Date.parse(ev.startAt);
                        const end = Date.parse(ev.endAt);
                        if (nowTs < start) {
                          const rem = Math.max(0, start - nowTs);
                          const h = Math.floor(rem / 3600000);
                          const m = Math.floor((rem % 3600000) / 60000);
                          const s = Math.floor((rem % 60000) / 1000);
                          return `開始まで: ${h}時間 ${m}分 ${s}秒`;
                        } else if (nowTs <= end) {
                          const rem = Math.max(0, end - nowTs);
                          const h = Math.floor(rem / 3600000);
                          const m = Math.floor((rem % 3600000) / 60000);
                          const s = Math.floor((rem % 60000) / 1000);
                          return `終了まで: ${h}時間 ${m}分 ${s}秒`;
                        } else {
                          return 'イベントは終了しました';
                        }
                      })()}
                    </div>
                    {ev.imageUrl && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#333', marginBottom: '0.25rem' }}>画像:</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img src={getImageDisplayUrl((ev as any).imageCid, ev.imageUrl)} alt={ev.name} style={{ width: 120, height: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                          <a href={getImageDisplayUrl((ev as any).imageCid, ev.imageUrl)} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>新しいタブで開く</a>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/admin/events/${ev.id}/toggle-active`, { method: 'POST', headers: getAuthHeaders() });
                          const data = await res.json();
                          if (data.success) { setMessage('状態を切り替えました'); fetchEvents(); } else { setMessage(data.error || '切り替えに失敗しました'); }
                        } catch { setMessage('切り替えに失敗しました'); }
                      }}
                      style={{ padding: '0.25rem 0.5rem', background: ev.active ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      {ev.active ? '無効化' : '有効化'}
                    </button>
                    <button
                      onClick={async () => {
                        const url = `${window.location.origin}/mint/${ev.id}`;
                        try { await navigator.clipboard.writeText(url); setMessage('ミントURLをコピーしました'); } catch { setMessage(url); }
                      }}
                      style={{ padding: '0.25rem 0.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      URLコピー
                    </button>
                    <button onClick={() => setEditingEvent(ev)} style={{ padding: '0.25rem 0.5rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>編集</button>
                    <button onClick={() => handleDeleteEvent(ev.id)} style={{ padding: '0.25rem 0.5rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>削除</button>
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && <p style={{ color: '#666' }}>イベントがありません</p>}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <h3>認証済みユーザー一覧</h3>
          
          <div style={{ 
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <p>総ユーザー数: {verifiedUsers.length}人</p>
            <button
              onClick={fetchVerifiedUsers}
              disabled={usersLoading}
              style={{
                padding: '0.5rem 1rem',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: usersLoading ? 'not-allowed' : 'pointer',
                opacity: usersLoading ? 0.6 : 1
              }}
            >
              {usersLoading ? '更新中...' : '更新'}
            </button>
          </div>

          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>ユーザー一覧を読み込み中...</p>
            </div>
          ) : verifiedUsers.length > 0 ? (
            <div style={{ 
              maxHeight: '600px', 
              overflowY: 'auto',
              border: '1px solid #ccc',
              borderRadius: '8px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Discord ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>ウォレットアドレス</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>ロール名</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>認証日時</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>最終チェック</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedUsers.map((user, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.75rem' }}>{user.discordId}</td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {user.address.length > 20 ? `${user.address.slice(0, 10)}...${user.address.slice(-8)}` : user.address}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ 
                          background: '#007bff', 
                          color: 'white', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          {user.roleName}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                        {new Date(user.verifiedAt).toLocaleString('ja-JP')}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                        {user.lastChecked ? new Date(user.lastChecked).toLocaleString('ja-JP') : '未チェック'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: '#666',
              fontStyle: 'italic'
            }}>
              <p>認証済みユーザーがいません</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && (
        <div>
          <h3>管理者管理</h3>
          
          {/* 管理者追加フォーム */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h4>新しい管理者を追加</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', maxWidth: '600px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  ウォレットアドレス
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newAdminAddress}
                  onChange={(e) => setNewAdminAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
              <button
                onClick={handleAddAdminAddress}
                disabled={adminLoading || !newAdminAddress.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: adminLoading || !newAdminAddress.trim() ? 'not-allowed' : 'pointer',
                  opacity: adminLoading || !newAdminAddress.trim() ? 0.6 : 1,
                  fontWeight: '500'
                }}
              >
                {adminLoading ? '追加中...' : '管理者追加'}
              </button>
            </div>
          </div>

          {/* 現在の管理者一覧 */}
          <div style={{ 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h4>現在の管理者一覧</h4>
              <button
                onClick={fetchAdminAddresses}
                disabled={adminLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: adminLoading ? 'not-allowed' : 'pointer',
                  opacity: adminLoading ? 0.6 : 1,
                  fontSize: '0.9rem'
                }}
              >
                {adminLoading ? '更新中...' : '更新'}
              </button>
            </div>

            {adminLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>管理者一覧を読み込み中...</p>
              </div>
            ) : adminAddresses.length > 0 ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {adminAddresses.map((address, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    marginBottom: '0.75rem',
                    border: '1px solid #e9ecef'
                  }}>
                    <div>
                      <span style={{
                        fontSize: '0.9rem',
                        fontFamily: 'monospace',
                        color: '#495057',
                        wordBreak: 'break-all'
                      }}>
                        {address}
                      </span>
                      {index === 0 && (
                        <span style={{
                          background: '#28a745',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          marginLeft: '0.5rem'
                        }}>
                          メイン管理者
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveAdminAddress(address)}
                      disabled={adminAddresses.length <= 1}
                      style={{
                        padding: '0.5rem 1rem',
                        background: adminAddresses.length <= 1 ? '#6c757d' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: adminAddresses.length <= 1 ? 'not-allowed' : 'pointer',
                        opacity: adminAddresses.length <= 1 ? 0.6 : 1,
                        fontSize: '0.8rem'
                      }}
                      title={adminAddresses.length <= 1 ? '最低1つの管理者が必要です' : '管理者を削除'}
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                color: '#666',
                fontStyle: 'italic'
              }}>
                <p>管理者が登録されていません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dm-settings' && (
        <div>
          <h3>DM通知設定</h3>
          
          {dmSettings ? (
            <div>
              {/* 現在の設定表示 */}
              {!dmEditing ? (
                <div style={{ 
                  marginBottom: '2rem', 
                  padding: '1rem', 
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4>現在の設定</h4>
                    <button
                      onClick={() => {
                        setEditingDm({ ...dmSettings });
                        setDmEditing(true);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      編集
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <strong>通常認証時のDM通知モード:</strong> {
                        dmSettings.mode === 'all' ? '全ての通知' :
                        dmSettings.mode === 'new_and_revoke' ? '新規認証とロール削除のみ' :
                        dmSettings.mode === 'update_and_revoke' ? '認証更新とロール削除のみ' :
                        dmSettings.mode === 'revoke_only' ? 'ロール削除のみ' :
                        '通知なし'
                      }
                    </div>
                    <div>
                      <strong>バッチ処理時のDM通知モード:</strong> {
                        dmSettings.batchMode === 'all' ? '全ての通知' :
                        dmSettings.batchMode === 'new_and_revoke' ? '新規認証とロール削除のみ' :
                        dmSettings.batchMode === 'update_and_revoke' ? '認証更新とロール削除のみ' :
                        dmSettings.batchMode === 'revoke_only' ? 'ロール削除のみ' :
                        '通知なし'
                      }
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>📱 DMテンプレート</h4>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🎉 新規認証</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.successNew.title}</div>
                      <div>
                        <strong>内容:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {(dmSettings.templates.successNew.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🔄 認証更新</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.successUpdate.title}</div>
                      <div>
                        <strong>内容:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {(dmSettings.templates.successUpdate.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>❌ 認証失敗</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.failed.title}</div>
                      <div>
                        <strong>内容:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {(dmSettings.templates.failed.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🚫 ロール削除</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.revoked.title}</div>
                      <div>
                        <strong>内容:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {(dmSettings.templates.revoked.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>
                    
                    <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>📺 チャンネルテンプレート</h4>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🎫 認証チャンネル</h5>
                      <div><strong>タイトル:</strong> {dmSettings.channelTemplates?.verificationChannel?.title || 'Not set'}</div>
                      <div>
                        <strong>内容:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {(dmSettings.channelTemplates?.verificationChannel?.description || 'Not set').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>▶️ 認証開始</h5>
                      <div><strong>タイトル:</strong> {dmSettings.channelTemplates?.verificationStart?.title || 'Not set'}</div>
                      <div>
                        <strong>内容:</strong>
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {(dmSettings.channelTemplates?.verificationStart?.description || 'Not set').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🔗 認証URL</h5>
                      <div><strong>ベースURL:</strong> {dmSettings.channelTemplates?.verificationUrl || 'Not set'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 編集モード */
                <div style={{ 
                  marginBottom: '2rem', 
                  padding: '1rem', 
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4>設定を編集</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={saveDmSettings}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setDmEditing(false);
                          setEditingDm(null);
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                  
                  {editingDm && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                            通常認証時のDM通知モード
                          </label>
                          <select
                            value={editingDm.mode}
                            onChange={(e) => setEditingDm({ ...editingDm, mode: e.target.value as DmMode })}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                          >
                            <option value="all">全ての通知</option>
                            <option value="new_and_revoke">新規認証とロール削除のみ</option>
                            <option value="update_and_revoke">認証更新とロール削除のみ</option>
                            <option value="revoke_only">ロール削除のみ</option>
                            <option value="none">通知なし</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                            バッチ処理時のDM通知モード
                          </label>
                          <select
                            value={editingDm.batchMode}
                            onChange={(e) => setEditingDm({ ...editingDm, batchMode: e.target.value as DmMode })}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                          >
                            <option value="all">全ての通知</option>
                            <option value="new_and_revoke">新規認証とロール削除のみ</option>
                            <option value="update_and_revoke">認証更新とロール削除のみ</option>
                            <option value="revoke_only">ロール削除のみ</option>
                            <option value="none">通知なし</option>
                          </select>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🎉 新規認証</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.successNew.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successNew: { ...editingDm.templates.successNew, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.successNew.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successNew: { ...editingDm.templates.successNew, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🔄 認証更新</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.successUpdate.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successUpdate: { ...editingDm.templates.successUpdate, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.successUpdate.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successUpdate: { ...editingDm.templates.successUpdate, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>❌ 認証失敗</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.failed.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                failed: { ...editingDm.templates.failed, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.failed.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                failed: { ...editingDm.templates.failed, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🚫 ロール削除</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.revoked.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                revoked: { ...editingDm.templates.revoked, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.revoked.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                revoked: { ...editingDm.templates.revoked, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>📺 チャンネルテンプレート</h4>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🎫 認証チャンネル</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.channelTemplates?.verificationChannel?.title || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationChannel: { 
                                  ...editingDm.channelTemplates?.verificationChannel, 
                                  title: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.channelTemplates?.verificationChannel?.description || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationChannel: { 
                                  ...editingDm.channelTemplates?.verificationChannel, 
                                  description: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>▶️ 認証開始</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.channelTemplates?.verificationStart?.title || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationStart: { 
                                  ...editingDm.channelTemplates?.verificationStart, 
                                  title: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.channelTemplates?.verificationStart?.description || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationStart: { 
                                  ...editingDm.channelTemplates?.verificationStart, 
                                  description: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🔗 認証URL</h5>
                          <input
                            type="text"
                            placeholder="ベースURL (例: https://syndicatextokyo.app)"
                            value={editingDm.channelTemplates?.verificationUrl || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationUrl: e.target.value
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                            実際のURLは「ベースURL?discord_id=ユーザーID」の形式で生成されます<br/>
                            ユーザーにはクリック可能なリンクとコピー用のコードブロックで表示されます
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>DM設定を読み込み中...</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: '#374151' }}>コレクションを選択</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={historyCollection}
                onChange={(e) => setHistoryCollection(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid #ccc', minWidth: 280 }}
              >
                <option value="">選択してください</option>
                {collections.map(col => (
                  <option key={col.id} value={col.packageId}>
                    {col.name} ({(col.packageId || '').slice(0, 10)}...)
                  </option>
                ))}
              </select>
              <button
                onClick={() => historyCollection && fetchCollectionHistory(historyCollection)}
                disabled={!historyCollection || historyLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: historyLoading ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: !historyCollection || historyLoading ? 'not-allowed' : 'pointer',
                  opacity: !historyCollection || historyLoading ? 0.6 : 1,
                  fontWeight: 500
                }}
                title={!historyCollection ? 'コレクションを選んでください' : ''}
              >
                {historyLoading ? '読み込み中...' : '履歴取得'}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>日時</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>イベント</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Recipient</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>ObjectIDs</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>TxDigest</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1rem', color: '#6b7280' }}>データがありません</td>
                  </tr>
                ) : (
                  historyItems.map((it, idx) => {
                    const evName = events.find(e => e.id === it.eventId)?.name || it.eventId || '-';
                    return (
                      <tr key={idx}>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{it.at ? new Date(it.at).toLocaleString() : '-'}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{evName}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{it.recipient || '-'}</td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                          {(it.objectIds || []).length ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {(it.objectIds || []).map((oid, i) => (
                                <a key={i} href={`https://suiexplorer.com/object/${oid}?network=mainnet`} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                                  {oid.slice(0, 6)}...{oid.slice(-4)}
                                </a>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                          {it.txDigest ? (
                            <a href={`https://suiexplorer.com/txblock/${it.txDigest}?network=mainnet`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontFamily: 'monospace' }}>
                              {it.txDigest.slice(0, 6)}...{it.txDigest.slice(-4)}
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          padding: '1rem',
          background: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          border: '1px solid',
          borderColor: message.includes('成功') ? '#c3e6cb' : '#f5c6cb',
          borderRadius: '4px',
          zIndex: 1000
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default AdminPanel; 