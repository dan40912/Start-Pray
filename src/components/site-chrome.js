"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuthSession } from "@/hooks/useAuthSession";
import { clearAuthSession } from "@/lib/auth-storage";

const PRIMARY_NAV = [
  { href: "/prayfor", label: "禱告牆" },
  { href: "/global-prayer-room", label: "全球禱告室" },
  { href: "/overcomer", label: "得勝者" },
  { href: "/about", label: "平台介紹" },
  { href: "/howto", label: "使用方式" },
  { href: "/customer-portal", label: "會員中心", requiresAuth: true },
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
      { href: "/customer-portal", label: "會員中心" },
    ],
  },
  {
    title: "信任與條款",
    links: [
      { href: "/whitepaper", label: "平台原則與信任說明" },
    ],
  },
  {
    title: "帳號與聯絡",
    links: [
      { href: "/login", label: "登入" },
      { href: "/signup", label: "註冊" },
      { href: "mailto:startpraynow@gmail.com", label: "客服信箱" },
    ],
  },
];

const SOCIAL_LINKS = [
  {
    href: "https://github.com/dan40912/Start-Pray",
    label: "開源儲存庫",
    icon: "github",
    external: true,
  },
  { href: "https://line.me/ti/p/6NyeVZ6waP", label: "LINE", icon: "line", external: true },
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.6 10.2c0-4.15-3.86-7.53-8.6-7.53s-8.6 3.38-8.6 7.53c0 3.72 3.07 6.83 7.22 7.42.28.06.66.18.75.41.08.21.05.54.03.75l-.12.72c-.04.21-.17.84.74.46.91-.38 4.91-2.95 6.7-5.04 1.23-1.35 1.88-2.72 1.88-4.72Zm-11.4 2.08H7.47a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h.86c.11 0 .2.09.2.2v2.59H9.2c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2Zm1.67-.2a.2.2 0 0 1-.2.2h-.86a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h.86c.11 0 .2.09.2.2v3.45Zm4.03 0a.2.2 0 0 1-.2.2h-.86a.2.2 0 0 1-.16-.08l-1.67-2.28v2.16a.2.2 0 0 1-.2.2h-.86a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h.86c.06 0 .12.03.16.08l1.67 2.28V8.63c0-.11.09-.2.2-.2h.86c.11 0 .2.09.2.2v3.45Zm2.87-2.79h-1.73v.58h1.73c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2h-1.73v.58h1.73c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2h-2.79a.2.2 0 0 1-.2-.2V8.63c0-.11.09-.2.2-.2h2.79c.11 0 .2.09.2.2v.66c0 .11-.09.2-.2.2Z"
      />
    </svg>
  );
}

function resolveNavHref(item, isAuthenticated) {
  if (item.requiresAuth && !isAuthenticated) {
    return "/login?next=/customer-portal";
  }
  return item.href;
}

function isNavActive(currentPath, href) {
  if (href === "/prayfor") {
    return currentPath === "/prayfor" || currentPath.startsWith("/prayfor/");
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function SiteHeader({ activePath, hideAuthActions = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const current = activePath ?? pathname;
  const isAuthenticated = Boolean(authUser);
  const navItems = useMemo(() => PRIMARY_NAV, []);

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
      router.push("/prayfor");
    }
  }, [closeMenu, router]);

  return (
    <header className="site-header">
      <div className="container navbar">
        <Link className="logo" href="/" prefetch={false}>
          <img className="logo-img" src="/img/logo.png" alt="Start Pray logo" />
          Start Pray
        </Link>

        <button
          type="button"
          className={`menu-toggle${menuOpen ? " is-open" : ""}`}
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="切換導覽選單"
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
            const targetHref = resolveNavHref(item, isAuthenticated);
            const isActive = isNavActive(current, item.href);
            return (
              <Link
                key={item.href}
                href={targetHref}
                prefetch={false}
                className={isActive ? "active" : undefined}
                onClick={closeMenu}
                title={item.requiresAuth && !isAuthenticated ? "登入後可進入會員中心" : undefined}
              >
                {item.label}
              </Link>
            );
          })}

          {!hideAuthActions ? (
            <div className="nav-actions">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/customer-portal/create"
                    prefetch={false}
                    className="btn btn-primary"
                    onClick={closeMenu}
                  >
                    + 新增代禱
                  </Link>
                  {authUser?.name ? <span className="nav-user">Hi, {authUser.name}</span> : null}
                  <button type="button" className="btn btn-glass" onClick={handleLogout}>
                    登出
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    prefetch={false}
                    className="btn btn-glass"
                    onClick={closeMenu}
                  >
                    登入
                  </Link>
                  <Link
                    href="/signup"
                    prefetch={false}
                    className="btn btn-primary"
                    onClick={closeMenu}
                  >
                    註冊
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/" prefetch={false} aria-label="Start Pray homepage">
              <img className="footer-logo" src="/img/logo.png" alt="Start Pray logo" />
            </Link>
            <div>
              <strong>Start Pray</strong>
              <p>讓需要被守望的人能安全說出來，讓願意代禱的人能真實回應。</p>
              <div className="footer-socials" aria-label="Start Pray 社群連結">
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
                      aria-label={`${link.label} 連結待補`}
                      title={`${link.label} 連結待補`}
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
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title} className="footer-column">
                <span className="footer-title">{column.title}</span>
                {column.links.map((link) =>
                  link.href.startsWith("mailto:") ? (
                    <a key={link.label} href={link.href}>
                      {link.label}
                    </a>
                  ) : (
                    <Link key={link.label} href={link.href} prefetch={false}>
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 Start Pray. All rights reserved.</span>
          <div className="footer-legal">
            <Link href="/whitepaper" prefetch={false}>
              平台原則與信任說明
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
