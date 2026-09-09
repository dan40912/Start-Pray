"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuthSession } from "@/hooks/useAuthSession";
import { clearAuthSession } from "@/lib/auth-storage";
import {
  alternateLocale,
  getDictionary,
  localeFromPathname,
  localizePath,
  localizedLoginPath,
  normalizeLocale,
  stripLocalePrefix,
} from "@/lib/i18n";

// --- Phase 1 temporary navigation switch (docs/obsidian/11-Decision-Log.md DEC-003) ---
// Hides the global prayer room entry only. It does NOT remove the route —
// /global-prayer-room still works when visited directly.
const SHOW_GLOBAL_ROOM_NAV_ENTRY = false;

// Account entry points (DEC-001) are visible again. The anonymous-first flows are
// unchanged: praying, responding and creating a card still need no account, so the
// account entries stay deliberately quieter than the prayer CTA — 登入 is a plain
// text button, 註冊 an outline, and neither uses btn-primary. 會員中心 only appears
// once there is a session to open.

const PRIMARY_NAV = [
  { href: "/prayfor", key: "prayerWall" },
  { href: "/global-prayer-room", key: "globalRoom", hidden: !SHOW_GLOBAL_ROOM_NAV_ENTRY },
  { href: "/overcomer", key: "overcomer" },
  { href: "/about", key: "about" },
  { href: "/howto", key: "howto" },
  { href: "/me", key: "portal", requiresAuth: true, authOnly: true },
];

const FOOTER_COLUMNS = [
  {
    title: "Start Pray",
    links: [
      { href: "/prayfor", label: "禱告牆" },
      { href: "/global-prayer-room", label: "全球禱告室" },
      { href: "/overcomer", label: "得勝者" },
      { href: "/about", label: "平台介紹" },
      { href: "/howto", label: "使用方式" },
      { href: "/me", label: "會員中心" },
    ],
  },
  {
    title: "安心使用",
    links: [
      { href: "/terms", label: "使用條款" },
    ],
  },
  {
    title: "帳號與幫助",
    links: [
      { href: "/login", label: "登入" },
      { href: "/signup", label: "註冊" },
      { href: "/forgot-password", label: "忘記密碼" },
      { href: "mailto:startpraynow@gmail.com", label: "聯絡我們" },
    ],
  },
];

const LOCALE_REDIRECT_ONLY_PATHS = ["/me"];

const SOCIAL_LINKS = [
  {
    href: "https://github.com/dan40912/Start-Pray",
    label: "GitHub",
    icon: "github",
    external: true,
  },
  { href: "https://line.me/ti/p/6NyeVZ6waP", label: "LINE", icon: "line", external: true },
  {
    href: "https://www.instagram.com/startpray.online/",
    label: "Instagram",
    icon: "instagram",
    external: true,
  },
  {
    href: "https://www.threads.com/@startpray.online",
    label: "Threads",
    icon: "threads",
    external: true,
  },
].filter(Boolean);

