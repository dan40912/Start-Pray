import Link from "next/link";
import GainAudio from "@/components/GainAudio";
import { notFound, redirect } from "next/navigation";

import "@/styles/theme-customer.css";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import OvercomerReportButton from "@/components/OvercomerReportButton";
import ResponseReportButton from "@/components/ResponseReportButton";
import { buildOvercomerCardPath, buildOvercomerResponsePath, readOvercomerProfile } from "@/lib/overcomer-server";
import { buildOvercomerSlug, parseOvercomerSlug } from "@/lib/overcomer";
import { resolveServerAudioUrl } from "@/lib/server-audio";
import { buildYoutubeEmbedUrl } from "@/lib/youtube";
import { buildPageMetadata, plainText } from "@/lib/seo";

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=320&q=80";

function formatDateTime(value) {
  if (!value) return "尚未更新";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    console.error("formatDateTime failed", error);
    return new Date(value).toLocaleString();
  }
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const parsed = parseOvercomerSlug(params?.slug);
  if (!parsed?.username) {
    return buildPageMetadata({
      title: "得勝者",
      description: "查看 Start Pray 得勝者公開分享的信仰故事、代禱與回應紀錄。",
      path: "/overcomer",
    });
  }

  const profile = await readOvercomerProfile(parsed.username);
  if (!profile) {
    return buildPageMetadata({
      title: "得勝者",
      description: "查看 Start Pray 得勝者公開分享的信仰故事、代禱與回應紀錄。",
      path: "/overcomer",
    });
  }

  const displayName = profile.name || profile.username || "得勝者";
  const description =
    plainText(profile.bio, 150) ||
    `認識 ${displayName} 在 Start Pray 的信仰故事、代禱與禱告回應。`;

  return buildPageMetadata({
    title: `${displayName} 的得勝者故事`,
    description,
    path: `/overcomer/${encodeURIComponent(buildOvercomerSlug(profile))}`,
    image: profile.avatarUrl || DEFAULT_AVATAR,
    type: "profile",
  });
}

