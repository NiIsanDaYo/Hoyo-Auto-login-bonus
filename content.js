// HoYoLab ログインボーナス自動取得 - コンテンツスクリプト

(function () {
  'use strict';

  const CONFIG = {
    MAX_WAIT: 15000,
    CLICK_DELAY: 2000,
    POLL_INTERVAL: 500,
    CLOSE_DELAY: 4000,
  };

  // ===== ゲーム判定 =====
  const url = window.location.href;
  let gameType = null;

  if (url.includes('signin-sea-v3') || url.includes('e202102251931481')) {
    gameType = 'genshin';
  } else if (url.includes('hkrpg') || url.includes('e202303301540311')) {
    gameType = 'starrail';
  } else if (url.includes('zzz') || url.includes('e202406031448091')) {
    gameType = 'zzz';
  }

  if (!gameType) return;
  console.log('[HoYoLab Auto] ゲーム検出:', gameType);

  // ===== ユーティリティ =====

  function waitForElement(testFn, timeout = CONFIG.MAX_WAIT) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      function check() {
        const el = testFn();
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return reject(new Error('タイムアウト'));
        setTimeout(check, CONFIG.POLL_INTERVAL);
      }
      check();
    });
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * 通知バナーを表示する（ページ上部に表示）
   */
  function showNotification(message, type) {
    const banner = document.createElement('div');
    banner.textContent = message;
    const colors = {
      success: 'linear-gradient(135deg, #10b981, #059669)',
      info: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      error: 'linear-gradient(135deg, #ef4444, #dc2626)',
    };
    Object.assign(banner.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '14px 28px',
      borderRadius: '10px',
      fontSize: '16px',
      fontWeight: '700',
      zIndex: '999999',
      color: '#fff',
      background: colors[type] || colors.success,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      opacity: '0',
      transition: 'opacity 0.4s ease',
    });
    document.body.appendChild(banner);
    requestAnimationFrame(() => { banner.style.opacity = '1'; });
  }

  /**
   * 取得完了処理: 通知表示 → タブを閉じる
   */
  function finish(success, message, type) {
    console.log('[HoYoLab Auto] 結果:', message);
    showNotification(message, type || (success ? 'success' : 'info'));

    // タブを閉じる（2つの方法を試す）
    const delay = success ? CONFIG.CLOSE_DELAY : 3000;
    setTimeout(() => {
      // 方法1: backgroundにメッセージ送信してタブを閉じてもらう
      try {
        chrome.runtime.sendMessage({
          type: 'CLAIM_RESULT',
          game: gameType,
          success: success,
          message: message,
          closeDelay: 500, // backgroundでは短い追加ディレイのみ
        });
      } catch (e) {
        console.log('[HoYoLab Auto] BG送信失敗:', e);
      }

      // 方法2: window.close()でタブを閉じる（バックアップ）
      setTimeout(() => {
        try { window.close(); } catch (e) { }
      }, 1000);
    }, delay);
  }

  /**
   * アイテムが取得済みか判定する
   * received クラスの img が子要素にあれば取得済み
   */
  function isItemClaimed(item) {
    if (item.querySelector('[class*="received"]')) return true;
    if (item.querySelector('[class*="checked"], [class*="complete"], [class*="done"], [class*="claimed"]')) return true;
    return false;
  }

  // ===== 原神の自動取得 =====
  async function autoClaimGenshin() {
    console.log('[HoYoLab Auto] 原神: 検索中...');
    try {
      await waitForElement(() => document.querySelector('[class*="sign-list"]'));
      await sleep(CONFIG.CLICK_DELAY);

      const items = document.querySelectorAll('[class*="sign-item"]');
      console.log('[HoYoLab Auto] 原神:', items.length, '個');

      for (const item of items) {
        if (item.className.includes('sign-wrapper')) {
          const redPoint = item.querySelector('[class*="red-point"]');
          if (redPoint) {
            console.log('[HoYoLab Auto] 原神: 未取得 → クリック');
            item.click();
            finish(true, '🎮 原神: ログインボーナスを取得しました！');
            return;
          } else {
            finish(false, '✅ 原神: 本日のボーナスは取得済みです');
            return;
          }
        }
      }
      finish(false, '✅ 原神: ログインボーナスは取得済みです');
    } catch (e) {
      console.error('[HoYoLab Auto] 原神 エラー:', e);
      finish(false, '❌ 原神: 取得に失敗しました', 'error');
    }
  }

  // ===== スターレイル・ゼンゼロ共通 =====
  async function autoClaimPrizeList(gameName, emoji) {
    console.log('[HoYoLab Auto]', gameName, ': 検索中...');
    try {
      await waitForElement(() => document.querySelector('[class*="prize-list_---item"]'));
      await sleep(CONFIG.CLICK_DELAY);

      const items = document.querySelectorAll('[class*="prize-list_---item"]');
      console.log('[HoYoLab Auto]', gameName, ':', items.length, '個');

      if (items.length === 0) {
        finish(false, '❌ ' + gameName + ': アイテムが見つかりません', 'error');
        return;
      }

      // 取得済み（received）アイテムがあるかチェック
      let hasReceivedItems = false;
      for (const item of items) {
        if (isItemClaimed(item)) {
          hasReceivedItems = true;
          break;
        }
      }

      // 方法1: background-image差異で今日の未取得アイテムを特定
      const bgMap = new Map();
      items.forEach(item => {
        const bg = item.style.backgroundImage || '';
        bgMap.set(bg, (bgMap.get(bg) || 0) + 1);
      });
      let normalBg = '';
      let maxCount = 0;
      for (const [bg, count] of bgMap) {
        if (count > maxCount) { maxCount = count; normalBg = bg; }
      }

      for (const item of items) {
        const bg = item.style.backgroundImage || '';
        if (bg && bg !== normalBg && !isItemClaimed(item)) {
          console.log('[HoYoLab Auto]', gameName, ': 未取得アイテム発見（背景差異）');
          item.click();
          finish(true, emoji + ' ' + gameName + ': ログインボーナスを取得しました！');
          return;
        }
      }

      // 方法2: テキスト色差異で検出
      for (const item of items) {
        if (isItemClaimed(item)) continue;
        const cntEl = item.querySelector('[class*="prize-list_---cnt"]');
        if (cntEl) {
          const color = cntEl.style.color;
          const isWhite = color.includes('254') || color.includes('255');
          const isGray = color.includes('130') || color.includes('128');
          if (isWhite && !isGray) {
            console.log('[HoYoLab Auto]', gameName, ': 未取得アイテム発見（色差異）');
            item.click();
            finish(true, emoji + ' ' + gameName + ': ログインボーナスを取得しました！');
            return;
          }
        }
      }

      // 取得済みアイテムがあれば「今日は取得済み」
      if (hasReceivedItems) {
        console.log('[HoYoLab Auto]', gameName, ': 取得済み（receivedマーカー検出）');
        finish(false, '✅ ' + gameName + ': 本日のボーナスは取得済みです');
        return;
      }

      // 何も検出できない場合
      finish(false, '✅ ' + gameName + ': ログインボーナスは取得済みです');
    } catch (e) {
      console.error('[HoYoLab Auto]', gameName, 'エラー:', e);
      finish(false, '❌ ' + gameName + ': 取得に失敗しました', 'error');
    }
  }

  // ===== メイン =====
  async function main() {
    console.log('[HoYoLab Auto] 開始:', gameType);
    switch (gameType) {
      case 'genshin': await autoClaimGenshin(); break;
      case 'starrail': await autoClaimPrizeList('スタレ', '🚂'); break;
      case 'zzz': await autoClaimPrizeList('ゼンゼロ', '⚡'); break;
    }
  }

  if (document.readyState === 'complete') {
    main();
  } else {
    window.addEventListener('load', main);
  }
})();
