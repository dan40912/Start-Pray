import { SITE_URL } from "@/lib/seo";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/prayfor",
          "/global-prayer-room",
          "/overcomer",
          "/about",
          "/howto",
          "/terms",
          "/en",
          "/en/prayfor",
          "/en/global-prayer-room",
          "/en/overcomer",
          "/en/about",
          "/en/howto",
          "/en/terms",
        ],
        disallow: [
          "/admin",
          "/api",
          "/me",
          "/legacy",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/en/login",
          "/en/signup",
          "/en/forgot-password",
          "/en/reset-password",
          "/uploads",
          "/voices",
          "/whitepaper",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
