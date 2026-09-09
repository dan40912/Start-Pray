import Link from "next/link";

import "@/styles/theme-customer.css";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listPublicOvercomers } from "@/lib/overcomer-server";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "得勝者",
  description: "認識 Start Pray 上願意分享信仰故事、發佈代禱並回應他人的得勝者。",
  path: "/overcomer",
});

export const dynamic = "force-dynamic";

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=320&q=80";

function formatDateTime(value) {
  if (!value) return "尚未更新";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleDateString("zh-TW");
  }
}

export default async function OvercomerIndexPage() {
  const overcomers = await listPublicOvercomers();
  const totalCards = overcomers.reduce((sum, item) => sum + Number(item?._count?.homePrayerCards ?? 0), 0);
  const totalResponses = overcomers.reduce((sum, item) => sum + Number(item?._count?.prayerResponses ?? 0), 0);

  return (
    <>
      <SiteHeader activePath="/overcomer" />
      <main className="cp-main cp-main--overcomer">
        <section className="cp-section">
          <div className="cp-section__head">
            <div>
              <h1>得勝者</h1>
              <p>認識願意分享信仰故事、發佈代禱，並用禱告回應他人的 Start Pray 成員。</p>
            </div>
            <Link href="/signup" prefetch={false} className="cp-button">
              加入 Start Pray
            </Link>
          </div>

          <div className="home-stats__container">
            <article className="home-stats__item">
              <span className="home-stats__label">公開得勝者</span>
              <strong className="home-stats__value">{overcomers.length}</strong>
              <p className="home-stats__hint">願意公開分享故事與代禱參與的成員</p>
            </article>
            <article className="home-stats__item">
              <span className="home-stats__label">代禱</span>
              <strong className="home-stats__value">{totalCards.toLocaleString("zh-TW")}</strong>
              <p className="home-stats__hint">由得勝者發佈的代禱內容</p>
            </article>
            <article className="home-stats__item">
              <span className="home-stats__label">禱告回應</span>
              <strong className="home-stats__value">{totalResponses.toLocaleString("zh-TW")}</strong>
              <p className="home-stats__hint">他們參與並回應的代禱內容</p>
            </article>
          </div>
        </section>

        <section className="cp-section cp-section--cards">
          <div className="cp-section__head">
            <div>
              <h2>正在參與的得勝者</h2>
              <p>點進個人頁，看見他的自我介紹、故事、代禱與回應。</p>
            </div>
          </div>

          {overcomers.length === 0 ? (
            <div className="cp-empty">
              <p>目前尚未有公開的得勝者資料。</p>
              <Link href="/me" prefetch={false} className="cp-link">
                前往會員中心完善公開個人頁
              </Link>
            </div>
          ) : (
            <div className="cp-cards">
              {overcomers.map((item) => {
                const profileHref = `/overcomer/${encodeURIComponent(item.slug)}`;
                const avatarUrl = item.avatarUrl?.trim() || DEFAULT_AVATAR;
                const displayName = item.name || item.username || "未命名使用者";
                const bio = item.bio?.trim() || "尚未填寫自我介紹。";

                return (
                  <article key={item.id} className="cp-card">
                    <div className="cp-card__layout cp-card__layout--profile">
                      <Link href={profileHref} prefetch={false} className="cp-overcomer-card__avatar">
                        <img src={avatarUrl} alt={`${displayName} 的頭像`} loading="lazy" />
                      </Link>
                      <div className="cp-card__content">
                        <div className="cp-card__header">
                          <div className="cp-card__title">
                            <h3>{displayName}</h3>
                            <p className="cp-card__description">{bio}</p>
                          </div>
                          <span className="cp-status">公開中</span>
                        </div>

                        <div className="cp-card__meta">
                          <span>加入：{formatDateTime(item.createdAt)}</span>
                          <span>更新：{formatDateTime(item.updatedAt)}</span>
                          <span>代禱：{Number(item?._count?.homePrayerCards ?? 0).toLocaleString("zh-TW")}</span>
                          <span>回應：{Number(item?._count?.prayerResponses ?? 0).toLocaleString("zh-TW")}</span>
                        </div>

                        <div className="cp-card__actions">
                          <Link href={profileHref} className="cp-button" prefetch={false}>
                            查看故事
                          </Link>
                          <Link href="/prayfor" className="cp-button cp-button--ghost" prefetch={false}>
                            前往代禱牆
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
