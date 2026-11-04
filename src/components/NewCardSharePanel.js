"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// 剛發布代禱的人被帶到自己的代禱頁時（網址帶 ?shared=new），在頁面上方提醒他
// 把連結傳出去。在台灣大部分人是在 LINE 群組請大家代禱，所以 LINE 放第一個。
export default function NewCardSharePanel({ canonicalPath, title = "" }) {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (searchParams?.get("shared") !== "new") return;
    setShareUrl(`${window.location.origin}${canonicalPath}`);
    setVisible(true);
    // 重新整理或之後再分享這個網址時，不要再跳出提示。
    const url = new URL(window.location.href);
    url.searchParams.delete("shared");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [canonicalPath, searchParams]);

  if (!visible) return null;

  const lineHref = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
    title ? `請幫我為「${title}」禱告 🙏` : "請幫我禱告 🙏"
  )}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("複製這個連結：", shareUrl);
    }
  };

  return (
    <section className="new-card-share" role="status" aria-live="polite">
      <div className="new-card-share__text">
        <strong>你的代禱已經發布 🙏</strong>
        <p>把連結傳給家人朋友，讓更多人一起為你禱告。大家的禱告都會出現在這一頁；有註冊的話，也會收到 email 通知。</p>
      </div>
      <div className="new-card-share__actions">
        <a className="new-card-share__btn new-card-share__btn--line" href={lineHref} target="_blank" rel="noopener noreferrer">
          分享到 LINE
        </a>
        <button type="button" className="new-card-share__btn" onClick={handleCopy}>
          {copied ? "已複製連結" : "複製連結"}
        </button>
        <button type="button" className="new-card-share__close" onClick={() => setVisible(false)} aria-label="關閉">
          ×
        </button>
      </div>
    </section>
  );
}
