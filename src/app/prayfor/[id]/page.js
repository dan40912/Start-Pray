import Link from "next/link";
import { notFound } from "next/navigation";

import Comments from "@/components/Comments";
import DetailAudioQueueBootstrap from "@/components/prayer-detail/DetailAudioQueueBootstrap";
import DetailPrayerInteractionPanel from "@/components/prayer-detail/DetailPrayerInteractionPanel";
import PrayerRequestActions from "@/components/PrayerRequestActions";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { parseCardMeta } from "@/lib/card-meta";
import {
  readAdjacentHomeCards,
  readHomeCard,
  readRelatedHomeCards,
} from "@/lib/homeCards";
import { sanitizeHtmlForDisplay, sanitizeHtmlToPlainText } from "@/lib/htmlSanitizer";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import { resolveServerAudioUrl } from "@/lib/server-audio";
import { buildPageMetadata } from "@/lib/seo";

import "@/styles/theme-detail.css";

export const dynamic = "force-dynamic";

function parseId(paramValue) {
  const raw = typeof paramValue === "string" ? paramValue.trim() : "";
  if (!raw) return null;
  const value = raw.split("%2B").join("+");
  const match = value.match(/^(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function formatResponseCount(count) {
  const safe = Number(count) || 0;
  if (safe >= 1000) {
    return `${(safe / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(safe);
}

function getAuthorName(card, text) {
  return card?.owner?.name?.trim?.() || text.unnamedUser;
}

function buildPrayerMetaDescription(description) {
  const plain = sanitizeHtmlToPlainText(description).replace(/\s+/g, " ").trim();
  if (!plain) {
    return "讓我們一起禱告，願這份需要被看見並得到回應。";
  }
  const snippet = plain.length > 120 ? `${plain.slice(0, 120).trim()}...` : plain;
  return `讓我們一起禱告，${snippet}`;
}

export async function generateMetadata({ params }) {
  const id = parseId(params?.id);
  if (!id) {
    return buildPageMetadata({
      title: "禱告內容",
      description: "讓我們一起禱告，願這份需要被看見並得到回應。",
      path: "/prayfor",
      image: "/img/categories/popular.jpg",
    });
  }
  const card = await readHomeCard(id);
  if (!card) {
    return buildPageMetadata({
      title: "禱告內容",
      description: "讓我們一起禱告，願這份需要被看見並得到回應。",
      path: "/prayfor",
      image: "/img/categories/popular.jpg",
    });
  }
  return buildPageMetadata({
    title: card.title ? `${card.title} - 禱告內容` : "禱告內容",
    description: buildPrayerMetaDescription(card.description),
    path: `/prayfor/${card.id}`,
    image: card.image || "/img/categories/popular.jpg",
    type: "article",
  });
}

export default async function PrayerDetailPage({ params, locale: localeProp = "zh-TW" }) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale).prayerDetail;
  const id = parseId(params?.id);
  if (!id) return notFound();

  const [card, relatedCards, adjacentCards] = await Promise.all([
    readHomeCard(id),
    readRelatedHomeCards(id, 4),
    readAdjacentHomeCards(id),
  ]);

  if (!card) return notFound();

  const owner = card.owner ?? null;
  const ownerName = getAuthorName(card, text);
  const ownerAvatar = owner?.avatarUrl?.trim?.() || "";
  const updatedDisplay = card.updatedAt
    ? new Date(card.updatedAt).toLocaleDateString(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : text.notUpdated;
  const createdDisplay = card.createdAt
    ? new Date(card.createdAt).toLocaleDateString(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : updatedDisplay;

  const detailImage = card.image || "/img/categories/popular.jpg";
  const galleryImages = parseCardMeta(card.meta).gallery
    .filter((url) => typeof url === "string" && url.startsWith("/uploads/"))
    .slice(0, 3);
  const plainDescription = sanitizeHtmlToPlainText(card.description || "");
  const descriptionHtml = sanitizeHtmlForDisplay(card.description || `<p>${text.emptyDescription}</p>`);
  const responseCount = Number(card?._count?.responses || 0);
  const normalizedVoiceHref = resolveServerAudioUrl(card.voiceHref);
  const initialTrack = normalizedVoiceHref
    ? {
        id: `primary-${card.id}`,
        homeCardId: card.id,
        voiceUrl: normalizedVoiceHref,
        speaker: ownerName,
        message: card.title,
        avatarUrl: ownerAvatar,
        requestTitle: card.title,
        coverImage: detailImage,
      }
    : null;

  const previousCard = adjacentCards?.prev || null;
  const nextCard = adjacentCards?.next || null;

  return (
    <>
      <SiteHeader activePath={localizePath("/prayfor", locale)} locale={locale} />

      <main className="pdv2-page">
        {previousCard ? (
          <Link href={localizePath(`/prayfor/${previousCard.id}`, locale)} prefetch={false} className="pdv2-nav-arrow pdv2-nav-arrow--prev" aria-label={`${text.previous}: ${previousCard.title}`}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </Link>
        ) : (
          <span className="pdv2-nav-arrow pdv2-nav-arrow--prev is-disabled" aria-hidden="true">
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </span>
        )}

        {nextCard ? (
          <Link href={localizePath(`/prayfor/${nextCard.id}`, locale)} prefetch={false} className="pdv2-nav-arrow pdv2-nav-arrow--next" aria-label={`${text.next}: ${nextCard.title}`}>
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </Link>
        ) : (
          <span className="pdv2-nav-arrow pdv2-nav-arrow--next is-disabled" aria-hidden="true">
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </span>
        )}

        <div className="pdv2-shell">
          <Link href={localizePath("/prayfor", locale)} prefetch={false} className="pdv2-back-link">
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            {text.backToWall}
          </Link>

          <article className="pdv2-hero-card">
            <div className="pdv2-hero-image-wrap">
              <img src={detailImage} alt={card.title} loading="lazy" />
            </div>

            <div className="pdv2-hero-body">
              <div className="pdv2-title-row">
                <h1>{card.title}</h1>
                <div className="pdv2-hero-actions">
                  <Link href="#responses-panel" prefetch={false} className="pdv2-follow-btn">
                    {text.leavePrayer}
                  </Link>
                  <PrayerRequestActions
                    cardId={card.id}
                    canonicalUrl={localizePath(`/prayfor/${card.id}`, locale)}
                    title={card.title}
                    description={plainDescription}
                    reportCount={card.reportCount}
                    shareLabel={text.shareGroup}
                  />
                </div>
              </div>

              <div className="pdv2-meta-row">
                {/* <span>更新日期：{updatedDisplay}</span> */}
                <span>{text.createdAt}: {createdDisplay}</span>
                <span>{text.uploader}: {ownerName}</span>
                {/* <span>回應數：{responseCount}</span> */}
              </div>
            </div>
          </article>

          <DetailPrayerInteractionPanel prayerId={card.id} locale={locale} />

          <section className="pdv2-companion-panel" aria-labelledby="companion-actions-title">
            <div className="pdv2-companion-panel__intro">
              <span>{text.nextStepEyebrow}</span>
              <h2 id="companion-actions-title">{text.nextStepTitle}</h2>
              <p>{text.nextStepCopy}</p>
            </div>
            <div className="pdv2-companion-actions">
              <Link href="#response-composer" prefetch={false} className="pdv2-companion-action">
                <strong>{text.textPrayerTitle}</strong>
                <span>{text.textPrayerCopy}</span>
              </Link>
              <Link href="#response-composer" prefetch={false} className="pdv2-companion-action">
                <strong>{text.voicePrayerTitle}</strong>
                <span>{text.voicePrayerCopy}</span>
              </Link>
              <div className="pdv2-companion-action pdv2-companion-action--share">
                <strong>{text.groupShareTitle}</strong>
                <span>{text.groupShareCopy}</span>
                <PrayerRequestActions
                  cardId={card.id}
                  canonicalUrl={localizePath(`/prayfor/${card.id}`, locale)}
                  title={card.title}
                  description={plainDescription}
                  reportCount={card.reportCount}
                  shareLabel={text.copyShareLink}
                />
              </div>
            </div>
          </section>

          <article className="pdv2-content-card">
            <div className="pdv2-content-body" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
          </article>

          {galleryImages.length ? (
            <section className="pdv2-gallery-card" aria-labelledby="prayer-gallery-title">
              <div className="pdv2-gallery-card__head">
                <h2 id="prayer-gallery-title">代禱相簿</h2>
                <span>{galleryImages.length} 張圖片</span>
              </div>
              <div className="pdv2-gallery-card__grid">
                {galleryImages.map((url, index) => (
                  <figure key={url} className="pdv2-gallery-card__item">
                    <img
                      src={url}
                      alt={`${card.title} 相簿圖片 ${index + 1}`}
                      loading="lazy"
                    />
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <section className="pdv2-comments-card" id="responses-panel">
            <div className="pdv2-comments-head">
              <h2>{text.responsesTitle}</h2>
            </div>
            <Comments requestId={String(card.id)} ownerId={owner?.id} prayerTitle={card.title} locale={locale} />
          </section>

          <section className="pdv2-adjacent" aria-label={text.adjacentLabel}>
            <h2>{text.continueBrowse}</h2>
            <div className="pdv2-adjacent-grid">
              {previousCard ? (
                <Link href={localizePath(`/prayfor/${previousCard.id}`, locale)} prefetch={false} className="pdv2-adjacent-card">
                  <span className="pdv2-adjacent-card__label">{text.previous}</span>
                  <strong>{previousCard.title}</strong>
                </Link>
              ) : (
                <div className="pdv2-adjacent-card is-disabled" aria-disabled="true">
                  <span className="pdv2-adjacent-card__label">{text.previous}</span>
                  <strong>{text.noPrevious}</strong>
                </div>
              )}

              {nextCard ? (
                <Link href={localizePath(`/prayfor/${nextCard.id}`, locale)} prefetch={false} className="pdv2-adjacent-card">
                  <span className="pdv2-adjacent-card__label">{text.next}</span>
                  <strong>{nextCard.title}</strong>
                </Link>
              ) : (
                <div className="pdv2-adjacent-card is-disabled" aria-disabled="true">
                  <span className="pdv2-adjacent-card__label">{text.next}</span>
                  <strong>{text.noNext}</strong>
                </div>
              )}
            </div>
          </section>

          {relatedCards?.length ? (
            <section className="pdv2-related-section" aria-label="其他代禱">
              <div className="pdv2-related-head">
                <h2>{text.relatedTitle}</h2>
                <Link href={localizePath("/prayfor", locale)} prefetch={false}>
                  {text.viewMore}
                </Link>
              </div>

              <div className="home-card-grid pdv2-home-card-grid">
                {relatedCards.map((item) => {
                  const relatedAuthor = getAuthorName(item, text);
                  const relatedCount = item?._count?.responses ?? item?.responsesCount ?? 0;
                  return (
                    <article key={item.id} className="home-card">
                      <Link
                        href={localizePath(`/prayfor/${item.id}`, locale)}
                        prefetch={false}
                        className="home-card__cover-link"
                        aria-label={`${text.viewMore} ${item.title}`}
                      />

                      <div
                        className="home-card__bg"
                        style={item.image ? { backgroundImage: `url(${item.image})` } : undefined}
                        aria-hidden="true"
                      />

                      <div className="home-card__content">
                        <h4 className="home-card__title">{item.title}</h4>
                        <div className="home-card__tag-row">
                          <span className="home-card__category">{item.category?.name || text.prayerCategoryFallback}</span>
                        </div>
                        <div className="home-card__meta home-card__meta--bottom">
                          <span className="home-card__author" title={`${text.author}: ${relatedAuthor}`}>
                            {text.author}: {relatedAuthor}
                          </span>
                          <span className="home-card__responses">{formatResponseCount(relatedCount)} {text.responsesSuffix}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="pdv2-sticky-actions" aria-label={text.quickActions}>
          <Link href="#response-composer" prefetch={false}>
            {text.leavePrayer}
          </Link>
          <Link href="#response-composer" prefetch={false}>
            {text.recordVoice}
          </Link>
          <Link href={`${localizePath("/login", locale)}?next=${encodeURIComponent(`/prayfor/${card.id}`)}`} prefetch={false}>
            {text.loginToRespond}
          </Link>
        </div>
      </main>

      <DetailAudioQueueBootstrap
        requestId={String(card.id)}
        prayerTitle={card.title}
        initialTrack={initialTrack}
      />

      <SiteFooter locale={locale} />
    </>
  );
}
