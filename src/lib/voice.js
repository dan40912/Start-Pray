/**
 * 判斷一則代禱的 voiceHref 是不是真的播得動。
 *
 * 舊資料把 voiceHref 存成 legacy 詳情頁的網址
 * （`/legacy/prayfor/details.html?prayer=pc-101#voice`）—— 那是一個 HTML
 * 頁面，不是音檔。實測 31 張卡裡有 14 張標了語音，其中 8 張是這種舊路徑：
 * 那些「播放語音」按鈕按下去什麼都不會發生。過去看不出來，是因為常駐的播放
 * 列不管有沒有播都掛在畫面底部，看起來像在播（播的其實是別張卡的語音）。
 *
 * 這份判斷原本只存在於 HomePrayerHero 裡，禱告牆與卡片都沒有用，所以同一筆
 * 資料在 hero 被正確擋掉、在牆上卻長出一顆按不動的按鈕。收成一份。
 */
const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|webm|m4a|aac|ogg|oga|opus|flac)($|[?#])/i;

export function isPlayableVoiceHref(href) {
  if (typeof href !== "string" || !href.trim()) return false;
  const value = href.trim();
  if (value.startsWith("blob:")) return false;
  if (value.startsWith("data:audio/")) return true;
  if (value.startsWith("/legacy/")) return false;
  if (/\.html?($|[?#])/i.test(value)) return false;
  if (value.startsWith("/voices/") || value.startsWith("/uploads/")) return true;
  return AUDIO_EXTENSION_PATTERN.test(value);
}
