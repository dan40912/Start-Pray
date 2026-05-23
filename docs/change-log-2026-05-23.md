# 2026-05-23 Change Record

This note records the main Start Pray changes completed on 2026-05-23 and the items that should be reviewed before updating or deploying.

Start Pray is a prayer and companionship platform. The changes below should be reviewed with privacy, trust, mobile experience, and vulnerable-user context in mind, not only as technical feature work.

## Summary

Today's work focused on six areas:

1. Admin experience planning and hint coverage.
2. Public mobile UAT fixes and site chrome checks.
3. Privacy review for private `HomePrayerCard` data exposure.
4. Prayer response and voice prayer flow review.
5. Public documentation, SEO, legacy/noindex, and brand naming cleanup.
6. English i18n groundwork for public pages.

The final implemented milestone was the English public route layer under `/en`, with dictionary-based UI copy, localized metadata, sitemap/robots support, and a small i18n validation script.

## Implemented Changes

### English Public Routes

Added English route wrappers under:

```text
src/app/en/
```

Covered public entry points:

- `/en`
- `/en/prayfor`
- `/en/prayfor/[id]`
- `/en/global-prayer-room`
- `/en/login`
- `/en/signup`
- `/en/about`
- `/en/howto`
- `/en/terms`
- `/en/overcomer`
- `/en/overcomer/[slug]`
- `/en/forgot-password`

Customer portal English routes currently redirect back to the existing member center instead of pretending the private dashboard is fully translated:

- `/en/customer-portal`
- `/en/customer-portal/create`

### I18n Infrastructure

Added:

```text
src/lib/i18n/index.js
src/lib/i18n/locales/zh-TW.js
src/lib/i18n/locales/en.js
```

The helper layer includes locale normalization, dictionary lookup, locale detection from path, locale prefix stripping, localized path generation, alternate locale selection, and localized login paths.

Default route behavior remains unchanged:

- Chinese remains the default locale.
- Existing Chinese URLs are preserved.
- English routes are prefixed with `/en`.

### Header, Footer, And Site Chrome

Updated:

```text
src/components/site-chrome.js
src/app/layout.js
src/app/globals.css
```

Changes:

- Header and footer labels now read from locale dictionaries.
- Added language switcher between Chinese and English.
- Localized public nav links.
- Localized login/signup/logout labels.
- Kept member/admin flows conservative to avoid breaking authenticated behavior.

### Public Page UI Copy

Updated:

```text
src/components/HomeLandingPage.js
src/components/HomePrayerExplorer.js
src/app/prayfor/page.js
src/app/prayfor/[id]/page.js
src/app/global-prayer-room/page.js
src/components/GlobalPrayerRoom.js
src/components/Comments.js
src/app/login/page.js
src/app/login/LoginForm.js
src/app/signup/page.js
src/app/signup/SignupForm.js
```

Changes:

- Home page public CTAs and trust copy use dictionaries.
- Prayer wall search, quick tags, empty states, and card UI use dictionaries.
- Prayer detail shell, sticky actions, comments, login-required prompts, report modal copy, cooldown messages, upload failure copy, and share messages use dictionaries.
- Login and signup forms use localized labels, helpers, placeholders, and fallback errors.
- Global Prayer Room main UI, map controls, search, drawer actions, voice playback messages, response messages, and private-light notices use dictionaries.

### Privacy And Global Prayer Room

Updated:

```text
src/lib/globalPrayerPayload.js
src/app/global-prayer-room/page.js
src/components/GlobalPrayerRoom.js
```

Private `HomePrayerCard` records remain sanitized for public map use:

- No private title.
- No private description.
- No private owner.
- No private detail link.
- No private image.
- Approximate location light may still appear.

English private-light labels now say anonymous/approximate copy without exposing details.

### SEO, Robots, Sitemap

Updated:

```text
src/lib/seo.js
src/app/sitemap.js
src/app/robots.js
```

Changes:

- Added localized alternate links for Chinese and English public routes.
- Added English static routes to sitemap.
- Added English public prayer and public story routes to sitemap.
- Kept private/blocked cards filtered out.
- Kept legacy and old-risk routes disallowed/noindex where applicable.

### Documentation And Automated Checks

Added:

```text
docs/i18n.md
scripts/check-i18n.cjs
```

Updated:

```text
README.md
package.json
```

Changes:

- Added `npm run i18n:check`.
- The check compares Chinese and English dictionary keys, primitive types, and array lengths.
- Added i18n documentation covering route strategy, dictionary usage, privacy rules, SEO expectations, and known gaps.

## Validation Completed

Commands run successfully:

```bash
npm run i18n:check
npm run lint
DATABASE_URL=mysql://root:root@127.0.0.1:3306/prayercoin_dev NEXT_PUBLIC_APP_URL=http://localhost:3002 npm run build
```

Notes:

- `npm run i18n:check` passed with 355 dictionary keys.
- `npm run lint` passed with no warnings or errors.
- `npm run build` passed after running with access to the Docker MySQL database.
- A first sandboxed build attempt failed because the sandbox could not reach `127.0.0.1:3306`; this was an environment access issue, not a compile error.

Browser/UAT coverage included:

- `/en`
- `/en/prayfor`
- `/en/prayfor/6`
- `/en/global-prayer-room`
- `/en/login`
- `/en/signup`

Viewports checked:

- Mobile: `390x844`
- Tablet: `768x1024`
- Desktop: `1440x900`

Observed result:

- No mobile horizontal page overflow on the checked routes.
- Header/footer remained usable across checked sizes.
- Prayer detail sticky actions did not cover the visible main content in the checked states.
- Global Prayer Room English page now shows English UI copy except for the intentional language switch label `繁中`.

## Before Updating Or Deploying

Review these items before merging or deploying.

### 1. Database Required For Build

The production build touches some API routes during static generation. Make sure the build environment has a reachable `DATABASE_URL`.

Local successful build used:

```text
mysql://root:root@127.0.0.1:3306/prayercoin_dev
```

Do not assume `startpray_uat` exists locally unless the database has been created and migrated.

### 2. English Pages Are Route-Compatible, Not Fully Content-Translated

Stable UI is translated, but user-generated and database-backed content remains in its original language.

Expect Chinese to still appear in English pages from:

- Prayer card titles and descriptions.
- Prayer responses.
- Category names stored in the database.
- Location values stored by users.
- Some long-form informational page body content.

This is intentional for the current phase. Do not auto-translate user-generated prayer content without a separate privacy, moderation, and user-consent review.

### 3. Category Localization Is Not Yet A Data-Layer Feature

Category labels may still be Chinese on `/en` pages because category names come from existing data. A proper fix should add category translation fields or a stable category-key mapping, not hard-code ad hoc replacements in individual components.

### 4. Customer Portal And Admin Are Not Fully English

The English public surface is the priority. Member/admin flows are not fully localized yet.

Current conservative behavior:

- `/en/customer-portal` redirects to the existing customer portal.
- `/en/customer-portal/create` redirects to the existing create flow.

This avoids creating a half-translated authenticated product area that may confuse users.

### 5. Global Prayer Room Needs Real Environment QA

The Global Prayer Room uses browser rendering, external map/globe assets, audio playback, and live data.

Before release, test in a production-like environment:

- Cesium/globe loading.
- External tile access.
- Voice playback queue.
- Drawer/modal behavior on iOS Safari and Android Chrome.
- Private card map lights with real private records.
- Slow network loading and error states.

### 6. Media Upload And Voice Flow Still Need Storage QA

The UI copy now handles media-related failures more clearly, but real storage still needs environment testing:

- Media storage configured.
- Media storage missing.
- Large voice file rejected.
- Upload failure.
- Playback of original card voice and response voice.
- Companion comments loading under the correct `homeCardId`.

### 7. Private Card Safety Must Stay API-Level

Do not rely only on frontend hiding. Any future i18n, SEO, sitemap, or map work must keep private filtering and sanitization in server helpers/API routes.

Public detailed card flows should only expose cards where:

```text
isBlocked: false
isPrivate: false
```

The Global Prayer Room may receive private records only after server-side sanitization into anonymous approximate lights.

### 8. Search UX In English Is Partial

English quick tags search against existing Chinese/user-generated content. English search can still be sparse until category/data localization is designed.

This is acceptable for the first i18n layer, but should be called out before presenting English as complete.

### 9. Legacy And Old Narrative Routes Must Stay Contained

Do not reintroduce old brand naming or financial asset language in public UI or new docs.

Legacy/old-risk pages should remain noindex/nofollow or blocked through robots/metadata where applicable.

### 10. Review Dirty Worktree Before Commit

There are many modified files in the current worktree from today's broader work. Before committing, review the final diff carefully and group commits by concern if possible:

- Admin hint/admin route work.
- Public UAT/UI fixes.
- Privacy/API hardening.
- Response and audio flow fixes.
- SEO/brand/docs cleanup.
- English i18n infrastructure and routes.

This will make rollback and review much safer than one large mixed commit.

## Recommended Pre-Merge Checklist

Run:

```bash
npm run i18n:check
npm run lint
npm run build
```

Manually check:

- `/`
- `/prayfor`
- `/prayfor/[id]`
- `/global-prayer-room`
- `/login`
- `/signup`
- `/en`
- `/en/prayfor`
- `/en/prayfor/[id]`
- `/en/global-prayer-room`
- `/en/login`
- `/en/signup`

Use at least:

- `390x844`
- `768x1024`
- `1440x900`

Also verify:

- Private cards do not appear in public detail pages or public card APIs.
- Private map lights do not leak detail fields.
- Voice playback queue points to the correct `homeCardId`.
- Logged-out users are guided to login before responding.
- Cooldown messaging still matches backend behavior.
- Footer/nav language switch links point to the expected route.