function SocialIcon({ icon }) {
  if (icon === "github") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.58 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.55-1.15-4.55-5.1 0-1.13.39-2.05 1.03-2.77-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.06A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.34 2.75-1.06 2.75-1.06.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.77 0 3.96-2.33 4.84-4.56 5.1.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .27.18.59.69.49A10.27 10.27 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z"
        />
      </svg>
    );
  }

  if (icon === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7.8 2.8h8.4c2.8 0 5 2.2 5 5v8.4c0 2.8-2.2 5-5 5H7.8c-2.8 0-5-2.2-5-5V7.8c0-2.8 2.2-5 5-5Zm0 2.2C6.2 5 5 6.2 5 7.8v8.4C5 17.8 6.2 19 7.8 19h8.4c1.6 0 2.8-1.2 2.8-2.8V7.8C19 6.2 17.8 5 16.2 5H7.8Zm4.2 3.1a3.9 3.9 0 1 1 0 7.8 3.9 3.9 0 0 1 0-7.8Zm0 2.2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Zm4.2-2.8a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"
        />
      </svg>
    );
  }

  if (icon === "threads") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M20.742 8.181l-1.63.433a.36.36 0 0 1 0-.111 7.9 7.9 0 0 0-.795-1.871 5.83 5.83 0 0 0-3.079-2.465 8.1 8.1 0 0 0-2.112-.392 8.43 8.43 0 0 0-1.59 0 7.34 7.34 0 0 0-2.365.664 5.7 5.7 0 0 0-2.324 2.213 8.3 8.3 0 0 0-.805 2.093c-.147.584-.245 1.18-.291 1.781a15.7 15.7 0 0 0 0 1.741c.02 1.022.176 2.037.462 3.018.222.744.562 1.447 1.007 2.082a5.83 5.83 0 0 0 2.505 1.922c.62.238 1.27.387 1.932.443a10 10 0 0 0 1.942 0 6.34 6.34 0 0 0 2.173-.584 5.16 5.16 0 0 0 1.922-1.65c.3-.424.498-.911.579-1.425a3.95 3.95 0 0 0-.116-1.534 3.24 3.24 0 0 0-1.107-1.519l-.352-.252c0 .131 0 .242-.05.353a6.1 6.1 0 0 1-.614 1.771c-.265.501-.643.934-1.104 1.264a4.04 4.04 0 0 1-1.553.637 5.34 5.34 0 0 1-2.213-.111 3.9 3.9 0 0 1-1.54-.895 2.77 2.77 0 0 1-.835-1.781 2.86 2.86 0 0 1 .262-1.678 3.4 3.4 0 0 1 1.126-1.27 4.8 4.8 0 0 1 1.63-.644 9.2 9.2 0 0 1 1.771-.121c.455.011.909.051 1.358.121h.081v-.06a3.3 3.3 0 0 0-.382-1.077 2.03 2.03 0 0 0-1.258-.885 3.25 3.25 0 0 0-1.871 0c-.444.146-.829.432-1.097.815l-.05.141-1.378-.956c.027-.031.05-.065.07-.101a3.91 3.91 0 0 1 2.455-1.56 5.32 5.32 0 0 1 2.545.111 3.35 3.35 0 0 1 2.153 1.831c.253.499.42 1.036.493 1.59 0 .211.05.423.071.634v.08l.412.201a5.43 5.43 0 0 1 1.69 1.338 4.66 4.66 0 0 1 1.007 2.012c.082.441.109.89.08 1.338a5.57 5.57 0 0 1-1.288 3.129 6.7 6.7 0 0 1-3.733 2.244 10.6 10.6 0 0 1-3.743.171 8.57 8.57 0 0 1-2.757-.805 6.8 6.8 0 0 1-2.807-2.485 8.8 8.8 0 0 1-1.137-2.576 12.4 12.4 0 0 1-.392-2.012A15.2 15.2 0 0 1 4 11.763c0-.573 0-1.157.101-1.741.076-.658.197-1.31.362-1.951a8.9 8.9 0 0 1 .946-2.344 7.1 7.1 0 0 1 4.024-3.25 8.6 8.6 0 0 1 1.851-.412 11.2 11.2 0 0 1 2.395 0 8.86 8.86 0 0 1 2.716.744 7.3 7.3 0 0 1 3.109 2.636 9.8 9.8 0 0 1 1.208 2.686c.005.019.015.037.03.05ZM15.077 12.206h-.07a8.5 8.5 0 0 0-1.006-.141 9.4 9.4 0 0 0-1.067 0 5.1 5.1 0 0 0-1.177.161 2.08 2.08 0 0 0-.926.543 1.28 1.28 0 0 0-.238 1.529c.085.164.204.308.349.423.226.179.486.309.765.382.417.106.852.126 1.278.06.291-.036.574-.125.835-.261.389-.233.692-.586.865-1.006.225-.541.357-1.115.392-1.7v.01Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.6 10.2c0-4.15-3.86-7.53-8.6-7.53s-8.6 3.38-8.6 7.53c0 3.72 3.07 6.83 7.22 7.42.28.06.66.18.75.41.08.21.05.54.03.75l-.12.72c-.04.21-.17.84.74.46.91-.38 4.91-2.95 6.7-5.04 1.23-1.35 1.88-2.72 1.88-4.72Zm-11.4 2.08H7.47a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h.86c.11 0 .2.09.2.2v2.59H9.2c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2Zm1.67-.2a.2.2 0 0 1-.2.2h-.86a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h.86c.11 0 .2.09.2.2v3.45Zm4.03 0a.2.2 0 0 1-.2.2h-.86a.2.2 0 0 1-.16-.08l-1.67-2.28v2.16a.2.2 0 0 1-.2.2h-.86a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h.86c.06 0 .12.03.16.08l1.67 2.28V8.63c0-.11.09-.2.2-.2h.86c.11 0 .2.09.2.2v3.45Zm2.87-2.79h-1.73v.58h1.73c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2h-1.73v.58h1.73c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2h-2.79a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h2.79c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2Z"
      />
    </svg>
  );
}

