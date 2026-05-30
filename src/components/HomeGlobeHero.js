"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { GlobalPrayerRoomEmbed } from "@/components/GlobalPrayerRoom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";

const DEFAULT_TEXT = {
  eyebrow: "全球禱告室",
  kicker: "一起為世界禱告",
  headline: "看見世界正在被記念",
  subheadline: "每一個光點，可能是一個人、一座城市，或一個還不知道怎麼開口的需要。你可以先看見，再聽聽，然後用你的方式參與。",
  primaryCta: "分享我的代禱",
  guestPrimaryCta: "先看禱告牆",
  roomCta: "進入全球禱告室",
  totalPrayers: "代禱事項",
  locationLights: "地點光點",
  todayNew: "24 小時內新增",
  audioPrayers: "語音禱告",
  emptyTitle: "還沒有可顯示的禱告光點",
  emptyCopy: "你可以分享第一個代禱，讓地圖先亮起一個光點。",
  mapAria: "全球禱告地圖",
  globeAria: "真實互動式全球代禱地球",
  globeLoading: "正在載入全球禱告地球",
  globeLoadErrorTitle: "全球禱告地球暫時無法載入",
  globeLoadErrorFallback: "全球禱告地球暫時無法載入，請稍後再試。",
  trustAria: "Start Pray 使用保障",
  statsAria: "全球禱告統計",
  hint: "你可以點擊地球上的光點，看看那個地方現在有哪些代禱需要。",
  zoomControlsAria: "地球縮放控制",
  zoomInAria: "放大地球",
  zoomOutAria: "縮小地球",
  modalAriaSuffix: "的禱告事項",
  modalClose: "關閉",
  modalEyebrow: "這裡的代禱",
  modalCopyPrefix: "這個光點目前有",
  modalCopySuffix: "筆代禱。你可以先看一下內容，再決定要不要進入完整頁面。",
  modalDetailLink: "查看詳情",
  modalEmptyTitle: "目前還沒有公開內容",
  modalEmptyCopy: "即使還沒有細節，這個地方仍然可以被記念。請為這裡的人安靜禱告。",
  prayerFallbackTitle: "等待被記念的禱告",
  privateTitle: "匿名代禱",
  defaultTitle: "未命名代禱",
  prayerFallbackExcerpt: "點擊地球上的光點後，這裡會整理出這個地點的代禱內容。",
  privateExcerpt: "這是一則私密代禱，請用溫柔和尊重為他禱告。",
  defaultExcerpt: "這則代禱還沒有寫下更多細節。",
  unknownLocation: "未知地點",
  locationSeparator: "，",
};

const TRUST_CHIPS = ["可匿名", "可語音", "不顯示精準位置"];

function getHeroText(locale) {
  const homeText = getDictionary(locale).home || {};
  return {
    ...DEFAULT_TEXT,
    ...(homeText.globeHero || {}),
  };
}

function getTrustChips(text) {
  return Array.isArray(text.trustChips) && text.trustChips.length ? text.trustChips : TRUST_CHIPS;
}

function isMappablePrayer(prayer) {
  return Number.isFinite(Number(prayer?.locationLat)) && Number.isFinite(Number(prayer?.locationLng));
}

function buildLatestPrayers(prayers) {
  return [...prayers]
    .filter(isMappablePrayer)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
}

function toPlainText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrayerTitle(prayer, text) {
  if (!prayer) return text.prayerFallbackTitle;
  return prayer.isPrivate ? text.privateTitle : prayer.title || text.defaultTitle;
}

function getPrayerExcerpt(prayer, text) {
  if (!prayer) return text.prayerFallbackExcerpt;
  if (prayer.isPrivate) return text.privateExcerpt;
  return toPlainText(prayer.description).slice(0, 96) || text.defaultExcerpt;
}

function getPrayerLocation(prayer, cluster, text) {
  if (cluster?.fullLabel) return cluster.fullLabel;
  if (!prayer?.locationCity) return text.unknownLocation;
  return prayer.locationCountry ? `${prayer.locationCity}${text.locationSeparator}${prayer.locationCountry}` : prayer.locationCity;
}

