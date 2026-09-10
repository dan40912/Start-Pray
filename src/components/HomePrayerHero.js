"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PrayerRecorder from "@/components/prayer-recorder/PrayerRecorder";
import CompanionOverlay from "@/components/home-companion/CompanionOverlay";
import { resolveArrowKeyDirection } from "@/components/home-companion/swipe-utils";
import { usePrayerInteraction } from "@/components/prayer-interaction/usePrayerInteraction";
import GainAudio from "@/components/GainAudio";
import { isPlayableVoiceHref } from "@/lib/voice";

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

const BLOCKING_RECORDER_PHASES = new Set(["requesting-permission", "countdown", "recording"]);

export default function HomePrayerHero({ text, prayers }) {
  const copy = text.prayerHero;
  const companionText = text.companion;

  // 一整副牌，不是一張卡。索引移動就是換卡，零網路。
  const deck = useMemo(() => (Array.isArray(prayers) ? prayers.filter(Boolean) : []), [prayers]);
  const [index, setIndex] = useState(0);
  const [switchConfirm, setSwitchConfirm] = useState(null); // { direction } | null
  const [blockedMessage, setBlockedMessage] = useState("");

  const currentPrayer = deck[index] || null;
  const hasPrev = index > 0;
  const hasNext = index < deck.length - 1;

  // 連續快滑時，每一張都去打一次互動 API 等於一次滑五張就發五組請求。
  // 等停下來之後才把 id 交給那些 hook。
  const [settledId, setSettledId] = useState(currentPrayer?.id ?? null);
  useEffect(() => {
    const id = deck[index]?.id ?? null;
    const timeoutId = window.setTimeout(() => setSettledId(id), 180);
    return () => window.clearTimeout(timeoutId);
  }, [deck, index]);

  const {
    recorderRef,
    recorderActive,
    recorderState,
    setRecorderState,
    openRecorder,
    closeRecorder,
    discardRecorder,
    companionOpen,
    openCompanion,
    closeCompanion,
    playableResponses,
    hasCompanionEntry,
  } = usePrayerInteraction(settledId);

  const heroRef = useRef(null);
  const trackRef = useRef(null);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // 位移在 JS 裡算好、直接寫成 transform，而不是把 --i 塞進 CSS 的 calc()：
  // 只改自訂屬性時，transform 的過渡不會可靠地重新啟動，卡片會停在原地。
  const [metrics, setMetrics] = useState({ step: 0, offset: 0 });
  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const slide = trackRef.current?.firstElementChild;
    if (!viewport || !slide) return;
    const slideWidth = slide.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(trackRef.current).columnGap || "0") || 0;
    setMetrics({
      step: slideWidth + gap,
      offset: (viewport.getBoundingClientRect().width - slideWidth) / 2,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, deck.length]);

  useEffect(() => {
    setIndex(0);
  }, [deck]);

  useEffect(() => {
    if (!blockedMessage) return;
    const timeoutId = window.setTimeout(() => setBlockedMessage(""), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [blockedMessage]);

  const canSwitchNow = () => {
    if (companionOpen) return false;
    if (!recorderActive || !recorderState) return true;
    if (recorderState.submitState === "uploading") return false;
    if (BLOCKING_RECORDER_PHASES.has(recorderState.phase)) return false;
    return true;
  };

  const needsDiscardConfirm = () =>
    recorderActive &&
    recorderState?.phase === "preview" &&
    recorderState?.submitState === "idle" &&
    !recorderState?.confirmingRerecord;

  const blockedMessageForState = () => {
    if (companionOpen) return "";
    if (recorderState?.submitState === "uploading") return companionText.switchBlockedUploading;
    if (recorderState?.phase === "countdown") return companionText.switchBlockedCountdown;
    if (recorderState?.phase === "recording") return companionText.switchBlockedRecording;
    if (recorderState?.phase === "requesting-permission") return companionText.switchBlockedRequesting;
    return companionText.switchBlockedGeneric;
  };

  const canGo = (direction) => (direction === "next" ? hasNext : hasPrev);

  const performSwitch = (direction) => {
    if (!canGo(direction)) return;
    discardRecorder();
    setSwitchConfirm(null);
    setIndex((prev) => prev + (direction === "next" ? 1 : -1));
  };

  const attemptSwitch = (direction) => {
    if (!canGo(direction)) return;
    if (!canSwitchNow()) {
      setBlockedMessage(blockedMessageForState());
      return;
    }
    if (needsDiscardConfirm()) {
      setSwitchConfirm({ direction });
      return;
    }
    performSwitch(direction);
  };

  // 手指跟隨。之前只綁 touchstart / touchend，中間完全不動，放開手才瞬間
  // 抽換 DOM —— 那是一個手勢偵測器，不是拖曳，體感上這是「不流暢」的主因。
  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (deck.length <= 1) return;
    // 錄音中根本不進入拖曳狀態，而不是讓人拖到一半才被彈回去。
    if (!canSwitchNow()) return;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startedAt: event.timeStamp,
      axis: null,
      moved: 0,
    };
  };

  const handlePointerMove = (event) => {
    const state = dragRef.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    state.moved = Math.hypot(dx, dy);

    // 軸向鎖定：前 10px 內決定這是水平滑卡還是垂直捲頁。沒有這個，
    // 手機上會變成整頁滑不動。
    if (!state.axis) {
      if (state.moved < 10) return;
      state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (state.axis === "x") {
        setIsDragging(true);
        try {
          // 手指滑出容器時不要斷掉。指標已經消失的情況會丟例外，不影響拖曳。
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // noop
        }
      }
    }
    if (state.axis !== "x") return;

    // 到底了就給阻尼，讓人感覺到邊界而不是卡死。
    const atEdge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
    setDrag(atEdge ? dx * 0.22 : dx);
  };

  const endDrag = (event) => {
    const state = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    setDrag(0);
    if (!state || state.axis !== "x") return;

    const dx = event.clientX - state.x;
    const elapsed = Math.max(1, event.timeStamp - state.startedAt);
    const velocity = dx / elapsed; // px/ms
    const width = trackRef.current?.getBoundingClientRect().width || 320;

    // 只看距離的話，快速的輕彈會被判成「沒滑動」而彈回去，手感很鈍。
    const shouldSwitch = Math.abs(dx) > width * 0.25 || Math.abs(velocity) > 0.45;
    if (!shouldSwitch) return;
    attemptSwitch(dx < 0 ? "next" : "prev");
  };

  // 拖過就不算點擊，免得滑動時誤觸標題連結。
  const handleClickCapture = (event) => {
    if (dragRef.current?.moved > 8) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (companionOpen) return; // CompanionOverlay owns its own keyboard handling
      const direction = resolveArrowKeyDirection(event.key);
      if (direction) attemptSwitch(direction);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, deck, canSwitchNow, companionOpen, needsDiscardConfirm]);


  return (
    <section className="prayer-hero" aria-labelledby="prayer-hero-title" ref={heroRef}>
      {/* 氛圍層：目前這張卡的照片，重度模糊、壓暗，活在內容後面，
          佔 0px 版面。純 CSS 漸層是 AI 模板的指紋，真實照片不是。 */}
      {currentPrayer?.image ? (
        <div
          className="prayer-hero__ambient"
          style={{ backgroundImage: `url(${currentPrayer.image})` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="prayer-hero__inner">
        {recorderActive ? (
          <PrayerRecorder
            ref={recorderRef}
            text={text.recorder}
            prayerId={currentPrayer?.id}
            onStateChange={setRecorderState}
            onExit={closeRecorder}
          />
        ) : currentPrayer ? (
          <>
            <h1 id="prayer-hero-title">{copy.headline}</h1>

            <div
              className="prayer-hero__viewport"
              ref={viewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClickCapture={handleClickCapture}
            >
              <ul
                className="prayer-hero__track"
                ref={trackRef}
                data-dragging={isDragging ? "true" : "false"}
                style={{
                  transform: `translate3d(${metrics.offset - index * metrics.step + drag}px, 0, 0)`,
                }}
              >
                {deck.map((item, itemIndex) => {
                  const isCurrent = itemIndex === index;
                  const itemVoice = isPlayableVoiceHref(item.voiceHref) ? item.voiceHref : null;
                  const itemUploader =
                    item?.owner?.name || item?.owner?.username || copy.uploaderAnonymous;
                  return (
                    <li
                      key={item.id}
                      className="prayer-hero__slide"
                      aria-hidden={!isCurrent}
                      onClick={isCurrent ? undefined : () => attemptSwitch(itemIndex > index ? "next" : "prev")}
                    >
                      <article
                        className="prayer-hero__card"
                        aria-label={copy.cardLabel}
                        // 非當前卡的內容移出 tab 順序，否則 Tab 會跑進看不見的卡裡。
                        // inert 掛在內層而不是 li，這樣點露出來的鄰卡仍然可以把它
                        // 切到中間 —— 使用者點旁邊的卡，期待的是「移過來」，不是跳頁。
                        inert={isCurrent ? undefined : ""}
                      >
                        <h2>
                          {/* 只有標題是連結。整張卡包成 <a> 會讓每次滑動都誤觸導航。 */}
                          <Link href={`/prayfor/${item.id}`} prefetch={isCurrent}>
                            {item.title}
                          </Link>
                        </h2>
                        <p className="prayer-hero__uploader">
                          {copy.uploaderLabel}
                          <span className="prayer-hero__uploader-name">{itemUploader}</span>
                        </p>
                        {toPlainText(item.description) ? <p>{toPlainText(item.description)}</p> : null}
                        {itemVoice && isCurrent ? (
                          <div className="prayer-hero__voice">
                            <span className="prayer-hero__voice-label">{copy.voiceLabel}</span>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <GainAudio
                              controls
                              preload="metadata"
                              src={itemVoice}
                              className="prayer-hero__card-audio"
                            />
                          </div>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="prayer-hero__actions">
              <button type="button" className="prayer-hero__cta" onClick={openRecorder}>
                {text.recorder.entryCta}
              </button>
              {hasCompanionEntry ? (
                <button
                  type="button"
                  className="prayer-hero__companion-cta"
                  onClick={openCompanion}
                >
                  {companionText.listenEntry}
                </button>
              ) : null}
            </div>

            {/* 「我已為你禱告」按鈕與它的計數暫時不顯示：按下去對送出代禱的人來說
                沒有實質改變，只是多一個要理解的東西。元件、hook 與
                /api/home-cards/:id/prayed 都保留著，要回復就是把這一行放回來。 */}

            <p className="prayer-hero__anonymous-note">{text.recorder.anonymousNote}</p>

            {deck.length > 1 ? (
              <div className="prayer-hero__nav">
                <button
                  type="button"
                  className="prayer-hero__nav-btn"
                  onClick={() => attemptSwitch("prev")}
                  disabled={!hasPrev}
                  aria-label={copy.prevPrayer}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <p className="prayer-hero__swipe-hint">{copy.swipeHint}</p>
                <button
                  type="button"
                  className="prayer-hero__nav-btn"
                  onClick={() => attemptSwitch("next")}
                  disabled={!hasNext}
                  aria-label={copy.nextPrayer}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : null}

            {blockedMessage ? (
              <p className="prayer-hero__notice" role="status">
                {blockedMessage}
              </p>
            ) : null}

            {switchConfirm ? (
              <div className="prayer-hero__confirm" role="alertdialog" aria-label={companionText.discardConfirmTitle}>
                <p>{companionText.discardConfirmTitle}</p>
                <p>{companionText.discardConfirmBody}</p>
                <div className="prayer-hero__confirm-actions">
                  <button type="button" onClick={() => performSwitch(switchConfirm.direction)}>
                    {companionText.discardConfirmYes}
                  </button>
                  <button type="button" onClick={() => setSwitchConfirm(null)}>
                    {companionText.discardConfirmNo}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <h1 id="prayer-hero-title">{copy.emptyTitle}</h1>
            <p className="prayer-hero__subhead">{copy.emptyBody}</p>
          </>
        )}
      </div>

      {companionOpen && currentPrayer ? (
        <CompanionOverlay
          responses={playableResponses}
          text={companionText}
          onExit={closeCompanion}
        />
      ) : null}

      <style jsx>{`
        /* "夜禱 / Night Vigil" — see the design handbook. The whole hero runs on
           one warm accent (--nv-ember) against a deep indigo ground, instead of
           the light-theme --accent/--text-secondary tokens this section used to
           borrow from globals.css, which rendered dark-grey text on a near-black
           page. Tokens are declared locally so nothing else on the site shifts
           until the palette is adopted globally. */
        .prayer-hero {
          --nv-night: #0c1526;
          --nv-dusk: #16223a;
          --nv-dusk-2: #1c2c48;
          --nv-line: rgba(160, 178, 210, 0.14);
          --nv-ember: #e2a05a;
          --nv-ember-bright: #f4c185;
          --nv-ember-soft: rgba(226, 160, 90, 0.14);
          --nv-ember-glow: rgba(226, 160, 90, 0.5);
          --nv-moonlight: #e7ebf3;
          --nv-mist: #8a93a8;
          --nv-mist-dim: #616b80;

          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100svh - var(--site-header-height, 56px));
          padding: 3.5rem 1.25rem 4rem;
          overflow: hidden;
          background:
            radial-gradient(ellipse 60% 45% at 20% 8%, rgba(226, 160, 90, 0.1), transparent 62%),
            radial-gradient(ellipse 50% 40% at 85% 90%, rgba(226, 160, 90, 0.06), transparent 60%),
            linear-gradient(180deg, #05070c 0%, var(--nv-night) 42%, #0a121f 100%);
        }

        .prayer-hero__inner {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 640px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.15rem;
          text-align: center;
        }

        /* The uploader line sits between the title and the need itself, so it
           reads as attribution rather than as part of the prayer's text. The
           ember accent is the same one the card's voice label uses. */
        .prayer-hero__uploader {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin: 0.1rem 0 0;
          font-size: 0.82rem;
          letter-spacing: 0.02em;
          color: var(--nv-mist);
        }

        .prayer-hero__uploader-name {
          font-weight: 600;
          color: var(--nv-ember-bright);
        }

        .prayer-hero__inner h1 {
          margin: 0;
          font-family: var(--font-serif-tc), "Noto Serif TC", Georgia, serif;
          font-weight: 600;
          font-size: clamp(2rem, 1.2rem + 3.4vw, 3.1rem);
          line-height: 1.34;
          color: var(--nv-moonlight);
          text-wrap: balance;
        }

        .prayer-hero__subhead {
          margin: 0;
          max-width: 40ch;
          font-size: 1.02rem;
          line-height: 1.85;
          color: var(--nv-mist);
        }

        /* 氛圍層：目前卡片的照片鋪成整個 hero 的背景，重度模糊 + 壓暗。
           它活在內容後面，不佔任何版面高度。opacity 是關鍵，超過 0.20 就
           會開始吃字的對比。 */
        .prayer-hero__ambient {
          position: absolute;
          inset: -10%;
          z-index: 0;
          background-position: center;
          background-size: cover;
          filter: blur(44px) saturate(1.12);
          opacity: 0.17;
          transition: opacity 500ms ease;
          pointer-events: none;
        }

        .prayer-hero__ambient::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 55% at 50% 45%, transparent, var(--nv-night) 78%),
            linear-gradient(180deg, rgba(5, 7, 12, 0.55), rgba(10, 18, 31, 0.9));
        }

        /* 三層結構：viewport 滿版負責裁切，track 只動 transform，
           slide 收在 560px。之前 .prayer-hero__inner 的 max-width 會把露肩
           夾死，所以 viewport 必須自己撐出畫面寬度。 */
        .prayer-hero__viewport {
          position: relative;
          width: 100vw;
          max-width: 100vw;
          margin-inline: calc(50% - 50vw);
          overflow: hidden;
          touch-action: pan-y;
        }

        .prayer-hero__track {
          --slide: min(560px, 82vw);
          --gap: 20px;
          --step: calc(var(--slide) + var(--gap));

          display: flex;
          gap: var(--gap);
          margin: 0;
          padding: 0.75rem 0 0.25rem;
          list-style: none;
          /* 位移由 JS 寫進 inline transform。只動 transform，交給 GPU 合成，
             不觸發 layout / paint。 */
          transition: transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
        }

        .prayer-hero__track[data-dragging="true"] {
          transition: none;
          will-change: transform;
        }

        .prayer-hero__slide {
          flex: 0 0 var(--slide);
          display: flex;
          /* 鄰卡露肩：它就是「還有更多」的視覺證據，比一行小字有效得多，
             而且只吃水平邊緣，垂直高度增加 0px。 */
          /* scale 會把鄰卡的左緣往中間縮，露出來的那一條就沒了 —— 用比較
             淺的縮放，並讓它往畫面外側縮，露肩才留得住。 */
          opacity: 0.42;
          transform: scale(0.95);
          filter: blur(1.5px);
          transition:
            opacity 420ms ease,
            transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1),
            filter 420ms ease;
          cursor: pointer;
        }

        .prayer-hero__slide:not([aria-hidden="false"]) {
          transform-origin: center;
        }

        .prayer-hero__slide[aria-hidden="false"] {
          opacity: 1;
          transform: none;
          filter: none;
          cursor: default;
        }

        .prayer-hero__card h2 :global(a) {
          color: inherit;
          text-decoration: none;
        }

        .prayer-hero__card h2 :global(a:hover),
        .prayer-hero__card h2 :global(a:focus-visible) {
          text-decoration: underline;
          text-underline-offset: 0.2em;
        }

        @media (prefers-reduced-motion: reduce) {
          .prayer-hero__track {
            transition: opacity 120ms ease;
          }

          .prayer-hero__slide {
            transition: opacity 120ms ease;
            transform: none;
            filter: none;
          }
        }

        @media (max-width: 480px) {
          .prayer-hero__track {
            /* 手機上主卡不能太窄，但仍要露出一小條鄰卡當「還有更多」的證據。 */
            --slide: 78vw;
            --gap: 12px;
          }
        }

        .prayer-hero__card {
          position: relative;
          width: 100%;
          margin-top: 0;
          padding: 1.75rem 1.85rem;
          border-radius: 20px;
          border: 1px solid var(--nv-line);
          background: linear-gradient(165deg, var(--nv-dusk-2), var(--nv-dusk) 72%);
          box-shadow:
            0 40px 70px -42px rgba(2, 6, 16, 0.92),
            0 0 60px -30px var(--nv-ember-glow),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
          text-align: left;
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          gap: 0.7rem;
        }

        .prayer-hero__card h2 {
          margin: 0;
          font-family: var(--font-serif-tc), "Noto Serif TC", Georgia, serif;
          font-weight: 600;
          font-size: 1.4rem;
          line-height: 1.45;
          color: var(--nv-moonlight);
        }

        .prayer-hero__card p {
          margin: 0;
          color: var(--nv-mist);
          font-size: 0.95rem;
          line-height: 1.85;
          white-space: pre-line;
        }

        .prayer-hero__voice {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.4rem;
          padding: 0.85rem 0.95rem;
          border: 1px solid var(--nv-line);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
        }

        .prayer-hero__voice-label {
          font-size: 0.8rem;
          color: var(--nv-ember-bright);
        }

        .prayer-hero__card-audio {
          width: 100%;
        }

        .prayer-hero__actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.7rem;
          margin-top: 0.6rem;
        }

        .prayer-hero__cta,
        .prayer-hero__companion-cta {
          min-height: 48px;
          padding: 0.85rem 2rem;
          border: none;
          border-radius: 999px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.18s ease, filter 0.18s ease, background 0.2s ease;
        }

        .prayer-hero__cta {
          background: linear-gradient(135deg, var(--nv-ember-bright), var(--nv-ember));
          color: #241505;
          box-shadow: 0 16px 32px -14px rgba(226, 160, 90, 0.6);
        }

        .prayer-hero__companion-cta {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--nv-line);
          color: var(--nv-moonlight);
        }

        .prayer-hero__cta:hover,
        .prayer-hero__cta:focus-visible {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .prayer-hero__companion-cta:hover,
        .prayer-hero__companion-cta:focus-visible {
          background: rgba(255, 255, 255, 0.09);
        }

        .prayer-hero__anonymous-note {
          margin: 0;
          font-size: 0.82rem;
          color: var(--nv-mist-dim);
        }

        .prayer-hero__nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 0.35rem;
        }

        .prayer-hero__nav-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid var(--nv-line);
          background: rgba(255, 255, 255, 0.04);
          color: var(--nv-moonlight);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .prayer-hero__nav-btn svg {
          width: 18px;
          height: 18px;
        }

        .prayer-hero__nav-btn:hover:not(:disabled) {
          border-color: var(--nv-ember);
          background: var(--nv-ember-soft);
          color: var(--nv-ember-bright);
        }

        .prayer-hero__nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .prayer-hero__swipe-hint {
          margin: 0;
          font-size: 0.8rem;
          color: var(--nv-mist-dim);
        }

        .prayer-hero__notice {
          margin: 0;
          font-size: 0.85rem;
          background: var(--nv-ember-soft);
          border: 1px solid rgba(226, 160, 90, 0.28);
          color: var(--nv-ember-bright);
          padding: 0.55rem 0.95rem;
          border-radius: 10px;
        }

        .prayer-hero__confirm {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          padding: 1.1rem 1.3rem;
          border: 1px solid var(--nv-line);
          border-radius: 16px;
          background: rgba(6, 14, 28, 0.9);
          color: var(--nv-mist);
          font-size: 0.9rem;
        }

        .prayer-hero__confirm-actions {
          display: flex;
          gap: 0.6rem;
        }

        .prayer-hero__confirm-actions button {
          min-height: 44px;
          padding: 0.6rem 1.4rem;
          border: 1px solid var(--nv-line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          color: var(--nv-moonlight);
          font-weight: 500;
          cursor: pointer;
        }

        .prayer-hero__confirm-actions button:first-child {
          background: var(--nv-ember);
          border-color: var(--nv-ember);
          color: #241505;
        }

        @media (max-width: 480px) {
          .prayer-hero {
            padding: 2.5rem 1rem 3rem;
          }

          .prayer-hero__card {
            padding: 1.4rem 1.25rem;
          }

          .prayer-hero__cta,
          .prayer-hero__companion-cta {
            width: 100%;
            max-width: 320px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .prayer-hero__cta,
          .prayer-hero__companion-cta,
          .prayer-hero__nav-btn {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
