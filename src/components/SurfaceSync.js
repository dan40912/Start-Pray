"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { resolveSurface } from "@/lib/surface";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// <html data-surface> 由 root layout 在伺服器端依網址決定，但站內換頁時
// root layout 不會重新渲染 —— 從首頁（night）點進 /terms（day），整頁還掛著
// night 的 token，淺色卡片上的內文就變成白字。這裡在每次換頁時補上正確的表面。
// 用 layout effect 是為了在畫面繪製前換好，不閃一下錯的顏色。
export default function SurfaceSync() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    const surface = resolveSurface(pathname);
    if (document.documentElement.dataset.surface !== surface) {
      document.documentElement.dataset.surface = surface;
    }
  }, [pathname]);

  return null;
}
