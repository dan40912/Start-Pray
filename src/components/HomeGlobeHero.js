"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { GlobalPrayerRoomEmbed } from "@/components/GlobalPrayerRoom";

const TEXT = {
  eyebrow: "全球禱告室",
  kicker: "一起守望世界",
  headline: "看見世界正在被守望",
  subheadline: "每一個光點，都是一個人、一座城市，或一個正在被主記念的需要。",
  primaryCta: "分享代禱需要",
  roomCta: "進入全球禱告室",
  totalPrayers: "代禱事項",
  locationLights: "地點光點",
  todayNew: "24 小時內新增",
  audioPrayers: "語音禱告",
  emptyTitle: "還沒有可顯示的禱告光點",
  emptyCopy: "分享第一個代禱事項，讓世界地圖亮起來。",
};

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

function getPrayerTitle(prayer) {
  if (!prayer) return "待守望的禱告";
  return prayer.isPrivate ? "匿名代禱" : prayer.title || "未命名代禱";
}

function getPrayerExcerpt(prayer) {
  if (!prayer) return "點擊地球上的光點後，這裡會整理出該地點的禱告內容。";
  if (prayer.isPrivate) return "這是一則私密代禱，請以溫柔與尊重守望。";
  return toPlainText(prayer.description).slice(0, 96) || "這則代禱尚未提供更多細節。";
}

function getPrayerLocation(prayer, cluster) {
  if (cluster?.fullLabel) return cluster.fullLabel;
  if (!prayer?.locationCity) return "未知地點";
  return prayer.locationCountry ? `${prayer.locationCity}，${prayer.locationCountry}` : prayer.locationCity;
}

