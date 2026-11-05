import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { localizePath } from "@/lib/i18n";
import { updates } from "@/lib/platform-updates";
import styles from "./PlatformUpdatesPage.module.css";

const copy = {
  "zh-TW": {
    title: "平台更新",
    intro: "看看 Start Pray 最近加入了什麼，也可以回顧歷次重大更新。",
    latest: "最新更新",
    language: "zh",
  },
  en: {
    title: "What’s new",
    intro: "See what’s new on Start Pray and revisit past major updates.",
    latest: "Latest update",
    language: "en",
  },
};

export function updatesMetadata(locale) {
  return { title: copy[locale].title + " | Start Pray", description: copy[locale].intro };
}

export default function PlatformUpdatesPage({ locale }) {
  const labels = copy[locale];
  const dates = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", timeZone: "UTC" });
  const releases = [...updates].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <>
      <SiteHeader locale={locale} />
      <main className={styles.page}>
        <div className={styles.intro}>
          <p>Start Pray</p>
          <h1>{labels.title}</h1>
          <p>{labels.intro}</p>
        </div>
        <ol className={styles.releases} role="list">
          {releases.map((release, index) => {
            const [title, description, action] = release[labels.language];
            return (
              <li key={release.id}>
                <article id={release.id} className={styles.release}>
                  <div className={styles.meta}>
                    <time dateTime={release.month}>{dates.format(new Date(release.month + "-01"))}</time>
                    {index === 0 && <span className={styles.badge}>{labels.latest}</span>}
                  </div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <Link className="btn btn-primary" href={localizePath(release.href, locale)}>
                    {action} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              </li>
            );
          })}
        </ol>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
