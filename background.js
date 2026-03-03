// HoYoLab ログインボーナス - Background Service Worker
// content scriptからの完了報告を受け取り、タブを閉じるだけのシンプルな構造

chrome.runtime.onMessage.addListener((message, sender) => {
  // content scriptが取得完了を報告 → タブを閉じる
  if (message.type === 'CLAIM_RESULT' && sender.tab) {
    const tabId = sender.tab.id;
    const delay = message.closeDelay || 3000;

    console.log('[HoYoLab BG] 取得結果:', message.game, message.success ? '成功' : '済/失敗');

    setTimeout(async () => {
      try {
        await chrome.tabs.remove(tabId);
        console.log('[HoYoLab BG] タブを閉じました:', tabId);
      } catch (e) {
        console.log('[HoYoLab BG] タブ閉じエラー（無視）:', e.message);
      }
    }, delay);
  }
});
