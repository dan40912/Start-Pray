import Link from "next/link";
import { notFound } from "next/navigation";

import Comments from "@/components/Comments";
import DetailAudioQueueBootstrap from "@/components/prayer-detail/DetailAudioQueueBootstrap";
import DetailPrayerListenButton from "@/components/prayer-detail/DetailPrayerListenButton";
import PrayerCard from "@/components/PrayerCard";
import PrayerRequestActions from "@/components/PrayerRequestActions";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { parseCardMeta } from "@/lib/card-meta";
import { readAdjacentHomeCards, readHomeCard, readRelatedHomeCards } from "@/lib/homeCards";
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
    image: `/api/prayer-og/${card.id}?v=${new Date(card.updatedAt || card.createdAt).getTime()}`,
    imageWidth: 1200,
    imageHeight: 630,
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
  const galleryImages = parseCardMeta(card.meta)
    .gallery.filter((url) => typeof url === "string" && url.startsWith("/uploads/"))
    .slice(0, 3);
  const plainDescription = sanitizeHtmlToPlainText(card.description || "");
  const descriptionHtml = sanitizeHtmlForDisplay(
    card.description || `<p>${text.emptyDescription}</p>`
  );

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
          <Link
            href={localizePath(`/prayfor/${previousCard.id}`, locale)}
            prefetch={false}
            className="pdv2-nav-arrow pdv2-nav-arrow--prev"
            aria-label={`${text.previous}: ${previousCard.title}`}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </Link>
        ) : (
          <span className="pdv2-nav-arrow pdv2-nav-arrow--prev is-disabled" aria-hidden="true">
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </span>
        )}

        {nextCard ? (
          <Link
            href={localizePath(`/prayfor/${nextCard.id}`, locale)}
            prefetch={false}
            className="pdv2-nav-arrow pdv2-nav-arrow--next"
            aria-label={`${text.next}: ${nextCard.title}`}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </Link>
        ) : (
          <span className="pdv2-nav-arrow pdv2-nav-arrow--next is-disabled" aria-hidden="true">
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </span>
        )}

        <div className="pdv2-shell">
          <article className="pdv2-hero-card">
            <div className="pdv2-hero-image-wrap">
              <Link
                href={localizePath("/prayfor", locale)}
                prefetch={false}
                className="pdv2-back-link"
                aria-label={text.backToWall}
                title={text.backToWall}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m14 6-6 6 6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <img src={detailImage} alt={card.title} loading="eager" />
            </div>

            <div className="pdv2-hero-body">
              <div className="pdv2-title-row">
                <h1>{card.title}</h1>
                <div className="pdv2-hero-actions">
                  <Link href="#response-composer" prefetch={false} className="pdv2-follow-btn">
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
                <span>
                  {ownerName} · {createdDisplay}
                </span>
              </div>
            </div>
          </article>

          <article className="pdv2-content-card">
            <div
              className="pdv2-content-body"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
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
                    <img src={url} alt={`${card.title} 相簿圖片 ${index + 1}`} loading="lazy" />
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <section className="pdv2-comments-card" id="responses-panel">
            <Comments
              responseHeader={
                <div className="pdv2-comments-head">
                  <h2>{text.responsesTitle}</h2>
                  <DetailPrayerListenButton
                    prayerId={card.id}
                    locale={locale}
                    prayerTitle={card.title || ""}
                    coverImage={detailImage}
                  />
                </div>
              }
              requestId={String(card.id)}
              ownerId={owner?.id}
              prayerTitle={card.title}
              locale={locale}
            />
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
                    <PrayerCard
                      key={item.id}
                      card={item}
                      href={localizePath(`/prayfor/${item.id}`, locale)}
                      responseCount={relatedCount}
                      coverLabel={`${text.viewMore} ${item.title}`}
                      categoryName={item.category?.name || text.prayerCategoryFallback}
                      authorLabel={`${text.author}:`}
                      authorName={relatedAuthor}
                      responsesLabel={`${formatResponseCount(relatedCount)} ${text.responsesSuffix}`}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}
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