export function GlobeSkeleton({ hidden = false }) {
  return (
    <div className={`home-map-skeleton${hidden ? " is-hidden" : ""}`} aria-hidden="true">
      <div className="home-map-skeleton__halo" />
      <div className="home-map-skeleton__earth">
        <em />
        <span />
        <i />
        <b />
      </div>
      <div className="home-map-skeleton__scan" />
    </div>
  );
}

export function HeroGlobe({
  prayers,
  focusPrayerId,
  activeClusterId,
  onClusterSelect,
  onBlankClick,
  onReady,
  globeRef,
  title,
  text,
}) {
  return (
    <GlobalPrayerRoomEmbed
      prayers={prayers}
      title={title}
      ariaLabel={text.globeAria}
      loadingLabel={text.globeLoading}
      loadErrorTitle={text.globeLoadErrorTitle}
      loadErrorFallback={text.globeLoadErrorFallback}
      useImagery
      isHero
      fullscreen
      heroMap
      focusPrayerId={focusPrayerId}
      activeClusterId={activeClusterId}
      externalGlobeRef={globeRef}
      onHeroClusterSelect={onClusterSelect}
      onHeroBlankClick={onBlankClick}
      onHeroReady={onReady}
    />
  );
}

export default function HomeGlobeHero({
  prayers = [],
  primaryHref = "/global-prayer-room",
  secondaryHref = "/customer-portal/create",
  stats = {},
  locale: localeProp = "zh-TW",
}) {
  const locale = normalizeLocale(localeProp);
  const text = useMemo(() => getHeroText(locale), [locale]);
  const trustChips = useMemo(() => getTrustChips(text), [text]);
  const authUser = useAuthSession();
  const globeRef = useRef(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [activePrayerId, setActivePrayerId] = useState(null);
  const [globeReady, setGlobeReady] = useState(false);

  const latestPrayers = useMemo(() => buildLatestPrayers(prayers), [prayers]);
  const latestPrayer = latestPrayers[0] || null;
  const activeClusterId = selectedCluster?.id || null;
  const hasMarkers = prayers.some(isMappablePrayer);
  const liveCount = Number(String(stats.todayNew || 0).replace(/,/g, ""));
  const modalPrayers = selectedCluster?.prayers || [];
  const modalLocation = selectedCluster?.fullLabel || getPrayerLocation(latestPrayer, null, text);
  const primaryCtaHref = authUser ? secondaryHref : localizePath("/prayfor", locale);
  const primaryCtaLabel = authUser ? text.primaryCta : text.guestPrimaryCta;

  useEffect(() => {
    if (!activePrayerId && latestPrayer?.id) setActivePrayerId(latestPrayer.id);
  }, [activePrayerId, latestPrayer]);

  const closeModal = useCallback(() => {
    setSelectedCluster(null);
    globeRef.current?.clearActiveCluster?.();
  }, []);

  const focusPrayer = useCallback((prayer) => {
    if (prayer?.id) setActivePrayerId(prayer.id);
  }, []);

  const handleClusterSelect = useCallback(
    (cluster) => {
      if (!cluster) {
        closeModal();
        return;
      }
      setSelectedCluster(cluster);
      if (cluster.prayers?.[0]) focusPrayer(cluster.prayers[0]);
    },
    [closeModal, focusPrayer]
  );

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
    if (latestPrayer?.id) setActivePrayerId(latestPrayer.id);
  }, [latestPrayer?.id]);

  return (
    <section className="home-map-hero" aria-labelledby="home-map-title">
      <div className="home-map-hero__stars" aria-hidden="true" />
      <div className="home-map-hero__radar" aria-hidden="true" />
      <div className={`home-map-hero__globe${globeReady ? " is-ready" : ""}`} aria-label={text.mapAria}>
        <GlobeSkeleton hidden={globeReady} />
        <HeroGlobe
          prayers={prayers}
          focusPrayerId={activePrayerId}
          activeClusterId={activeClusterId}
          globeRef={globeRef}
          onClusterSelect={handleClusterSelect}
          onBlankClick={closeModal}
          onReady={handleGlobeReady}
          title={text.eyebrow}
          text={text}
        />
      </div>

      <div className="home-map-hero__shade" aria-hidden="true" />

      <div className="home-intel-brief">
        {/* <p>{text.eyebrow}</p> */}
        {/* <span className="home-intel-brief__kicker">{text.kicker}</span> */}
        <h1 id="home-map-title">{text.headline}</h1>
        <span>{text.subheadline}</span>
        {/* <div className="home-intel-trust" aria-label={text.trustAria}>
          {trustChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div> */}
        <div className="home-intel-brief__actions">
          <Link href={primaryCtaHref} className="button button--primary" prefetch={false}>
            {primaryCtaLabel}
          </Link>
          <Link href={primaryHref} className="button button--ghost" prefetch={false}>
            {text.roomCta}
          </Link>
        </div>
        <div className="home-intel-stats" aria-label={text.statsAria}>
          <span><b>{stats.totalPrayers}</b> {text.totalPrayers}</span>
          <span><b>{stats.locationLights}</b> {text.locationLights}</span>
          <span><b>{liveCount}</b> {text.todayNew}</span>
          <span><b>{stats.audioPrayers}</b> {text.audioPrayers}</span>
        </div>
        <p className="home-intel-brief__hint">
          {text.hint}
        </p>
      </div>

      <div className="home-map-controls" aria-label={text.zoomControlsAria}>
        <button type="button" onClick={() => globeRef.current?.zoomIn?.()} aria-label={text.zoomInAria}>
          +
        </button>
        <button type="button" onClick={() => globeRef.current?.zoomOut?.()} aria-label={text.zoomOutAria}>
          -
        </button>
      </div>

      {selectedCluster && !selectedCluster.isDefaultFocus ? (
        <aside className="home-prayer-modal" aria-label={`${modalLocation} ${text.modalAriaSuffix}`}>
          <button className="home-prayer-modal__close" type="button" onClick={closeModal}>
            {text.modalClose}
          </button>
          <span className="home-prayer-modal__eyebrow">{text.modalEyebrow}</span>
          <h2>{modalLocation}</h2>
          <p>{text.modalCopyPrefix} {modalPrayers.length} {text.modalCopySuffix}</p>
          <div className="home-prayer-modal__list">
            {modalPrayers.length ? (
              modalPrayers.slice(0, 6).map((prayer) => (
                <article key={prayer.id || `${prayer.locationLat}-${prayer.locationLng}-${prayer.title}`}>
                  <span>{getPrayerLocation(prayer, null, text)}</span>
                  <h3>{getPrayerTitle(prayer, text)}</h3>
                  <p>{getPrayerExcerpt(prayer, text)}</p>
                  {prayer?.id && !prayer?.isPrivate ? (
                    <Link href={localizePath(`/prayfor/${prayer.id}`, locale)} prefetch={false}>
                      {text.modalDetailLink}
                    </Link>
                  ) : null}
                </article>
              ))
            ) : (
              <article>
                <h3>{text.modalEmptyTitle}</h3>
                <p>{text.modalEmptyCopy}</p>
              </article>
            )}
          </div>
        </aside>
      ) : null}

      {!hasMarkers ? (
        <div className="home-map-hero__empty">
          <strong>{text.emptyTitle}</strong>
          <span>{text.emptyCopy}</span>
          <Link href={primaryCtaHref}>{primaryCtaLabel}</Link>
        </div>
      ) : null}

      <style jsx>{`
        .home-map-hero {
          --home-hero-body-size: 1rem;
          position: relative;
          left: 50%;
          right: 50%;
          width: 100vw;
          min-height: calc(100svh - var(--site-header-height, 56px));
          margin-left: -50vw;
          margin-right: -50vw;
          overflow: hidden;
          isolation: isolate;
          background: #020817;
        }

        .home-map-hero__stars,
        .home-map-hero__radar,
        .home-map-hero__shade {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .home-map-hero__stars {
          z-index: 2;
          opacity: 0.34;
          background-image:
            radial-gradient(circle at 16% 22%, rgba(255, 255, 255, 0.28) 0 1px, transparent 1px),
            radial-gradient(circle at 72% 36%, rgba(125, 211, 252, 0.3) 0 1px, transparent 1px),
            radial-gradient(circle at 84% 78%, rgba(250, 204, 21, 0.26) 0 1px, transparent 1px);
          background-size: 210px 180px, 260px 240px, 320px 260px;
        }

        .home-map-hero__radar {
          z-index: 3;
          opacity: 0.18;
          background:
            linear-gradient(rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.08) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(circle at 58% 48%, black, transparent 72%);
        }

        .home-map-hero__globe {
          position: absolute;
          inset: 0;
          z-index: 1;
          min-height: 100%;
          pointer-events: auto;
        }

        .home-map-hero__globe :global(.global-room-embed),
        .home-map-hero__globe :global(.global-room-embed--hero),
        .home-map-hero__globe :global(.global-room__canvas),
        .home-map-hero__globe :global(.cesium-viewer),
        .home-map-hero__globe :global(.cesium-viewer-cesiumWidgetContainer),
        .home-map-hero__globe :global(.cesium-widget),
        .home-map-hero__globe :global(.cesium-widget canvas) {
          width: 100% !important;
          height: 100% !important;
        }

        .home-map-hero__globe :global(.cesium-widget canvas) {
          touch-action: pan-y !important;
          opacity: 0;
          transition: opacity 420ms ease;
        }

        .home-map-hero__globe.is-ready :global(.cesium-widget canvas) {
          opacity: 1;
        }

        .home-map-hero__globe :global(.global-room__skeleton) {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }

        .home-map-hero__shade {
          z-index: 5;
          background:
            radial-gradient(circle at 60% 46%, transparent 0 34%, rgba(2, 6, 23, 0.28) 78%),
            linear-gradient(90deg, rgba(2, 6, 23, 0.7) 0%, rgba(2, 6, 23, 0.22) 28%, rgba(2, 6, 23, 0.02) 62%),
            linear-gradient(0deg, rgba(2, 6, 23, 0.64), transparent 38%, rgba(2, 6, 23, 0.08));
        }

        .home-intel-brief,
        .home-prayer-modal,
        .home-map-hero__empty {
          border: 1px solid rgba(253, 230, 138, 0.16);
          background:
            linear-gradient(145deg, rgba(20, 28, 43, 0.7), rgba(7, 16, 34, 0.56)),
            rgba(4, 10, 22, 0.44);
          box-shadow: 0 22px 72px rgba(2, 6, 23, 0.32);
          backdrop-filter: blur(18px);
        }

        .home-intel-brief {
          position: relative;
          z-index: 20;
          width: min(450px, calc(100% - 2rem));
          margin-left: clamp(1rem, 3vw, 3rem);
          margin-top: clamp(1rem, 3vh, 2.5rem);
          border-radius: 20px;
          padding: clamp(1rem, 1.75vw, 1.35rem);
          pointer-events: auto;
        }

        .home-intel-brief p,
        .home-intel-brief h1,
        .home-intel-brief span {
          margin: 0;
        }

        .home-intel-brief p,
        .home-intel-brief__kicker {
          color: #67e8f9;
          font-size: 0.86rem;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: none;
        }

        .home-intel-brief__kicker {
          display: block;
          margin-top: 0.48rem;
          color: rgba(253, 230, 138, 0.92);
          letter-spacing: 0;
          font-size: 0.95rem;
        }

        .home-intel-brief h1 {
          margin-top: 0.58rem;
          color: rgba(255, 255, 255, 0.96);
          font-size: clamp(2rem, 3.15vw, 3.25rem);
          line-height: 1.08;
          letter-spacing: 0;
          text-shadow: 0 16px 42px rgba(2, 6, 23, 0.5);
        }

        .home-intel-brief > span:not(.home-intel-brief__kicker) {
          display: block;
          margin-top: 0.75rem;
          max-width: 29rem;
          color: rgba(255, 247, 237, 0.86);
          font-size: 0.95rem;
          line-height: 1.62;
        }

        .home-intel-brief__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          margin-top: 0.95rem;
          align-items: center;
        }

        .home-intel-trust {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.82rem;
        }

        .home-intel-trust span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          border: 1px solid rgba(253, 230, 138, 0.2);
          border-radius: 999px;
          padding: 0.2rem 0.7rem;
          color: rgba(255, 247, 237, 0.86);
          background: rgba(255, 247, 237, 0.055);
          font-size: 0.84rem;
          font-weight: 700;
          letter-spacing: 0 !important;
          text-transform: none !important;
        }

        .home-intel-brief__actions :global(.button) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          border-radius: 999px;
          padding: 0 1.1rem;
          font-size: 0.94rem;
          font-weight: 800;
          line-height: 1;
          text-align: center;
        }

        .home-intel-brief__actions :global(.button--primary) {
          background: #f7d77a;
          border-color: rgba(253, 230, 138, 0.82);
          color: #241a05;
          box-shadow: 0 14px 34px rgba(250, 204, 21, 0.16);
        }

        .home-intel-brief__actions :global(.button--ghost) {
          border-color: rgba(226, 232, 240, 0.18);
          background: rgba(15, 23, 42, 0.22);
          color: rgba(248, 250, 252, 0.9);
        }

        .home-intel-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.42rem;
          margin-top: 0.82rem;
          padding-top: 0.72rem;
          border-top: 1px solid rgba(253, 230, 138, 0.14);
        }

        .home-intel-stats span {
          display: inline-flex;
          align-items: baseline;
          gap: 0.25rem;
          min-height: 30px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 999px;
          padding: 0.22rem 0.62rem;
          color: rgba(226, 232, 240, 0.72);
          background: rgba(15, 23, 42, 0.26);
          font-size: 0.8rem;
          letter-spacing: 0;
        }

        .home-intel-stats b {
          color: #fde68a;
          font-size: inherit;
        }

        .home-intel-brief__hint {
          margin-top: 0.78rem !important;
          border: 1px solid rgba(253, 230, 138, 0.14);
          border-radius: 14px;
          padding: 0.62rem 0.7rem;
          color: rgba(255, 247, 237, 0.76) !important;
          font-size: 0.86rem !important;
          line-height: 1.5;
          background: rgba(255, 247, 237, 0.055);
          letter-spacing: 0 !important;
          text-transform: none !important;
        }

        .home-map-controls {
          position: absolute;
          z-index: 28;
          right: clamp(1rem, 2.4vw, 2rem);
          bottom: clamp(1rem, 2.4vw, 2rem);
          display: grid;
          gap: 0.5rem;
          pointer-events: auto;
        }

        .home-map-controls button {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border: 1px solid rgba(253, 230, 138, 0.32);
          border-radius: 999px;
          color: #fef3c7;
          font-size: 1.35rem;
          font-weight: 900;
          background: rgba(4, 10, 22, 0.72);
          box-shadow: 0 16px 42px rgba(2, 6, 23, 0.36);
          cursor: pointer;
          backdrop-filter: blur(14px);
        }

        .home-prayer-modal {
          position: absolute;
          z-index: 30;
          top: clamp(1rem, 3vh, 2.5rem);
          right: clamp(1rem, 3vw, 3rem);
          display: grid;
          gap: 0.85rem;
          width: min(420px, calc(100vw - 2rem));
          max-height: min(72svh, 680px);
          overflow: auto;
          border-radius: 24px;
          padding: clamp(1rem, 2vw, 1.25rem);
          pointer-events: auto;
        }

        .home-prayer-modal__close {
          position: absolute;
          top: 0.8rem;
          right: 0.8rem;
          min-height: 34px;
          border: 1px solid rgba(226, 232, 240, 0.18);
          border-radius: 999px;
          padding: 0 0.75rem;
          color: #e2e8f0;
          font-weight: 800;
          background: rgba(15, 23, 42, 0.62);
          cursor: pointer;
        }

        .home-prayer-modal__eyebrow {
          color: #fde68a;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .home-prayer-modal h2 {
          margin: 0;
          padding-right: 4.6rem;
          color: #fffaf0;
          font-size: 1.45rem;
          line-height: 1.22;
        }

        .home-prayer-modal > p {
          margin: 0;
          color: rgba(255, 247, 237, 0.78);
          line-height: 1.65;
        }

        .home-prayer-modal__list {
          display: grid;
          gap: 0.72rem;
        }

        .home-prayer-modal__list article {
          display: grid;
          gap: 0.35rem;
          border: 1px solid rgba(253, 230, 138, 0.14);
          border-radius: 16px;
          padding: 0.85rem;
          background: rgba(255, 247, 237, 0.07);
        }

        .home-prayer-modal__list span {
          color: #fde68a;
          font-size: 0.76rem;
          font-weight: 800;
        }

        .home-prayer-modal__list h3 {
          margin: 0;
          color: #fffaf0;
          font-size: 1rem;
          line-height: 1.35;
        }

        .home-prayer-modal__list p {
          margin: 0;
          color: rgba(255, 247, 237, 0.76);
          font-size: 0.88rem;
          line-height: 1.62;
        }

        .home-prayer-modal__list a {
          width: fit-content;
          margin-top: 0.2rem;
          color: #fef3c7;
          font-weight: 900;
        }

        .home-map-hero__empty {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 24;
          display: grid;
          gap: 0.35rem;
          min-width: 280px;
          border-radius: 14px;
          padding: 1rem;
          text-align: center;
          transform: translate(-50%, -50%);
          pointer-events: auto;
        }

        .home-map-hero__empty a {
          color: #7dd3fc;
          font-weight: 900;
        }

        .home-map-skeleton {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 68% 48%, rgba(14, 165, 233, 0.2), transparent 32%),
            #020817;
          opacity: 1;
          transition: opacity 520ms ease, visibility 520ms ease;
          pointer-events: none;
        }

        .home-map-skeleton.is-hidden {
          visibility: hidden;
          opacity: 0;
        }

        .home-map-skeleton__halo,
        .home-map-skeleton__scan {
          position: absolute;
          right: min(3vw, 3.4rem);
          width: min(76vw, 930px);
          aspect-ratio: 1;
          border-radius: 50%;
          pointer-events: none;
        }

        .home-map-skeleton__halo {
          border: 1px solid rgba(125, 211, 252, 0.18);
          box-shadow:
            0 0 90px rgba(14, 165, 233, 0.16),
            inset 0 0 80px rgba(14, 165, 233, 0.08);
          animation: skeleton-halo 2.8s ease-in-out infinite;
        }

        .home-map-skeleton__scan {
          background:
            conic-gradient(from 130deg, transparent 0 68%, rgba(125, 211, 252, 0.28) 76%, transparent 86%),
            radial-gradient(circle, transparent 0 52%, rgba(125, 211, 252, 0.12) 53%, transparent 56%);
          opacity: 0.62;
          animation: skeleton-scan 3.2s linear infinite;
          mask-image: radial-gradient(circle, transparent 0 42%, black 43% 58%, transparent 62%);
        }

        .home-map-skeleton__earth {
          position: absolute;
          right: min(4vw, 4rem);
          width: min(72vw, 880px);
          aspect-ratio: 1;
          border-radius: 50%;
          background:
            radial-gradient(circle at 32% 26%, rgba(226, 232, 240, 0.22), transparent 18%),
            radial-gradient(circle at 52% 50%, rgba(14, 165, 233, 0.34), rgba(8, 47, 73, 0.72) 46%, #020817 72%);
          box-shadow: 0 0 90px rgba(14, 165, 233, 0.22);
          animation: skeleton-float 4.8s ease-in-out infinite;
        }

        .home-map-skeleton__earth::before,
        .home-map-skeleton__earth::after {
          content: "";
          position: absolute;
          inset: 12%;
          border-radius: 50%;
          pointer-events: none;
        }

        .home-map-skeleton__earth::before {
          border: 1px solid rgba(186, 230, 253, 0.16);
          transform: rotate(-18deg) scaleY(0.36);
        }

        .home-map-skeleton__earth::after {
          background:
            linear-gradient(90deg, transparent 0 48%, rgba(226, 232, 240, 0.18) 50%, transparent 52%),
            linear-gradient(0deg, transparent 0 48%, rgba(226, 232, 240, 0.12) 50%, transparent 52%);
          opacity: 0.42;
          mask-image: radial-gradient(circle, black 0 62%, transparent 63%);
        }

        .home-map-skeleton__earth em {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(110deg, transparent 0 38%, rgba(255, 255, 255, 0.2) 44%, transparent 50%),
            radial-gradient(ellipse at 62% 42%, rgba(54, 171, 112, 0.5) 0 9%, transparent 10%),
            radial-gradient(ellipse at 42% 58%, rgba(46, 142, 103, 0.42) 0 11%, transparent 12%);
          opacity: 0.76;
          animation: skeleton-shimmer 2.4s ease-in-out infinite;
        }

        .home-map-skeleton__earth span,
        .home-map-skeleton__earth i,
        .home-map-skeleton__earth b {
          position: absolute;
          border-radius: 999px;
          background: #fef08a;
          box-shadow: 0 0 24px rgba(250, 204, 21, 0.58);
        }

        .home-map-skeleton__earth span { left: 58%; top: 38%; width: 12px; height: 12px; }
        .home-map-skeleton__earth i { left: 46%; top: 54%; width: 9px; height: 9px; }
        .home-map-skeleton__earth b { left: 67%; top: 59%; width: 8px; height: 8px; }

        @keyframes skeleton-float {
          50% { transform: translateY(-12px) scale(1.015); }
        }

        @keyframes skeleton-halo {
          50% {
            opacity: 0.7;
            transform: scale(1.025);
          }
        }

        @keyframes skeleton-scan {
          to { transform: rotate(360deg); }
        }

        @keyframes skeleton-shimmer {
          50% { opacity: 0.52; transform: translateX(1.2%); }
        }

        @keyframes skeleton-float-mobile {
          50% { transform: translateX(50%) translateY(-10px) scale(1.015); }
        }

        @keyframes skeleton-halo-mobile {
          50% {
            opacity: 0.7;
            transform: translateX(50%) scale(1.025);
          }
        }

        @keyframes skeleton-scan-mobile {
          to { transform: translateX(50%) rotate(360deg); }
        }

        @media (max-width: 860px) {
          .home-map-hero {
            min-height: calc(100svh - var(--site-header-height, 56px));
          }

          .home-intel-brief {
            position: absolute;
            left: 0.75rem;
            right: 0.75rem;
            bottom: 0.8rem;
            width: auto;
            margin: 0;
            padding: 0.95rem;
            border-radius: 18px;
          }

          .home-intel-brief > p,
          .home-intel-brief__kicker,
          .home-intel-stats,
          .home-intel-brief__hint {
            display: none;
          }

          .home-intel-brief > span:not(.home-intel-brief__kicker) {
            display: block;
            margin-top: 0.55rem;
            max-width: 100%;
            font-size: var(--home-hero-body-size);
            line-height: 1.5;
          }

          .home-intel-trust {
            margin-top: 0.7rem;
            gap: 0.35rem;
          }

          .home-intel-trust span {
            min-height: 26px;
            padding: 0.16rem 0.56rem;
            font-size: var(--home-hero-body-size);
          }

          .home-intel-brief h1 {
            margin-top: 0;
            font-size: clamp(1.85rem, 8.5vw, 2.55rem);
            line-height: 1.08;
          }

          .home-intel-brief__actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.55rem;
            margin-top: 0.85rem;
          }

          .home-intel-brief__actions :global(.button) {
            width: 100%;
            min-height: 44px;
            padding: 0 0.75rem;
            font-size: var(--home-hero-body-size);
          }

          .home-prayer-modal {
            top: 0.75rem;
            left: 0.75rem;
            right: 0.75rem;
            width: auto;
            max-height: 52svh;
            border-radius: 20px;
          }

          .home-map-controls {
            right: 0.75rem;
            bottom: calc(7.2rem + env(safe-area-inset-bottom));
          }

          .home-map-skeleton__earth {
            right: 50%;
            width: min(86vw, 420px);
            transform: translateX(50%);
            animation-name: skeleton-float-mobile;
          }

          .home-map-skeleton__halo,
          .home-map-skeleton__scan {
            right: 50%;
            width: min(96vw, 480px);
            transform: translateX(50%);
          }

          .home-map-skeleton__halo {
            animation-name: skeleton-halo-mobile;
          }

          .home-map-skeleton__scan {
            animation-name: skeleton-scan-mobile;
          }

        }

        @media (max-width: 380px) {
          .home-intel-brief__actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
