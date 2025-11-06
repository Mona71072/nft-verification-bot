// KVストアからイベントを削除するスクリプト
const API_URL = 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

async function deleteEvent(eventId) {
  try {
    // 現在のイベントリストを取得
    const response = await fetch(`${API_URL}/api/events`);
    const data = await response.json();
    
    if (!data.success) {
      console.error('Failed to fetch events:', data.error);
      return;
    }
    
    const events = data.data || [];
    console.log(`Current events: ${events.length}`);
    
    // 指定されたIDのイベントを除外
    const filteredEvents = events.filter(e => e.id !== eventId);
    
    if (filteredEvents.length === events.length) {
      console.log(`Event ${eventId} not found`);
      return;
    }
    
    console.log(`Removing event ${eventId}, remaining events: ${filteredEvents.length}`);
    
    // 管理者として削除APIを呼び出す必要があるが、直接KVストアを操作できないため
    // このスクリプトは情報表示のみ
    console.log('To delete the event, please use the admin panel or API with proper authentication.');
    console.log(`Event to delete: ${JSON.stringify(events.find(e => e.id === eventId), null, 2)}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// コマンドライン引数からイベントIDを取得
const eventId = process.argv[2] || '1762348409369';
deleteEvent(eventId);

