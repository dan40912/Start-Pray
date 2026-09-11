import "./globals.css";
import "@/styles/theme-modern.css";
import "@/styles/fontawesome-lite.css";
// tokens.css 必須最後載入：它收編前面各檔散落的變數名，讓舊規則跟著
// surface 走。詳見 src/styles/tokens.css 開頭的規則。
import "@/styles/tokens.css";
import { headers } from "next/headers";
import { Noto_Serif_TC } from "next/font/google";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import GlobalPlayerGate from "@/components/GlobalPlayerGate";
import SurfaceSync from "@/components/SurfaceSync";
import { AudioProvider } from "@/context/AudioContext";
import { getDictionary, localeFromPathname } from "@/lib/i18n";
import { readSiteSettings } from "@/lib/siteSettings";
import { resolveSurface } from "@/lib/surface";
import { SITE_NAME, SITE_URL, buildPageMetadata } from "@/lib/seo";

// Open Sans / Raleway / Poppins used to be loaded here, but nothing ever
// referenced --font-sans, --font-raleway or --font-poppins, and no stylesheet
// named those families directly: body text resolves through theme-modern.css's
// --font-body ('Inter', system-ui). They were downloaded, self-hosted and
// preloaded on every page for glyphs that never rendered.
//
// Display face for the "夜禱" hero headings (HomePrayerHero only). Kept to the
// single weight that is actually used — a CJK family is self-hosted as ~45
// unicode-range chunks *per weight*, so every extra weight costs megabytes of
// build output for glyphs nothing renders. `preload: false` is required because
// Google only exposes a `latin` subset for this family (next/font fails the
// build otherwise) and it also keeps the font off the critical path: the
// browser fetches only the chunks whose characters appear in the headline.
// `display: swap` keeps the heading readable meanwhile.
const notoSerifTC = Noto_Serif_TC({
  weight: "600",
  display: "swap",
  preload: false,
  variable: "--font-serif-tc",
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  ...buildPageMetadata({
    title: {
      default: "Start Pray 一起禱告吧",
      template: `%s | ${SITE_NAME}`,
    },
    description:
      "Start Pray 讓人分享代禱、用文字與語音彼此回應，並透過全球禱告地圖看見正在被守望的需要。",
    path: "/",
    keywords: ["Start Pray", "禱告", "代禱", "基督信仰", "見證", "得勝者", "語音禱告", "全球禱告室"],
  }),
  applicationName: SITE_NAME,
  category: "faith community",
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-32x32.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const dynamic = "force-dynamic";

function extractPathFromHeaders(requestHeaders) {
  const candidates = [
    requestHeaders.get("x-start-pray-pathname"),
    requestHeaders.get("x-invoke-path"),
    requestHeaders.get("next-url"),
    requestHeaders.get("referer"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (candidate.startsWith("/")) {
      return candidate;
    }

    try {
      const parsed = new URL(candidate, "http://localhost");
      if (parsed.pathname) {
        return parsed.pathname;
      }
    } catch {
      // Ignore malformed values.
    }
  }

  return "/";
}

function shouldBypassMaintenance(pathname) {
  if (!pathname) return false;
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  );
}

function StructuredData() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/img/logo.png`,
      sameAs: [],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "zh-Hant-TW",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/prayfor?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export default async function RootLayout({ children }) {
  const requestHeaders = headers();
  const requestPath = extractPathFromHeaders(requestHeaders);
  const locale = localeFromPathname(requestPath);
  const dictionary = getDictionary(locale);

  if (!shouldBypassMaintenance(requestPath)) {
    const settings = await readSiteSettings();
    if (settings?.maintenanceMode) {
      return (
        <html
          lang={dictionary.htmlLang}
          className={notoSerifTC.variable}
          data-surface="day"
        >
          <head>
            <meta name="robots" content="noindex,nofollow" />
          </head>
          <body>
            <SiteHeader locale={locale} />
            <div
              style={{
                minHeight: "80vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4rem 1.5rem",
                background:
                  "linear-gradient(160deg, rgba(15, 23, 42, 0.92), rgba(37, 99, 235, 0.65))",
              }}
            >
              <div
                style={{
                  maxWidth: "640px",
                  width: "100%",
                  background: "rgba(8, 13, 25, 0.85)",
                  borderRadius: "1.6rem",
                  padding: "3rem",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  boxShadow: "0 24px 48px rgba(8, 15, 30, 0.35)",
                  display: "grid",
                  gap: "1.75rem",
                  textAlign: "center",
                  color: "#f8fafc",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "4rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: "#38bdf8",
                    }}
                  >
                    維護中
                  </div>
                  <h1 style={{ marginBottom: "1rem" }}>Start Pray 暫時維護中</h1>
                  <p style={{ lineHeight: 1.8 }}>
                    我們正在調整服務，請稍後再回來。若有緊急需求，請聯絡客服信箱。
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <a
                    href="mailto:startpraynow@gmail.com"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.8rem 1.4rem",
                      borderRadius: "0.9rem",
                      border: "none",
                      background: "linear-gradient(120deg, #0ea5e9, #38bdf8)",
                      color: "#02121f",
                      fontWeight: 600,
                    }}
                  >
                    聯絡客服
                  </a>
                </div>
              </div>
            </div>
            <SiteFooter locale={locale} />
          </body>
        </html>
      );
    }
  }

  return (
    <html
      lang={dictionary.htmlLang}
      className={notoSerifTC.variable}
      data-surface={resolveSurface(requestPath)}
    >
      <body>
        <StructuredData />
        <SurfaceSync />
        <AudioProvider>
          {children}
          <GlobalPlayerGate />
        </AudioProvider>
      </body>
    </html>
  );
}