export default async function OvercomerProfilePage({ params }) {
  const parsed = parseOvercomerSlug(params?.slug);
  if (!parsed?.username) {
    return notFound();
  }

  const profile = await readOvercomerProfile(parsed.username);
  if (!profile) {
    return notFound();
  }

  const canonicalSlug = buildOvercomerSlug(profile);
  if (!canonicalSlug) {
    return notFound();
  }

  if (parsed.username !== canonicalSlug) {
    redirect(`/overcomer/${encodeURIComponent(canonicalSlug)}`);
  }

  const avatarUrl = profile.avatarUrl?.trim() || DEFAULT_AVATAR;
  const cards = profile.homePrayerCards ?? [];
  const responses = profile.prayerResponses ?? [];
  const totalCards = profile._count?.homePrayerCards ?? cards.length;
  const totalResponses = profile._count?.prayerResponses ?? responses.length;
  const latestCardLink = cards.length > 0 ? buildOvercomerCardPath(cards[0]) : null;
  const storyAudioUrl = resolveServerAudioUrl(profile.storyAudioUrl);
  const storyYoutubeEmbedUrl = buildYoutubeEmbedUrl(profile.storyYoutubeUrl);

  return (
    <>
      <SiteHeader activePath="/overcomer" />
      <main className="cp-main cp-main--overcomer">
        <section className="cp-profile">
          <div className="cp-profile__avatar">
            <img src={avatarUrl} alt={`${profile.name || "使用者"} 大頭貼`} loading="lazy" />
          </div>
          <div className="cp-profile__info">
            <h1>{profile.name || profile.username || "匿名使用者"}</h1>
            <p className="cp-helper">{profile.bio || "這位勇士尚未撰寫個人介紹。"}</p>
            <div className="cp-card__meta">
              <span>加入時間：{formatDateTime(profile.createdAt)}</span>
              <span>最近更新：{formatDateTime(profile.updatedAt)}</span>
              <span>公開代禱：{totalCards}</span>
              <span>公開回應：{totalResponses}</span>
            </div>
            <div className="cp-profile__actions">
              {latestCardLink ? (
                <Link href={latestCardLink} prefetch={false} className="cp-button">
                  為他代禱
                </Link>
              ) : null}
              <Link href="/overcomer" prefetch={false} className="cp-button cp-button--ghost">
                查看更多得勝者
              </Link>
            </div>
            <OvercomerReportButton
              targetUserId={profile.id}
              targetUsername={profile.username}
              targetDisplayName={profile.name || profile.username}
            />
          </div>
        </section>

        {(storyAudioUrl || storyYoutubeEmbedUrl) ? (
          <section className="cp-section cp-section--story">
            <div className="cp-section__head">
              <div>
                <h2>得勝者故事</h2>
                <p>聽見 {profile.name || profile.username || "這位得勝者"} 的信仰歷程、理念與代禱負擔。</p>
              </div>
            </div>
            <div className="cp-story-media">
              {storyAudioUrl ? (
                <article className="cp-story-media__item">
                  <h3>故事錄音</h3>
                  <GainAudio controls preload="metadata" src={storyAudioUrl}>
                    你的瀏覽器不支援音訊播放。
                  </GainAudio>
                  {profile.storyUpdatedAt ? (
                    <p className="cp-helper">更新：{formatDateTime(profile.storyUpdatedAt)}</p>
                  ) : null}
                </article>
              ) : null}
              {storyYoutubeEmbedUrl ? (
                <article className="cp-story-media__item">
                  <h3>YouTube 影片</h3>
                  <div className="cp-story-media__video">
                    <iframe
                      src={storyYoutubeEmbedUrl}
                      title={`${profile.name || profile.username || "得勝者"} 的 YouTube 故事`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="cp-section cp-section--cards">
          <div className="cp-section__head">
            <div>
              <h2>已發佈的代禱</h2>
              <p>瀏覽 {profile.name || profile.username || "這位帶禱者"} 分享的最新禱告內容。</p>
            </div>
          </div>
          {cards.length === 0 ? (
            <p className="cp-helper">尚未發佈任何代禱。</p>
          ) : (
            <div className="cp-cards">
              {cards.map((card) => {
                const link = buildOvercomerCardPath(card);
                const coverAlt = card.alt || `${card.title || "代禱"} 封面`;
                return (
                  <article key={card.id} className="cp-card">
                    <div className="cp-card__layout">
                      <div className="cp-card__cover">
                        {link ? (
                          <Link href={link} prefetch={false} className="cp-card__cover-link">
                            {card.image ? (
                              <img src={card.image} alt={coverAlt} loading="lazy" />
                            ) : (
                              <div className="cp-card__placeholder">尚無封面</div>
                            )}
                          </Link>
                        ) : card.image ? (
                          <img src={card.image} alt={coverAlt} loading="lazy" />
                        ) : (
                          <div className="cp-card__placeholder">尚無封面</div>
                        )}
                      </div>
                      <div className="cp-card__content">
                        <div className="cp-card__title">
                          <h3>{card.title || "暫未命名的代禱"}</h3>
                          {card.description ? (
                            <p className="cp-card__description">{card.description}</p>
                          ) : (
                            <p className="cp-helper">尚未提供詳細敘述。</p>
                          )}
                        </div>
                        <div className="cp-card__meta">
                          <span>更新時間：{formatDateTime(card.updatedAt)}</span>
                          <span>禱告錄音：{card._count?.responses ?? 0}</span>
                        </div>
                        {link ? (
                          <Link href={link} className="cp-link" prefetch={false}>
                            前往查看
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="cp-section cp-section--replies">
          <div className="cp-section__head">
            <div>
              <h2>個人回應</h2>
              <p>聆聽 {profile.name || profile.username || "這位帶禱者"} 的禱告同行記錄。</p>
            </div>
          </div>
          {responses.length === 0 ? (
            <p className="cp-helper">目前尚未有個人回應。</p>
          ) : (
            <div className="cp-replies">
              {responses.map((reply) => {
                const cardTitle = reply.homeCard?.title || "代禱";
                const cardAlt = reply.homeCard?.alt || `${cardTitle} 封面`;
                const cardImage = reply.homeCard?.image || null;
                const cardLink = buildOvercomerResponsePath(reply);
                const reportCount = reply.reportCount ?? 0;
                const publishedAt = formatDateTime(reply.createdAt);
                return (
                  <article key={reply.id} className="cp-reply">
                    <div className="cp-reply__header">
                      <div className="cp-reply__card">
                        {cardImage ? (
                          <img
                            src={cardImage}
                            alt={cardAlt}
                            className="cp-reply__thumb"
                            loading="lazy"
                          />
                        ) : (
                          <span
                            className="cp-reply__thumb cp-reply__thumb--placeholder"
                            aria-hidden="true"
                          >
                            🙏
                          </span>
                        )}
                        <div className="cp-reply__card-info">
                          <h3>{cardTitle}</h3>
                          {cardLink ? (
                            <Link href={cardLink} prefetch={false} className="cp-link">
                              查看代禱
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <ResponseReportButton responseId={reply.id} triggerLabel="檢舉" />
                    </div>

                    {reply.message ? (
                      <p className="cp-reply__content">{reply.message}</p>
                    ) : null}

                    {reply.voiceUrl ? (
                      <GainAudio
                        className="cp-reply__audio"
                        controls
                        preload="none"
                        src={reply.voiceUrl}
                      >
                        您的瀏覽器不支援音訊播放。
                      </GainAudio>
                    ) : null}

                    <div className="cp-reply__footer">
                      <div className="cp-reply__meta">
                        <span>發佈時間：{publishedAt}</span>
                        <span>檢舉數：{reportCount}</span>
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