function resolveNavHref(item, isAuthenticated, locale) {
  if (item.requiresAuth && !isAuthenticated) {
    return localizedLoginPath(locale, "/me");
  }
  return localizePath(item.href, locale);
}

function isNavActive(currentPath, href) {
  const normalizedPath = stripLocalePrefix(currentPath);
  if (href === "/prayfor") {
    return normalizedPath === "/prayfor" || normalizedPath.startsWith("/prayfor/");
  }
  return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
}

export function SiteHeader({ activePath, hideAuthActions = false, locale: localeProp }) {
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const current = activePath ?? pathname;
  const locale = normalizeLocale(localeProp || localeFromPathname(pathname));
  const nextLocale = alternateLocale(locale);
  const dictionary = getDictionary(locale);
  const siteText = dictionary.site;
  const isAuthenticated = Boolean(authUser);
  const navItems = useMemo(
    () =>
      PRIMARY_NAV.filter((item) => !item.hidden)
        .filter((item) => !item.authOnly || isAuthenticated)
        .map((item) => ({
          ...item,
          label: siteText.nav[item.key],
        })),
    [siteText, isAuthenticated],
  );
  const languageHref = localizePath(stripLocalePrefix(pathname || current || "/"), nextLocale);
  // /en/me 與 /en/me/create 只是 redirect 回中文版
  // （見那兩個 page.js）。在這些頁面上顯示語言切換，是給一個兌現不了的承諾：
  // 使用者按下 English，整頁還是中文。有真英文版的頁面照常顯示。
  const hasEnglishVersion = !LOCALE_REDIRECT_ONLY_PATHS.some((prefix) => {
    const path = stripLocalePrefix(pathname || current || "/");
    return path === prefix || path.startsWith(`${prefix}/`);
  });

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    closeMenu();
  }, [current, closeMenu]);

  const handleLogout = useCallback(async () => {
    closeMenu();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await fetch("/api/customer/session", { method: "DELETE" });
    } catch {
      // noop
    } finally {
      clearAuthSession();
      router.push(localizePath("/prayfor", locale));
    }
  }, [closeMenu, locale, router]);

  return (
    <header className="site-header">
      <div className="container navbar">
        <Link className="logo" href={localizePath("/", locale)} prefetch={false}>
          <img className="logo-img" src="/img/logo.png" alt="Start Pray logo" />
          Start Pray
        </Link>

        <button
          type="button"
          className={`menu-toggle${menuOpen ? " is-open" : ""}`}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={siteText.nav.menuToggle}
          aria-expanded={menuOpen}
          aria-controls="site-primary-nav"
        >
          <span className="menu-toggle__icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav id="site-primary-nav" className={`nav-links ${menuOpen ? "open" : ""}`}>
          {navItems.map((item) => {
            const targetHref = resolveNavHref(item, isAuthenticated, locale);
            const isActive = isNavActive(current, item.href);
            return (
              <Link
                key={item.href}
                href={targetHref}
                prefetch={false}
                className={isActive ? "active" : undefined}
                onClick={closeMenu}
                title={item.requiresAuth && !isAuthenticated ? siteText.nav.portalLoginHint : undefined}
              >
                {item.label}
              </Link>
            );
          })}

          {hasEnglishVersion ? (
            <Link
              href={languageHref}
              prefetch={false}
              className="nav-language-switch"
              onClick={closeMenu}
              aria-label={siteText.language.label}
              title={siteText.language.current}
            >
              {siteText.language.switchTo}
            </Link>
          ) : null}

          {!hideAuthActions ? (
            <div className="nav-actions">
              {isAuthenticated ? (
                <>
                  <Link
                    href={localizePath("/me/create", locale)}
                    prefetch={false}
                    className="btn btn-primary"
                    onClick={closeMenu}
                  >
                    {siteText.nav.createPrayer}
                  </Link>
                  {authUser?.name ? <span className="nav-user">{siteText.nav.greeting}, {authUser.name}</span> : null}
                  <button type="button" className="btn btn-glass" onClick={handleLogout}>
                    {siteText.nav.logout}
                  </button>
                </>
              ) : (
                <div className="nav-account">
                  <Link
                    href={localizePath("/login", locale)}
                    prefetch={false}
                    className="btn btn-quiet nav-account__login"
                    onClick={closeMenu}
                  >
                    {siteText.nav.login}
                  </Link>
                  <Link
                    href={localizePath("/signup", locale)}
                    prefetch={false}
                    className="btn btn-outline nav-account__signup"
                    onClick={closeMenu}
                  >
                    {siteText.nav.signup}
                  </Link>
                  <p className="nav-account__hint">{siteText.nav.anonymousHint}</p>
                </div>
              )}
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ locale: localeProp }) {
  const pathname = usePathname();
  const locale = normalizeLocale(localeProp || localeFromPathname(pathname));
  const dictionary = getDictionary(locale);
  const siteText = dictionary.site;
  // 這一欄過去是靜態陣列，不看 session，所以登入之後頁尾還在請你「登入 / 註冊」。
  const authUser = useAuthSession();
  const isAuthenticated = Boolean(authUser);
  const footerColumns = [
    {
      title: "Start Pray",
      links: [
        { href: "/prayfor", label: siteText.nav.prayerWall },
        ...(SHOW_GLOBAL_ROOM_NAV_ENTRY ? [{ href: "/global-prayer-room", label: siteText.nav.globalRoom }] : []),
        { href: "/overcomer", label: siteText.nav.overcomer },
        { href: "/about", label: siteText.nav.about },
        { href: "/howto", label: siteText.nav.howto },
        { href: "/me", label: siteText.nav.portal },
      ],
    },
    {
      title: siteText.footer.trust,
      links: [
        { href: "/terms", label: siteText.footer.terms },
      ],
    },
    {
      title: siteText.footer.accountHelp,
      links: [
        ...(isAuthenticated
          ? [{ href: "/me", label: siteText.nav.portal }]
          : [
              { href: "/login", label: siteText.nav.login },
              { href: "/signup", label: siteText.nav.signup },
              { href: "/forgot-password", label: siteText.footer.forgotPassword },
            ]),
        { href: "mailto:startpraynow@gmail.com", label: siteText.footer.contact },
      ],
    },
  ];

  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href={localizePath("/", locale)} prefetch={false} aria-label={siteText.footer.homepageLabel}>
              <img className="footer-logo" src="/img/logo.png" alt="Start Pray logo" />
            </Link>
            <div>
              <strong>Start Pray</strong>
              <p>{siteText.footer.tagline}</p>
              <div className="footer-socials" aria-label={siteText.footer.socialLabel}>
                {SOCIAL_LINKS.map((link) =>
                  link.href ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className="footer-social"
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noreferrer noopener" : undefined}
                      aria-label={link.label}
                      title={link.label}
                    >
                      <SocialIcon icon={link.icon} />
                      <span>{link.label}</span>
                    </a>
                  ) : (
                    <span
                      key={link.label}
                      className="footer-social footer-social--disabled"
                      aria-label={`${link.label} ${siteText.footer.disabledLink}`}
                      title={`${link.label} ${siteText.footer.disabledLink}`}
                    >
                      <SocialIcon icon={link.icon} />
                      <span>{link.label}</span>
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="footer-grid">
            {footerColumns
              .filter((column) => column.links.length > 0)
              .map((column) => (
                <div key={column.title} className="footer-column">
                  <span className="footer-title">{column.title}</span>
                  {column.links.map((link) =>
                    link.href.startsWith("mailto:") ? (
                      <a key={link.label} href={link.href}>
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.label} href={localizePath(link.href, locale)} prefetch={false}>
                        {link.label}
                      </Link>
                    )
                  )}
                </div>
              ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 Start Pray. {siteText.footer.copyright}</span>
          <div className="footer-legal">
            <Link href={localizePath("/terms", locale)} prefetch={false}>
              {siteText.footer.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export const siteNavigation = {
  primary: PRIMARY_NAV,
  footer: FOOTER_COLUMNS,
  social: SOCIAL_LINKS,
};
