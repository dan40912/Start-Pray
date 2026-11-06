"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import PrayerRecorder from "@/components/prayer-recorder/PrayerRecorder";
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

// 循環輪播至少要有這麼多張，左右兩側才都有鄰卡、換卡時也不會看到卡片從
// 一邊飛到另一邊。牌太少就把整副牌重複幾輪。
const MIN_LOOP_SLIDES = 5;

export default function HomePrayerHero({ text, prayers }) {
  const copy = text.prayerHero;
  const companionText = text.companion;

  // 一整副牌，不是一張卡。索引移動就是換卡，零網路。
  const deck = useMemo(() => (Array.isArray(prayers) ? prayers.filter(Boolean) : []), [prayers]);
  const slides = useMemo(() => {
    const copies = deck.length > 1 ? Math.ceil(MIN_LOOP_SLIDES / deck.length) : 1;
    const result = [];
    for (let round = 0; round < copies; round += 1) {
      deck.forEach((prayer) => result.push({ key: `${prayer.id}:${round}`, prayer }));
    }
    return result;
  }, [deck]);
  const slideCount = slides.length;
  const isLoop = slideCount > 1;
  const [index, setIndex] = useState(0);
  const [switchConfirm, setSwitchConfirm] = useState(null); // { direction } | null
  const [blockedMessage, setBlockedMessage] = useState("");
  const [openVoiceKey, setOpenVoiceKey] = useState(null);

  const currentPrayer = slides[index]?.prayer || null;

  const wrapIndex = (value) => ((value % slideCount) + slideCount) % slideCount;
  // 某張卡相對於中間那張的位置：負的在左、正的在右，取繞圈最短的那一邊。
  const relativePosition = (itemIndex, centerIndex) => {
    const rel = wrapIndex(itemIndex - centerIndex);
    return rel > slideCount / 2 ? rel - slideCount : rel;
  };

  // 上一次畫面上的中間索引。換卡時繞到另一側的那張卡要瞬移，不能帶過渡
  // 從畫面前面飛過去。
  const [renderedIndex, setRenderedIndex] = useState(0);
  useEffect(() => {
    setRenderedIndex(index);
  }, [index]);

  // 連續快滑時，每一張都去打一次互動 API 等於一次滑五張就發五組請求。
  // 等停下來之後才把 id 交給那些 hook。
  const [settledId, setSettledId] = useState(currentPrayer?.id ?? null);
  useEffect(() => {
    const id = slides[index]?.prayer?.id ?? null;
    const timeoutId = window.setTimeout(() => setSettledId(id), 180);
    return () => window.clearTimeout(timeoutId);
  }, [slides, index]);

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
    hasCompanionEntry,
  } = usePrayerInteraction(settledId);

  const heroRef = useRef(null);
  const trackRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setIndex(0);
    setRenderedIndex(0);
  }, [slides]);

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

  const performSwitch = (direction) => {
    if (!isLoop) return;
    discardRecorder();
    setSwitchConfirm(null);
    setOpenVoiceKey(null);
    setIndex((prev) => wrapIndex(prev + (direction === "next" ? 1 : -1)));
  };

  const attemptSwitch = (direction) => {
    if (!isLoop) return;
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
    if (!isLoop) return;
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

    // 循環輪播沒有邊界，手指拖多少卡片就跟多少。
    setDrag(dx);
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
      if (companionOpen) return; // 陪伴模式開著時，鍵盤交給播放器
      const direction = resolveArrowKeyDirection(event.key);
      if (direction) attemptSwitch(direction);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides, canSwitchNow, companionOpen, needsDiscardConfirm]);


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
            // 送出之後的「下一則」就是牌組裡的下一張，原地換卡。只有一張卡
            // 時才不傳，交給錄音器自己找下一則。
            onNext={isLoop ? () => performSwitch("next") : undefined}
          />
        ) : currentPrayer ? (
          <>
            <h1 id="prayer-hero-title">{copy.headline}</h1>

            <div
              className="prayer-hero__viewport"
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
              >
                {slides.map(({ key, prayer: item }, itemIndex) => {
                  const isCurrent = itemIndex === index;
                  const rel = relativePosition(itemIndex, index);
                  // 繞到另一側的卡一次移動超過一格，只有它瞬移。
                  const wrapped = Math.abs(rel - relativePosition(itemIndex, renderedIndex)) > 1;
                  // 每張卡在 flex 裡的自然位置是 itemIndex 格，這裡把它推到 rel 格。
                  const x = `calc(var(--center-offset) + ${rel - itemIndex} * var(--step) + ${drag}px)`;
                  const itemVoice = isPlayableVoiceHref(item.voiceHref) ? item.voiceHref : null;
                  const isVoiceOpen = isCurrent && openVoiceKey === key;
                  const itemUploader =
                    item?.owner?.name || item?.owner?.username || copy.uploaderAnonymous;
                  return (
                    <li
                      key={key}
                      className="prayer-hero__slide"
                      aria-hidden={!isCurrent}
                      style={{
                        transform: `translate3d(${x}, 0, 0)`,
                        transition: wrapped ? "none" : undefined,
                      }}
                      onClick={isCurrent ? undefined : () => attemptSwitch(rel > 0 ? "next" : "prev")}
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
                        {itemVoice && isVoiceOpen ? (
                          <div className="prayer-hero__voice">
                            <span className="prayer-hero__voice-label">{copy.voiceLabel}</span>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <GainAudio
                              controls
                              autoPlay
                              preload="metadata"
                              src={itemVoice}
                              className="prayer-hero__card-audio"
                            />
                          </div>
                        ) : itemVoice ? (
                          <button
                            type="button"
                            className="prayer-hero__play"
                            onClick={() => setOpenVoiceKey(key)}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
                            </svg>
                            {copy.playVoice}
                          </button>
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
                  onClick={() =>
                    openCompanion({
                      anonymousLabel: companionText.anonymousLabel,
                      prayerTitle: currentPrayer?.title || "",
                      coverImage: currentPrayer?.image || "",
                    })
                  }
                >
                  {companionText.listenEntry}
                </button>
              ) : null}
            </div>

            {/* 「我已為你禱告」按鈕與它的計數暫時不顯示：按下去對送出代禱的人來說
                沒有實質改變，只是多一個要理解的東西。元件、hook 與
                /api/home-cards/:id/prayed 都保留著，要回復就是把這一行放回來。 */}

            <p className="prayer-hero__anonymous-note">{text.recorder.anonymousNote}</p>

            {isLoop ? (
              <div className="prayer-hero__nav">
                <button
                  type="button"
                  className="prayer-hero__nav-btn"
                  onClick={() => attemptSwitch("prev")}
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

    </section>
  );
}
