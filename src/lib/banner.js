import prisma from "@/lib/prisma";

const DEFAULT_BANNER = {
  eyebrow: "Start Pray",
  headline: "把需要帶到禱告裡，也把回應留給對方",
  subheadline: "瀏覽公開代禱、留下文字或語音回應，和不同地方的人一起守望。",
  description:
    "這裡不是一般產品頁，而是一個正在被維護的陪伴空間。請溫柔分享，也留意不要公開敏感個資。",
  primaryCta: { label: "立即註冊", href: "/signup" },
  secondaryCta: { label: "了解使用方式", href: "/howto" },
  heroImage: "/img/pray.png"
};

function normalizeLocalHref(value, fallback) {
  const href = typeof value === "string" ? value.trim() : "";
  if (!href) return fallback;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return fallback;
}

function normalizeSiteImage(value, fallback) {
  const image = typeof value === "string" ? value.trim() : "";
  if (!image) return fallback;
  if (
    image.startsWith("/img/") ||
    image.startsWith("/uploads/") ||
    image.startsWith("/api/card-thumbnail?")
  ) {
    return image;
  }
  return fallback;
}

function normalize(record) {
  if (!record) {
    return DEFAULT_BANNER;
  }

  return {
    eyebrow: record.eyebrow ?? DEFAULT_BANNER.eyebrow,
    headline: record.headline ?? DEFAULT_BANNER.headline,
    subheadline: record.subheadline ?? DEFAULT_BANNER.subheadline,
    description: record.description ?? DEFAULT_BANNER.description,
    primaryCta: {
      label: record.primaryCtaLabel ?? DEFAULT_BANNER.primaryCta.label,
      href: normalizeLocalHref(record.primaryCtaHref, DEFAULT_BANNER.primaryCta.href)
    },
    secondaryCta:
      record.secondaryCtaLabel && record.secondaryCtaHref
        ? {
            label: record.secondaryCtaLabel,
            href: normalizeLocalHref(record.secondaryCtaHref, DEFAULT_BANNER.secondaryCta.href)
          }
        : DEFAULT_BANNER.secondaryCta,
    heroImage: normalizeSiteImage(record.heroImage, DEFAULT_BANNER.heroImage)
  };
}

export async function readBanner() {
  const record = await prisma.siteBanner.findUnique({ where: { id: 1 } });
  return normalize(record);
}

export async function writeBanner(nextBanner) {
  const payload = {
    eyebrow: nextBanner.eyebrow ?? DEFAULT_BANNER.eyebrow,
    headline: nextBanner.headline ?? DEFAULT_BANNER.headline,
    subheadline: nextBanner.subheadline ?? DEFAULT_BANNER.subheadline,
    description: nextBanner.description ?? DEFAULT_BANNER.description,
    primaryCtaLabel: nextBanner.primaryCta?.label ?? DEFAULT_BANNER.primaryCta.label,
    primaryCtaHref: normalizeLocalHref(nextBanner.primaryCta?.href, DEFAULT_BANNER.primaryCta.href),
    secondaryCtaLabel: nextBanner.secondaryCta?.label ?? null,
    secondaryCtaHref: nextBanner.secondaryCta
      ? normalizeLocalHref(nextBanner.secondaryCta.href, DEFAULT_BANNER.secondaryCta.href)
      : null,
    heroImage: normalizeSiteImage(nextBanner.heroImage, DEFAULT_BANNER.heroImage)
  };

  const record = await prisma.siteBanner.upsert({
    where: { id: 1 },
    update: payload,
    create: { id: 1, ...payload }
  });

  return normalize(record);
}
