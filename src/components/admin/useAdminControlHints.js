"use client";

import { useEffect } from "react";

const CONTROL_SELECTOR = "[data-admin-hint]";

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
  return cleanText(control.getAttribute("data-admin-hint"));
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
    if (hintNode.textContent !== hint) hintNode.textContent = hint;
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
