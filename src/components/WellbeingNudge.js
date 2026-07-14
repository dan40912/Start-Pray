"use client";

// PRD-003 — 溫和的關懷卡。不打斷播放,只提供安慰與求助入口。
// 文案全部來自 i18n dictionary.wellbeing。

const FALLBACK = {
  title: "願你被安慰",
  body: "你已經陪這段禱告走了一段時間了。如果現在心裡很重,也許找個人說說話會有幫助。",
  reachOut: "需要有人陪你嗎?",
  gotIt: "我知道了",
  dontShowAgain: "不再顯示",
};

export default function WellbeingNudge({
  text,
  reachOutHref = "mailto:startpraynow@gmail.com",
  onDismiss,
  onDismissForever,
}) {
  const copy = { ...FALLBACK, ...(text || {}) };

  return (
    <div className="wellbeing-nudge" role="status" aria-live="polite">
      <div className="wellbeing-nudge__body">
        <p className="wellbeing-nudge__title">{copy.title}</p>
        <p className="wellbeing-nudge__text">{copy.body}</p>
        <a
          className="wellbeing-nudge__reach"
          href={reachOutHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.reachOut}
        </a>
      </div>
      <div className="wellbeing-nudge__actions">
        <button type="button" className="wellbeing-nudge__btn" onClick={onDismiss}>
          {copy.gotIt}
        </button>
        <button
          type="button"
          className="wellbeing-nudge__btn wellbeing-nudge__btn--muted"
          onClick={onDismissForever}
        >
          {copy.dontShowAgain}
        </button>
      </div>
      <style jsx>{`
        .wellbeing-nudge {
          position: fixed;
          left: 50%;
          bottom: 96px;
          transform: translateX(-50%);
          z-index: 60;
          width: min(92vw, 420px);
          padding: 18px 20px;
          border-radius: 16px;
          background: rgba(247, 244, 238, 0.98);
          color: #3a3a32;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
          border: 1px solid rgba(180, 160, 120, 0.35);
        }
        .wellbeing-nudge__title {
          margin: 0 0 6px;
          font-size: 1rem;
          font-weight: 600;
          color: #6b5b3e;
        }
        .wellbeing-nudge__text {
          margin: 0 0 10px;
          font-size: 0.9rem;
          line-height: 1.6;
        }
        .wellbeing-nudge__reach {
          display: inline-block;
          font-size: 0.9rem;
          color: #8a6d3b;
          text-decoration: underline;
        }
        .wellbeing-nudge__actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }
        .wellbeing-nudge__btn {
          flex: 1;
          padding: 9px 12px;
          border-radius: 10px;
          border: none;
          font-size: 0.9rem;
          cursor: pointer;
          background: #c9b27e;
          color: #fff;
        }
        .wellbeing-nudge__btn--muted {
          background: transparent;
          color: #8a8270;
          border: 1px solid rgba(140, 130, 112, 0.4);
        }
      `}</style>
    </div>
  );
}
