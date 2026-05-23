"use client";

import { useEffect } from "react";

const CONTROL_SELECTOR = [
  "button",
  "a.button",
  "a.link-button",
  "input",
  "select",
  "textarea",
].join(",");

function textFromLabel(control) {
  if (!control.id) return "";
  const root = control.ownerDocument;
  const label = root.querySelector(`label[for="${CSS.escape(control.id)}"]`);
  return label?.textContent?.trim() || "";
}

function textFromWrapperLabel(control) {
  const label = control.closest("label");
  if (!label) return "";
  const clone = label.cloneNode(true);
  clone.querySelectorAll("input, select, textarea, button").forEach((node) => node.remove());
  return clone.textContent?.trim() || "";
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferControlName(control) {
  const explicit =
    control.getAttribute("aria-label") ||
    control.getAttribute("data-admin-hint-label") ||
    textFromLabel(control) ||
    textFromWrapperLabel(control) ||
    control.getAttribute("placeholder") ||
    control.textContent ||
    control.name ||
    control.id;

  return cleanText(explicit);
}

function inferHint(control) {
  const preset = control.getAttribute("data-admin-hint");
  if (preset) return cleanText(preset);

  const name = inferControlName(control);
  if (!name) return "";

  const tagName = control.tagName.toLowerCase();
  const type = control.getAttribute("type") || "";

  if (tagName === "input" && type === "search") {
    return `搜尋欄位：${name}。輸入關鍵字後列表會依目前條件縮小範圍。`;
  }

  if (tagName === "input" || tagName === "textarea") {
    return `欄位：${name}。請確認內容正確後再儲存。`;
  }

  if (tagName === "select") {
    return `選單：${name}。變更後會影響目前列表或儲存內容。`;
  }

  if (tagName === "a") {
    return `連結：${name}。會帶你前往相關頁面查看或處理。`;
  }

  return `按鈕：${name}。點擊前請確認目前頁面與選取對象。`;
}

function applyHints(root) {
  if (!root) return;

  root.querySelectorAll(CONTROL_SELECTOR).forEach((control) => {
    const hint = inferHint(control);
    if (!hint) return;

    if (!control.getAttribute("title")) {
      control.setAttribute("title", hint);
    }

    if (!control.getAttribute("aria-label") && !textFromLabel(control) && !textFromWrapperLabel(control)) {
      const name = inferControlName(control);
      if (name) control.setAttribute("aria-label", name);
    }

    let hintId = control.getAttribute("data-admin-hint-id");
    if (!hintId) {
      hintId = `admin-hint-${Math.random().toString(36).slice(2, 10)}`;
      control.setAttribute("data-admin-hint-id", hintId);
      const describedBy = control.getAttribute("aria-describedby");
      control.setAttribute("aria-describedby", describedBy ? `${describedBy} ${hintId}` : hintId);
    }

    let hintNode = control.ownerDocument.getElementById(hintId);
    if (!hintNode) {
      hintNode = control.ownerDocument.createElement("span");
      hintNode.id = hintId;
      hintNode.className = "admin-control-hint";
      control.insertAdjacentElement("afterend", hintNode);
    }
    hintNode.textContent = hint;
  });
}

export function useAdminControlHints(pathname) {
  useEffect(() => {
    const root = document.querySelector(".admin-shell, .admin-auth");
    if (!root) return undefined;

    applyHints(root);
    const observer = new MutationObserver(() => applyHints(root));
    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [pathname]);
}
