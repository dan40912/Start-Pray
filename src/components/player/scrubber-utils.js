// 進度條的純計算。沒有 React、沒有 DOM —— 和 home-companion/swipe-utils.js 同一個
// 用意：時長未知、除以零、鍵盤步進這幾件最容易寫錯的事，要能用 node --test 釘住。

// 左右鍵一次 5 秒，大約是「我漏聽了一句」的尺度；Shift 給 15 秒讓人跨過一段。
export const SEEK_STEP_SECONDS = 5;
export const SEEK_STEP_LARGE_SECONDS = 15;

// 時長是不是能用來換算位置。音檔還在載、佇列是空的、或拿到 NaN 時都不能算比例，
// 呼叫端看到 false 就不該送出 seek。
export function isSeekableDuration(duration) {
  return Number.isFinite(duration) && duration > 0;
}

export function clampTime(value, duration) {
  if (!isSeekableDuration(duration)) return null;
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(value, 0), duration);
}

// 指標位置 → 秒數。ratio 允許超出 0–1（手指拖出軌道兩端），夾回範圍內即可。
export function timeFromRatio(ratio, duration) {
  if (!isSeekableDuration(duration)) return null;
  if (!Number.isFinite(ratio)) return null;
  return Math.min(Math.max(ratio, 0), 1) * duration;
}

// 軌道矩形 + clientX → ratio。寬度為 0（尚未佈局、display:none）時回 null，
// 不要讓 0 寬度變成 Infinity。
export function ratioFromPointer(clientX, rect) {
  if (!rect || !Number.isFinite(clientX)) return null;
  const width = Number(rect.width);
  if (!Number.isFinite(width) || width <= 0) return null;
  const left = Number(rect.left);
  if (!Number.isFinite(left)) return null;
  return Math.min(Math.max((clientX - left) / width, 0), 1);
}

// 填色百分比。時長不能用時回 0，而不是 NaN —— NaN 會讓 style.width 整個失效。
export function percentFromTime(value, duration) {
  if (!isSeekableDuration(duration)) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max((value / duration) * 100, 0), 100);
}

/**
 * 鍵盤調整位置。回 null 表示「這個鍵不是進度條的事」，呼叫端就不要 preventDefault，
 * 讓 Tab、Enter、空白鍵照原本的方式傳下去。
 *
 * 上／右增加、下／左減少是 ARIA slider 的既定方向，橫向滑桿也要吃上下鍵。
 */
export function resolveKeyboardSeek({ key, shiftKey = false } = {}, current, duration) {
  if (!isSeekableDuration(duration)) return null;
  const step = shiftKey ? SEEK_STEP_LARGE_SECONDS : SEEK_STEP_SECONDS;
  const base = Number.isFinite(current) ? current : 0;

  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clampTime(base - step, duration);
    case "ArrowRight":
    case "ArrowUp":
      return clampTime(base + step, duration);
    case "PageDown":
      return clampTime(base - SEEK_STEP_LARGE_SECONDS, duration);
    case "PageUp":
      return clampTime(base + SEEK_STEP_LARGE_SECONDS, duration);
    case "Home":
      return 0;
    case "End":
      return duration;
    default:
      return null;
  }
}
