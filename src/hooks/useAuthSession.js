"use client";

import { useEffect, useState } from "react";
import {
  AUTH_CHANGE_EVENT,
  AUTH_STORAGE_KEY,
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
} from "@/lib/auth-storage";

function isSameUser(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// 每個呼叫這個 hook 的元件過去都會自己打一次 /api/customer/session。
// 一個詳情頁上就有頁首、頁尾、留言區同時掛載 —— 同一份答案問三次。
// 同一時間內的請求共用同一個 promise。
let inFlight = null;

async function readServerSession() {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch("/api/customer/session", { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      return data?.user ?? null;
    } finally {
      // 下一個 tick 才清掉，讓同一輪掛載的元件都搭到這一班車，
      // 但登入/登出後的重新查詢仍然打得出去。
      setTimeout(() => {
        inFlight = null;
      }, 0);
    }
  })();

  return inFlight;
}

export function useAuthSession() {
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    let active = true;

    const syncAuth = async () => {
      const localSession = readAuthSession();
      if (active) {
        setAuthUser(localSession);
      }

      try {
        const serverSession = await readServerSession();
        if (!active) return;

        if (!serverSession) {
          if (localSession) {
            clearAuthSession();
          }
          setAuthUser(null);
          return;
        }

        setAuthUser(serverSession);
        if (!isSameUser(serverSession, localSession)) {
          saveAuthSession(serverSession);
        }
      } catch (error) {
        // Keep local snapshot when session endpoint is temporarily unavailable.
        if (active) {
          setAuthUser(localSession);
        }
      }
    };

    syncAuth();

    const handleStorage = (event) => {
      if (event.key && event.key !== AUTH_STORAGE_KEY) return;
      void syncAuth();
    };

    const handleAuthChange = () => {
      void syncAuth();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);

    return () => {
      active = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  return authUser;
}
