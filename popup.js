// HoYoLab ログインボーナス - ポップアップスクリプト
// 直接タブを開くだけのシンプルな構造（backgroundへのメッセージ不要）

const GAME_URLS = {
  genshin: 'https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481&lang=ja-jp',
  starrail: 'https://act.hoyolab.com/bbs/event/signin/hkrpg/e202303301540311.html?act_id=e202303301540311&lang=ja-jp',
  zzz: 'https://act.hoyolab.com/bbs/event/signin/zzz/e202406031448091.html?act_id=e202406031448091&lang=ja-jp'
};

// 個別ゲームのタブを開く（content scriptが自動取得→backgroundがタブを閉じる）
function openGame(gameKey) {
  const url = GAME_URLS[gameKey];
  if (url) {
    chrome.tabs.create({ url, active: false });
  }
}

// すべてのゲームのタブを開く
function openAllGames() {
  Object.values(GAME_URLS).forEach(url => {
    chrome.tabs.create({ url, active: false });
  });
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => openGame(card.dataset.game));
  });

  document.getElementById('openAll').addEventListener('click', openAllGames);
});