export function GlobeSkeleton({ hidden = false }) {
  return (
    <div className={`home-map-skeleton${hidden ? " is-hidden" : ""}`} aria-hidden="true">
      <div className="home-map-skeleton__earth">
        <span />
        <i />
        <b />
      </div>
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
}) {
  return (
    <GlobalPrayerRoomEmbed
      prayers={prayers}
      title={TEXT.eyebrow}
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
}) {
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
  const modalLocation = selectedCluster?.fullLabel || getPrayerLocation(latestPrayer, null);

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

  return (
    <section className="home-map-hero" aria-labelledby="home-map-title">
      <div className="home-map-hero__stars" aria-hidden="true" />
      <div className="home-map-hero__radar" aria-hidden="true" />
      <div className="home-map-hero__globe" aria-label="全球禱告地圖">
        <GlobeSkeleton hidden={globeReady} />
        <HeroGlobe
          prayers={prayers}
          focusPrayerId={activePrayerId}
          activeClusterId={activeClusterId}
          globeRef={globeRef}
          onClusterSelect={handleClusterSelect}
          onBlankClick={closeModal}
          onReady={() => {
            setGlobeReady(true);
            if (latestPrayer?.id) setActivePrayerId(latestPrayer.id);
          }}
        />
      </div>

      <div className="home-map-hero__shade" aria-hidden="true" />

      <div className="home-intel-brief">
        <p>{TEXT.eyebrow}</p>
        <span className="home-intel-brief__kicker">{TEXT.kicker}</span>
        <h1 id="home-map-title">{TEXT.headline}</h1>
        <span>{TEXT.subheadline}</span>
        <div className="home-intel-brief__actions">
          <Link href={secondaryHref} className="button button--primary" prefetch={false}>
            {TEXT.primaryCta}
          </Link>
          <Link href={primaryHref} className="button button--ghost" prefetch={false}>
            {TEXT.roomCta}
          </Link>
        </div>
        <div className="home-intel-stats" aria-label="全球禱告統計">
          <span><b>{stats.totalPrayers}</b> {TEXT.totalPrayers}</span>
          <span><b>{stats.locationLights}</b> {TEXT.locationLights}</span>
          <span><b>{liveCount}</b> {TEXT.todayNew}</span>
          <span><b>{stats.audioPrayers}</b> {TEXT.audioPrayers}</span>
        </div>
        <p className="home-intel-brief__hint">
          已鎖定最新上傳的禱告光點。點擊地球上的光點，右側會整理出該地點的禱告事項。
        </p>
      </div>

      <div className="home-map-controls" aria-label="地球縮放控制">
        <button type="button" onClick={() => globeRef.current?.zoomIn?.()} aria-label="放大地球">
          +
        </button>
        <button type="button" onClick={() => globeRef.current?.zoomOut?.()} aria-label="縮小地球">
          -
        </button>
      </div>

      {selectedCluster && !selectedCluster.isDefaultFocus ? (
        <aside className="home-prayer-modal" aria-label={`${modalLocation} 的禱告事項`}>
          <button className="home-prayer-modal__close" type="button" onClick={closeModal}>
            關閉
          </button>
          <span className="home-prayer-modal__eyebrow">此地點的代禱</span>
          <h2>{modalLocation}</h2>
          <p>這個光點目前集合了 {modalPrayers.length} 筆代禱。你可以先看簡短內容，再進入完整頁面。</p>
          <div className="home-prayer-modal__list">
            {modalPrayers.length ? (
              modalPrayers.slice(0, 6).map((prayer) => (
                <article key={prayer.id || `${prayer.locationLat}-${prayer.locationLng}-${prayer.title}`}>
                  <span>{getPrayerLocation(prayer, null)}</span>
                  <h3>{getPrayerTitle(prayer)}</h3>
                  <p>{getPrayerExcerpt(prayer)}</p>
                  {prayer?.id && !prayer?.isPrivate ? (
                    <Link href={`/prayfor/${prayer.id}`} prefetch={false}>
                      查看詳情
                    </Link>
                  ) : null}
                </article>
              ))
            ) : (
              <article>
                <h3>尚未找到公開內容</h3>
                <p>這個光點仍值得被守望，請為此地的人與需要安靜代禱。</p>
              </article>
            )}
          </div>
        </aside>
      ) : null}

      {!hasMarkers ? (
        <div className="home-map-hero__empty">
          <strong>{TEXT.emptyTitle}</strong>
          <span>{TEXT.emptyCopy}</span>
          <Link href={secondaryHref}>{TEXT.primaryCta}</Link>
        </div>
      ) : null}

      <style jsx>{`
        .home-map-hero {
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
          border: 1px solid rgba(253, 230, 138, 0.22);
          background:
            linear-gradient(145deg, rgba(24, 31, 47, 0.82), rgba(7, 16, 34, 0.7)),
            rgba(4, 10, 22, 0.6);
          box-shadow: 0 28px 90px rgba(2, 6, 23, 0.42);
          backdrop-filter: blur(16px);
        }

        .home-intel-brief {
          position: relative;
          z-index: 20;
          width: min(500px, calc(100% - 2rem));
          margin-left: clamp(1rem, 3vw, 3rem);
          margin-top: clamp(1rem, 3vh, 2.5rem);
          border-radius: 24px;
          padding: clamp(1.15rem, 2.2vw, 1.7rem);
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
          font-size: 0.66rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .home-intel-brief__kicker {
          display: block;
          margin-top: 0.48rem;
          color: rgba(253, 230, 138, 0.92);
          letter-spacing: 0.08em;
        }

        .home-intel-brief h1 {
          margin-top: 0.5rem;
          color: rgba(255, 255, 255, 0.96);
          font-size: clamp(2.35rem, 4.8vw, 4.4rem);
          line-height: 1.02;
          letter-spacing: 0;
          text-shadow: 0 16px 44px rgba(2, 6, 23, 0.58);
        }

        .home-intel-brief > span:not(.home-intel-brief__kicker) {
          display: block;
          margin-top: 0.75rem;
          max-width: 34rem;
          color: rgba(255, 247, 237, 0.86);
          font-size: clamp(0.98rem, 1.35vw, 1.12rem);
          line-height: 1.72;
        }

        .home-intel-brief__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 1.1rem;
          align-items: center;
        }

        .home-intel-brief__actions :global(.button) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          border-radius: 999px;
          padding: 0 1rem;
          font-size: 0.88rem;
          font-weight: 900;
          line-height: 1;
          text-align: center;
        }

        .home-intel-brief__actions :global(.button--primary) {
          background: #f7d77a;
          border-color: rgba(253, 230, 138, 0.82);
          color: #241a05;
          box-shadow: 0 14px 36px rgba(250, 204, 21, 0.18);
        }

        .home-intel-brief__actions :global(.button--ghost) {
          border-color: rgba(226, 232, 240, 0.18);
          background: rgba(15, 23, 42, 0.34);
          color: rgba(248, 250, 252, 0.9);
        }

        .home-intel-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
          margin-top: 1.05rem;
          padding-top: 0.85rem;
          border-top: 1px solid rgba(253, 230, 138, 0.14);
        }

        .home-intel-stats span {
          display: grid;
          gap: 0.08rem;
          color: rgba(226, 232, 240, 0.72);
          font-size: 0.76rem;
          letter-spacing: 0.02em;
        }

        .home-intel-stats b {
          color: #fde68a;
          font-size: 1rem;
        }

        .home-intel-brief__hint {
          margin-top: 1rem !important;
          border: 1px solid rgba(253, 230, 138, 0.18);
          border-radius: 16px;
          padding: 0.8rem;
          color: rgba(255, 247, 237, 0.8) !important;
          font-size: 0.88rem !important;
          line-height: 1.6;
          background: rgba(255, 247, 237, 0.08);
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
          .home-intel-brief > span:not(.home-intel-brief__kicker),
          .home-intel-stats,
          .home-intel-brief__hint {
            display: none;
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
            font-size: 0.86rem;
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
