// 平台數據列。首頁（地球下方，深色）與 /terms 最上方（淺色）共用。
export default function PlatformStats({ items = [], locale = "zh-TW", tone = "dark", label = "Start Pray 平台數據" }) {
  if (!items.length) return null;

  return (
    <div className={`home-proof__stats platform-stats platform-stats--${tone}`} aria-label={label}>
      {items.map((item) => (
        <article key={item.key} className="home-proof__stat">
          <strong>{item.value.toLocaleString(locale)}</strong>
          <span>{item.label}</span>
          <p>{item.copy}</p>
        </article>
      ))}
    </div>
  );
}
