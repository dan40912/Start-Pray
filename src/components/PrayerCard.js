import Link from "next/link";

/**
 * 代禱卡（grid 版）。
 *
 * 首頁禱告牆與詳情頁的「其他代禱」原本各自寫了一份幾乎相同的 JSX：同樣的
 * class、同樣的結構，但標籤列、語音鈕與回應數各長各的。兩邊只要有一邊被改
 * 到，就會漂移成兩種卡片。這裡收成一個。
 *
 * 首頁 hero（`.prayer-hero__card`）刻意不走這裡 —— 它是滿版的沉浸卡，不是
 * 格狀卡，硬併會讓兩邊都變形。
 *
 * 沒有 "use client"：詳情頁是 server component，禱告牆是 client component，
 * 兩邊都要能用。只有傳入 onPlay 時才會進到 client 樹。
 */
export default function PrayerCard({
  card,
  href,
  responseCount = 0,
  authorLabel,
  authorName,
  categoryName,
  coverLabel,
  // 「N 人正在代禱」。有這個徽章時，下方 metadata 就不再重複同一個數字。
  prayingLabel,
  responsesLabel,
  voiceLabel,
  playLabel,
  onPlay,
}) {
  const hasVoice = Boolean(card.voiceHref);
  const showsCountInBadge = Boolean(prayingLabel);

  return (
    <article className="home-card">
      <Link
        href={href}
        className="home-card__cover-link"
        aria-label={coverLabel}
        prefetch={false}
      />

      <div
        className="home-card__bg"
        style={card.image ? { backgroundImage: `url(${card.image})` } : undefined}
        aria-hidden="true"
      />

      <div className="home-card__content">
        <h4 className="home-card__title">{card.title}</h4>

        <div className="home-card__tag-row">
          <span className="home-card__category">{categoryName}</span>
          {hasVoice && voiceLabel ? (
            <span className="home-card__category home-card__category--voice">{voiceLabel}</span>
          ) : null}
          {prayingLabel ? (
            <span
              className={`home-card__prayer-badge${responseCount === 0 ? " is-empty" : ""}`}
            >
              {prayingLabel}
            </span>
          ) : null}
        </div>

        {hasVoice && onPlay ? (
          <div className="home-card__actions">
            <button
              type="button"
              className="home-card__action home-card__action--primary"
              onClick={(event) => onPlay(event, card)}
              aria-label={`${playLabel} "${card.title}"`}
            >
              <i className="fa-solid fa-play" aria-hidden="true" />
              {playLabel}
            </button>
          </div>
        ) : null}

        <div className="home-card__meta home-card__meta--bottom">
          <span className="home-card__author" title={`${authorLabel} ${authorName}`}>
            {authorLabel} {authorName}
          </span>
          {showsCountInBadge ? null : (
            <span className="home-card__responses">{responsesLabel}</span>
          )}
        </div>
      </div>
    </article>
  );
}
