# PRD-010 Start Pray Prayer-First Product Redesign

- Priority: P0
- Status: Draft
- Owner: Product / Design / Engineering
- Last updated: 2026-07-08
- Product principle: Less is More, Emotion First, Prayer First, Speed First, Anonymous by Default, Zero Learning Cost

---

## 0. Review Of The Original Redesign Prompt

The original prompt is strong because it asks the AI to think beyond visual redesign and cover product vision, user journey, IA, flows, interaction, motion, accessibility, conversion, and emotional design.

The main gaps:

1. It asks for "everything" but does not define the single product bet.
2. It asks for many screens but does not rank what must ship first.
3. It mentions anonymous, safe, and fast, but does not turn those values into measurable acceptance criteria.
4. It asks for wireframes but does not separate MVP, V2, and V3.
5. It does not explicitly protect private prayer cards from leaking title, description, image, owner, or details links.
6. It treats the world map as a major page before deciding its job in the habit loop.
7. It does not define moderation, abuse, consent, voice permission, offline, or too-short/too-long voice states as product requirements.
8. It does not define what to delete if the product becomes too complicated.

The improved direction should be:

> Start Pray is not a content site. It is a 30-second anonymous prayer ritual. Every screen should either help someone ask for prayer, pray for one person, or feel that their prayer joined something larger.

---

## 1. Product Vision

Start Pray is a global anonymous prayer platform where anyone can begin praying in 3 seconds and complete a blessing in 30 seconds.

It is not:

- a forum
- a social network
- a chat room
- a church website
- a content marketing site

It is:

- a safe place to anonymously share a need
- a fast way to bless one real person
- a daily 30-second prayer ritual
- a quiet global signal that people are being remembered

### Product Promise

"In 30 seconds, you can leave a real blessing for someone who needs it."

### North Star

Daily completed prayer responses.

This is more important than page views, account creation, or time on site.

### Core Product Bet

If Start Pray makes the first prayer response feel simple, safe, and emotionally meaningful, users will return daily without needing heavy social features.

---

## 2. Current Product Review

Observed from the current public homepage and repository structure:

- The site already communicates warmth and has the right domain direction.
- The homepage includes global prayer room, recent prayer, stats, categories, trust notes, and footer links.
- Main routes already exist for home, prayer wall, prayer detail, global prayer room, overcomer, customer portal, and admin.
- The current domain model is centered on `HomePrayerCard`, which should remain the main public prayer unit.
- The current site exposes multiple possible actions in the first experience, but the "pray for one person now" path is not dominant enough.
- The global map is visually important but currently competes with the first prayer action.
- Account creation is present, but anonymous participation should remain the default first-time path.
- Some existing documentation and roadmap files have encoding damage; this PRD should remain readable and self-contained.

### Product Diagnosis

The product is already spiritually and emotionally aligned, but the experience is still closer to "browse a prayer platform" than "complete one prayer in 30 seconds."

The redesign should not make the site look more expensive. It should make the first action obvious, safe, and immediate.

---

## 3. Problems

### P0 Problems

1. First-time users may not know the fastest next action within 10 seconds.
2. The home page offers several meaningful sections, but the primary ritual is diluted.
3. Prayer response flow is not yet designed as the product's emotional center.
4. Voice prayer is not specified as a complete interaction system.
5. Subtitle-synced playback is not defined as a first-class experience.
6. The map's purpose is unclear: discovery, proof of impact, or completion reward.
7. Anonymous/private safety rules are not visible enough in the UX.
8. Empty/loading/error states are not specified.
9. Habit loop is not explicit.

### P1 Problems

1. Returning users need a daily "one prayer" path, not just more browsing.
2. Categories and search are useful but can increase cognitive load if surfaced too early.
3. The "share need" flow may feel heavier than the "pray for someone" flow.
4. Success states can do more emotional work after completion.
5. The product needs a consistent design system before large UI changes.

---

## 4. Solutions

### Product Strategy

Make Start Pray revolve around three primary actions:

1. Pray for one person.
2. Share one need.
3. See the world being prayed for.

Everything else should support these actions.

### UX Strategy

- First screen: one primary CTA, "我願意禱告".
- First action: show one prayer card immediately.
- First response: text or voice, anonymous by default.
- First success: prayer joins the world map.
- Returning ritual: "今天為一個人禱告".

### IA Strategy

Move from content-first IA to action-first IA:

- Home: start the ritual.
- Pray: one-card prayer flow and prayer wall.
- Share: create anonymous prayer need.
- Listen: playback with synced subtitles.
- World: impact and global prayer room.
- Stories: overcomer testimonies.
- Help/Trust: privacy, moderation, terms.

### Interaction Strategy

The product should feel quiet, direct, and emotionally safe:

- no noisy gamification
- no follower counts
- no comments as social debate
- no public identity pressure
- no forced login before first prayer

---

## 5. Goals And Non-Goals

### Goals

1. A first-time user understands the product within 10 seconds.
2. A first-time user can complete a prayer response within 30 seconds.
3. Anonymous use is the default.
4. Voice prayer feels central, calm, and trustworthy.
5. Playback page supports synchronized subtitle highlighting.
6. World map becomes emotional proof and completion reward, not just a feature.
7. Private prayer data never leaks on public pages.
8. Mobile experience is the primary design target.
9. Produce a new product wireframe that can be reviewed before any frontend implementation.
10. Separate design exploration from production rollout.

### Non-Goals

1. Do not build a social network.
2. Do not add feeds, follows, DMs, or public profile competition.
3. Do not force login for first prayer.
4. Do not make the homepage a generic SaaS landing page.
5. Do not reintroduce old project names or financial asset narratives.
6. Do not rebuild the app with a new UI framework.
7. Do not change the current production homepage frontend as part of this wireframe prompt.
8. Do not treat the AI wireframe output as final implementation without product, privacy, and engineering review.

---

## 5.1 Design Exploration Boundary

This PRD has two separate tracks:

### Track A: Wireframe Generation

Goal:

- Use the prompt to generate a completely new V3 product wireframe.
- Challenge the current layout, IA, and flows.
- Produce ASCII wireframes and detailed interaction specs.
- Keep the output implementation-aware, but not production code.

Allowed:

- New IA proposals.
- New screen hierarchy.
- New CTA strategy.
- New recording and playback flow.
- New world map purpose.
- New design system direction.
- New mobile/tablet/desktop wireframes.
- V1/V2/V3 rollout proposal.

Not allowed:

- Editing `src/app/page.js`.
- Editing current homepage CSS.
- Shipping homepage visual changes directly.
- Changing Prisma schema.
- Changing API behavior.
- Changing public/private data behavior.

### Track B: Production Implementation

Goal:

- Convert the selected wireframe into small, testable engineering milestones.
- Preserve existing public/customer/admin route boundaries.
- Protect private prayer cards and anonymous defaults.
- Release behind flags or alternate routes before touching the production homepage.

Implementation rule:

> No production homepage redesign should happen until the V3 wireframe is reviewed, narrowed into V1 scope, and translated into implementation tickets with acceptance criteria.

### Recommended Preview Route

When implementation begins, build a separate preview first:

```text
/v3-wireframe
/v3-wireframe/pray
/v3-wireframe/share
/v3-wireframe/playback
/v3-wireframe/world
```

This lets the team test the new experience without disturbing the current homepage.

Only after review should any part move into:

```text
/
/prayfor
/prayfor/[id]
/global-prayer-room
```

---

## 6. Success Metrics

### Activation

- 70% of first-time mobile users can identify the primary action within 10 seconds in user testing.
- 40% of first-time users who tap "我願意禱告" complete a text or voice prayer.
- Median time from landing to prayer submission under 45 seconds.

### Engagement

- Daily completed prayer responses.
- Returning users who complete at least one prayer per day.
- Completion rate of voice recording flow.
- Playback completion rate for received voice prayers.

### Safety

- 0 known leaks of private card title, description, image, owner, or details link on public surfaces.
- Report rate and moderation queue time remain measurable.
- Permission denied and upload failures have clear recovery paths.

### Quality

- Mobile Lighthouse accessibility score target: 90+.
- No primary flow requires reading instructions.
- `npm run lint` and `npm run build` pass before release.

---

## 7. Core Audience

### First-Time Visitor

Needs:

- understand quickly
- not feel judged
- not create an account
- either receive prayer or bless someone

Fear:

- "Will my story be exposed?"
- "Do I need to know how to pray?"
- "Will this feel awkward?"

Design response:

- anonymous by default
- one clear action
- short prompts
- no public identity pressure

### Person In Need

Needs:

- share a burden safely
- decide what stays private
- receive words or voice blessings later

Fear:

- exposure
- being ignored
- writing too much

Design response:

- low-friction form
- privacy preview
- gentle empty state
- notifications later if implemented

### Daily Prayer User

Needs:

- one person to pray for today
- fast ritual
- emotional closure

Fear:

- too many choices
- repetitive content
- feeling like a task list

Design response:

- daily card
- 30-second flow
- no streak pressure in MVP
- quiet completion animation

### Returning Person Who Shared A Need

Needs:

- see responses
- listen to voice prayers
- feel remembered

Fear:

- public exposure
- harsh or unsafe comments

Design response:

- moderated responses
- synced transcript playback
- private-safe details

---

## 8. Habit Loop

### Trigger

- Internal: "I have 30 seconds and want to bless someone."
- External: optional daily reminder in V2.
- Contextual: completion page invites "明天再為一個人禱告".

### Action

User opens Start Pray and taps "我願意禱告".

### Variable Reward

The user receives one real prayer need:

- different country/city
- different topic
- short human story
- sometimes voice, sometimes text

### Investment

User leaves a short text or voice prayer.

### Emotional Closure

The prayer joins a world map light point and the user sees:

"你的祝福已經留下。今天，有一個人被記念。"

### Return Hook

The product invites:

"明天，再為一個人禱告 30 秒。"

No streak is shown in MVP. If a streak is added later, it must be private and gentle.

---

## 9. If We Must Delete 50 Percent Of Features

Keep:

1. Pray for one person.
2. Share a prayer need.
3. Listen/read received prayers.

Remove or hide:

- broad homepage sections
- complex stats
- large category browsing
- heavy account flows before first action
- non-essential marketing pages
- map as primary browsing UI
- advanced search before enough content exists

### If Only Three Main Features Remain

1. Start Prayer: one-card prayer response flow.
2. Share Need: anonymous prayer request creation.
3. My Prayer / Playback: receive and replay text or voice blessings.

---

## 10. Complete IA

### Top-Level Navigation

Mobile bottom nav:

- Today
- Pray
- Share
- World
- Me

Desktop nav:

- Start Pray
- Pray
- Share
- World
- Stories
- Me

### Primary IA

```text
Start Pray
├─ Home / Today
│  ├─ Daily prayer entry
│  ├─ One featured need
│  ├─ How it works
│  └─ World proof preview
├─ Pray
│  ├─ One prayer flow
│  ├─ Prayer wall
│  ├─ Category filter
│  └─ Search
├─ Share
│  ├─ Anonymous prayer need form
│  ├─ Privacy controls
│  ├─ Image upload
│  └─ Optional voice need upload
├─ Prayer Detail / Playback
│  ├─ Need summary
│  ├─ Text responses
│  ├─ Voice responses
│  ├─ Synced subtitles
│  └─ Respond / next prayer
├─ World
│  ├─ Global prayer room
│  ├─ Recent anonymous lights
│  └─ Completion impact view
├─ Stories
│  ├─ Overcomer list
│  └─ Story detail
├─ Me
│  ├─ Login / signup
│  ├─ My prayer cards
│  ├─ My responses
│  └─ Account settings
└─ Trust
   ├─ How it works
   ├─ Privacy
   ├─ Terms
   └─ Report / contact
```

---

## 11. Complete Sitemap

```text
/
/pray
/pray?mode=one
/pray?category=health
/pray?search=<query>
/share
/prayfor
/prayfor/[id]
/global-prayer-room
/overcomer
/overcomer/[slug]
/howto
/about
/terms
/login
/signup
/customer-portal
/customer-portal/create
/customer-portal/edit/[id]
/admin
```

Routing note:

- Existing `/prayfor` can remain as the prayer wall route.
- A new `/pray` route can be introduced later as a ritual-first alias.
- Existing `/customer-portal/create` can remain the authenticated create path.
- Public anonymous create can either be `/share` or use `/customer-portal/create` with a public mode only if the current auth model supports it safely.

---

## 12. Complete User Journey

### Journey A: First-Time User Prays For Someone

1. Lands on home.
2. Sees one clear message: "30 秒，為一個人留下祝福。"
3. Taps "我願意禱告".
4. Receives one prayer card.
5. Chooses text or voice.
6. Writes or records a short prayer.
7. Confirms anonymous name.
8. Submits.
9. Sees success animation.
10. Prayer light joins world map.
11. Sees optional "再為一人禱告" secondary action.

### Journey B: First-Time User Shares A Need

1. Lands on home.
2. Taps "我需要代禱".
3. Sees short form.
4. Anonymous is on by default.
5. Adds title and optional detail.
6. Chooses public or private.
7. Optional category, location, photo, voice.
8. Reviews privacy preview.
9. Submits.
10. Sees "你的需要已被接住".
11. Optional account creation to manage later.

### Journey C: Returning Daily User

1. Opens site.
2. Home says "今天，為一個人禱告 30 秒".
3. Taps "開始今天的禱告".
4. Receives a prayer need not recently shown.
5. Leaves text or voice prayer.
6. Sees completion.
7. Can stop without feeling unfinished.

### Journey D: Person Returns To Listen

1. Opens link or customer portal.
2. Sees own prayer card.
3. Opens responses.
4. Plays voice response.
5. Subtitle highlights line by line.
6. Can report unsafe response.
7. Can save/share link if public.

---

## 13. Complete User Flow

### Main Prayer Flow

```text
Home
  ↓ tap "我願意禱告"
Load one eligible HomePrayerCard
  ↓
Prayer Preview
  ↓ choose response type
Text Prayer OR Voice Prayer
  ↓
Confirm anonymous display
  ↓
Submit
  ↓
Moderation / pending state if needed
  ↓
Success
  ↓
World light update
  ↓
Optional: next prayer / share Start Pray
```

### Share Need Flow

```text
Home
  ↓ tap "我需要代禱"
Share Need Form
  ↓
Title
  ↓
Detail
  ↓
Privacy: Public / Private
  ↓
Anonymous default
  ↓
Category
  ↓
Optional location
  ↓
Optional image / voice
  ↓
Privacy preview
  ↓
Submit
  ↓
Success
  ↓
Optional account creation to manage card
```

### Voice Prayer Flow

```text
Prayer Card
  ↓ tap "語音禱告"
Microphone permission
  ↓ allowed
3-second countdown
  ↓
Breathing animation
  ↓
Recording starts
  ↓
Waveform + live transcript + remaining time
  ↓ tap finish or auto-stop
Processing
  ↓
AI speech-to-text
  ↓
User reviews transcript
  ↓
Submit
  ↓
Success animation
```

### Playback Flow

```text
Prayer Detail
  ↓ tap voice response
Player expands
  ↓
Waveform starts
  ↓
Subtitle lines sync to current audio time
  ↓
User can pause / seek / speed
  ↓
End state
  ↓
CTA: Leave a prayer / Next prayer
```

---

## 14. Complete Interaction Flow

### Button States

- Default: calm solid primary.
- Hover desktop: slight lift, darker border, no bounce.
- Pressed: 96% scale for 100ms.
- Loading: label replaced with spinner and verb, e.g. "送出中".
- Disabled: visible but muted, with accessible reason if form is incomplete.

### Recording States

- Idle: "準備好了，就按下開始".
- Permission requesting: system permission prompt with fallback explanation.
- Countdown: 3, 2, 1 with slow breathing ring.
- Recording: waveform, timer, live transcript.
- Too short: "再多說一句祝福就可以送出".
- Too long: auto-stop and save recording before asking user to trim or submit.
- Processing: "正在整理成字幕".
- Confirm: transcript editable.
- Uploading: progress indicator.
- Success: soft light animation.

### Subtitle States

- Not generated: "正在產生字幕".
- Generated: lines grouped by sentence.
- Active line: highlighted with strong contrast and gentle scroll.
- Past lines: readable but softened.
- Error: "字幕暫時無法產生，你仍可播放語音".

### Loading States

- Home loading: skeleton for one prayer card, not full-page spinner.
- Prayer card loading: one centered card placeholder.
- Map loading: "正在整理全球光點" with static fallback.
- Playback loading: waveform skeleton.

### Error States

- Network error: "連線不穩，剛才的內容還在這裡。請再試一次。"
- Permission denied: "你可以改用文字禱告，或到瀏覽器設定開啟麥克風。"
- GPS denied: "沒關係，我們只會使用大致位置；你也可以略過。"
- Upload failed: keep local draft and retry.
- Moderation pending: "你的禱告已送出，正在等待確認後顯示。"
- Private card unavailable: never show hidden details; show safe anonymous placeholder.

### Empty States

- No prayers yet: invite first prayer need.
- No category results: offer "看一份需要代禱的卡片".
- No responses yet on user's card: "還沒有人回應，但你的需要已經被放在禱告牆上。"
- No voice responses: show text response CTA.
- No map points: show "第一個光點可以從你開始".

### Offline State

- Text response can be drafted locally.
- Voice recording should warn before recording if upload cannot proceed.
- Existing loaded content remains visible.
- Submit button says "重新連線後送出".

---

## 15. Every Screen Wireframe

Wireframes are mobile-first. Tablet and desktop should expand the same hierarchy without adding competing primary CTAs.

### 15.1 Home / Today

Primary CTA: 我願意禱告

```text
+----------------------------------+
| Start Pray                 EN  ☰ |
+----------------------------------+
|                                  |
|  30 秒，為一個人留下祝福。       |
|  匿名、安靜、不需要先登入。       |
|                                  |
|  [ 我願意禱告 ]                  |
|    我需要代禱                    |
|                                  |
|----------------------------------|
| 今天正在被守望                  |
| +------------------------------+ |
| | 為一位正在治療中的弟兄禱告   | |
| | 健康 · 匿名 · 需要一句祝福   | |
| | [ 為他禱告 ]                 | |
| +------------------------------+ |
|----------------------------------|
| 世界正在一起禱告                |
|     (small globe / light map)    |
|  33 代禱 · 11 光點 · 49 語音     |
|----------------------------------|
| 三步開始                        |
|  1 看見一份需要                 |
|  2 留下文字或語音               |
|  3 祝福加入世界光點             |
+----------------------------------+
| Today | Pray | Share | World | Me|
+----------------------------------+
```

### 15.2 One Prayer Start

Primary CTA: 開始禱告

```text
+----------------------------------+
| ← Start Pray                     |
+----------------------------------+
|                                  |
|  今天，先為這一個人禱告。        |
|                                  |
| +------------------------------+ |
| | 匿名 · 健康                  | |
| | 為張弟兄的治療過程禱告       | |
| |                              | |
| | 他正在面對一段辛苦的療程...  | |
| |                              | |
| | [ 開始禱告 ]                 | |
| +------------------------------+ |
|                                  |
|  換一份需要                      |
+----------------------------------+
```

### 15.3 Prayer Response Choice

Primary CTA: 語音禱告

```text
+----------------------------------+
| ← 為這份需要禱告                 |
+----------------------------------+
| 為張弟兄的治療過程禱告           |
|                                  |
| 你可以留下一句很短的祝福。       |
|                                  |
| [ 🎙 語音禱告 ]                  |
|   文字禱告                       |
|                                  |
| 匿名顯示  [ ON ]                 |
| 顯示名稱：匿名                   |
|                                  |
+----------------------------------+
```

### 15.4 Text Prayer

Primary CTA: 送出祝福

```text
+----------------------------------+
| ← 文字禱告                       |
+----------------------------------+
| 為張弟兄                         |
|                                  |
| +------------------------------+ |
| | 願主賜你平安，也加添力量...  | |
| |                              | |
| +------------------------------+ |
|                                  |
| 匿名顯示 [ ON ]                  |
|                                  |
| [ 送出祝福 ]                     |
+----------------------------------+
```

### 15.5 Voice Permission

Primary CTA: 開啟麥克風

```text
+----------------------------------+
| ← 語音禱告                       |
+----------------------------------+
|                                  |
|  用你的聲音，留下 30 秒祝福。    |
|                                  |
|  我們只會儲存這次禱告，          |
|  不會公開你的身份。              |
|                                  |
| [ 開啟麥克風 ]                   |
|   改用文字禱告                   |
+----------------------------------+
```

### 15.6 Voice Countdown

Primary CTA: none, system-controlled

```text
+----------------------------------+
| ← 準備錄音                       |
+----------------------------------+
|                                  |
|             3                    |
|        (breathing ring)          |
|                                  |
|        深呼吸，慢慢說。          |
|                                  |
|  你可以說：「願你今天有平安。」  |
+----------------------------------+
```

### 15.7 Voice Recording

Primary CTA: 完成

```text
+----------------------------------+
| ← 正在錄音                  0:21 |
+----------------------------------+
|                                  |
|       ~~~ waveform ~~~           |
|                                  |
|  願主賜你力量，陪你走過...       |
|  這一段治療的路。                |
|                                  |
|  剩餘 39 秒                      |
|                                  |
| [ 完成 ]                         |
|   重新錄                         |
+----------------------------------+
```

### 15.8 Voice Processing

Primary CTA: none

```text
+----------------------------------+
| 語音禱告                         |
+----------------------------------+
|                                  |
|       正在整理成字幕             |
|       ● ● ●                      |
|                                  |
|  你的錄音已保留，請不要關閉。    |
+----------------------------------+
```

### 15.9 Confirm Transcript

Primary CTA: 送出語音祝福

```text
+----------------------------------+
| ← 確認字幕                       |
+----------------------------------+
|  語音 0:29        [播放]         |
|                                  |
| +------------------------------+ |
| | 願主賜你力量，陪你走過這段... | |
| |                              | |
| +------------------------------+ |
|                                  |
| 字幕可以修改，不會改變原語音。   |
|                                  |
| [ 送出語音祝福 ]                 |
+----------------------------------+
```

### 15.10 Success After Prayer

Primary CTA: 再為一人禱告

```text
+----------------------------------+
|                                  |
|            ✦                     |
|                                  |
|  你的祝福已經留下。              |
|                                  |
|  今天，有一個人被記念。          |
|                                  |
|      (light joins small globe)   |
|                                  |
| [ 再為一人禱告 ]                 |
|   分享 Start Pray                |
+----------------------------------+
```

### 15.11 Share Prayer Need

Primary CTA: 送出代禱

```text
+----------------------------------+
| ← 分享代禱                       |
+----------------------------------+
|  把此刻最需要被祝福的事寫下來。  |
|                                  |
| 標題                             |
| [______________________________] |
|                                  |
| 內容                             |
| [______________________________] |
| [______________________________] |
|                                  |
| 匿名分享 [ ON ]                  |
| 私密代禱 [ OFF ]                 |
| 分類 [ 健康 ▾ ]                  |
| 大致位置 [ 可略過 ]              |
| 圖片 [ + ]  語音 [ + ]           |
|                                  |
| [ 送出代禱 ]                     |
+----------------------------------+
```

### 15.12 Share Privacy Preview

Primary CTA: 確認送出

```text
+----------------------------------+
| ← 送出前確認                     |
+----------------------------------+
| 公開後會顯示：                   |
|  標題、分類、匿名名稱、大致位置  |
|                                  |
| 不會顯示：                       |
|  真實身份、精確位置、登入資料    |
|                                  |
| 私密代禱開啟時，公開頁只顯示     |
| 匿名光點，不顯示內容。           |
|                                  |
| [ 確認送出 ]                     |
+----------------------------------+
```

### 15.13 Prayer Wall

Primary CTA: 為一人禱告

```text
+----------------------------------+
| Start Pray                 🔍    |
+----------------------------------+
| [ 為一人禱告 ]                   |
|                                  |
| 分類                             |
| [全部] [健康] [家庭] [工作]      |
|                                  |
| 搜尋                             |
| [ 搜尋代禱主題              ]    |
|                                  |
| +------------------------------+ |
| | 匿名 · 健康 · 0 則祝福       | |
| | 為正在治療中的弟兄禱告       | |
| | [ 為他禱告 ]                 | |
| +------------------------------+ |
| +------------------------------+ |
| | 家庭 · 3 則祝福              | |
| | 為家人的關係恢復禱告         | |
| | [ 查看 ]                     | |
| +------------------------------+ |
+----------------------------------+
```

### 15.14 Prayer Detail / Playback

Primary CTA: 留下祝福

```text
+----------------------------------+
| ← 代禱卡                         |
+----------------------------------+
| 匿名 · 健康 · 大致位置           |
|                                  |
| 為正在治療中的弟兄禱告           |
| 他正在面對一段辛苦的療程...      |
|                                  |
| [ 留下祝福 ]                     |
|                                  |
|----------------------------------|
| 語音祝福                         |
| +------------------------------+ |
| | 匿名  0:32          1x  ⋯    | |
| | ~~~~~ waveform ~~~~~~~~~     | |
| |                              | |
| | 願主賜你力量                 | |
| | 陪你走過這段治療             | |
| | 你不是一個人                 | |
| +------------------------------+ |
|                                  |
| 文字祝福                         |
| - 願你今天有平安...              |
+----------------------------------+
```

### 15.15 Full Playback Lyrics Mode

Primary CTA: 下一篇代禱

```text
+----------------------------------+
| ↓ 語音祝福                 1x ⋯  |
+----------------------------------+
|                                  |
|        ~~~~ waveform ~~~~        |
|                                  |
|    願主賜你力量                  |
| >  陪你走過這段治療              |
|    你不是一個人                  |
|    今天也被記念                  |
|                                  |
|  0:18 ━━━━━━━────── 0:32         |
|                                  |
| [ 暫停 ]                         |
| [ 下一篇代禱 ]                   |
+----------------------------------+
```

### 15.16 World Map / Global Prayer Room

Primary CTA: 為一人禱告

```text
+----------------------------------+
| ← 世界正在一起禱告               |
+----------------------------------+
|                                  |
|       (interactive globe)         |
|       lights, no private details  |
|                                  |
| 今天新增 12 個祝福光點           |
|                                  |
| +------------------------------+ |
| | 台灣 · 健康                  | |
| | 一份匿名代禱正在被守望       | |
| +------------------------------+ |
|                                  |
| [ 為一人禱告 ]                   |
+----------------------------------+
```

Map principle:

- Home: map is proof, not primary interaction.
- Success page: map is emotional reward.
- World page: map is a calm ambient room.
- Private cards: show only anonymous approximate light point, never details.

### 15.17 Popular Prayers

Primary CTA: 為一人禱告

```text
+----------------------------------+
| 熱門代禱                         |
+----------------------------------+
| [ 為一人禱告 ]                   |
|                                  |
| 這些需要正在被許多人守望。       |
|                                  |
| 1 為治療中的弟兄禱告      25 則  |
| 2 為家庭關係恢復禱告      18 則  |
| 3 為工作焦慮禱告          12 則  |
+----------------------------------+
```

### 15.18 Stories / Overcomer

Primary CTA: 閱讀見證

```text
+----------------------------------+
| 得勝見證                         |
+----------------------------------+
| 被守望之後，有人慢慢站起來。     |
|                                  |
| +------------------------------+ |
| | 見證標題                     | |
| | 一段真實但不過度曝光的摘要   | |
| | [ 閱讀見證 ]                 | |
| +------------------------------+ |
+----------------------------------+
```

### 15.19 Search

Primary CTA: 看一份需要

```text
+----------------------------------+
| 搜尋代禱                         |
+----------------------------------+
| [ 癌症、工作、家庭...        ]   |
|                                  |
| 熱門分類                         |
| [健康] [家庭] [工作] [個人]      |
|                                  |
| 找不到時：                       |
| 也可以先為一份需要禱告。         |
|                                  |
| [ 看一份需要 ]                   |
+----------------------------------+
```

### 15.20 Footer

Primary CTA: none

```text
+----------------------------------+
| Start Pray                       |
| 在這裡，你可以安心寫下需要，     |
| 也可以為別人留下一句代禱。       |
|                                  |
| 參與                             |
|  禱告牆 / 分享代禱 / 全球禱告室  |
|                                  |
| 安心使用                         |
|  使用方式 / 隱私與條款 / 檢舉    |
|                                  |
| © 2026 Start Pray                |
+----------------------------------+
```

---

## 16. Every CTA

Rule: each page has one primary CTA.

| Screen             | Primary CTA  | Secondary CTA         |
| ------------------ | ------------ | --------------------- |
| Home               | 我願意禱告   | 我需要代禱            |
| One Prayer Start   | 開始禱告     | 換一份需要            |
| Response Choice    | 語音禱告     | 文字禱告              |
| Text Prayer        | 送出祝福     | 取消                  |
| Voice Permission   | 開啟麥克風   | 改用文字禱告          |
| Recording          | 完成         | 重新錄                |
| Confirm Transcript | 送出語音祝福 | 重新錄                |
| Success            | 再為一人禱告 | 分享 Start Pray       |
| Share Need         | 送出代禱     | 儲存草稿 if logged in |
| Prayer Wall        | 為一人禱告   | 搜尋 / 分類           |
| Prayer Detail      | 留下祝福     | 分享                  |
| Playback Lyrics    | 下一篇代禱   | 回到代禱卡            |
| World              | 為一人禱告   | 查看光點              |
| Stories            | 閱讀見證     | 分享                  |
| Search             | 看一份需要   | 清除搜尋              |
| Login              | 登入         | 先匿名使用            |

---

## 17. Every Animation

Animations should be soft, short, and optional under `prefers-reduced-motion`.

### Motion Tokens

- Fast: 120ms
- Normal: 180ms
- Slow: 320ms
- Breathing: 3000ms loop

### Required Motion

1. Button press: 96% scale, 100ms.
2. Screen transition: fade + 8px upward movement, 180ms.
3. Countdown: number scale from 110% to 100%, 500ms.
4. Breathing ring: slow opacity and scale loop.
5. Recording waveform: audio-reactive if available, fallback ambient wave.
6. Live subtitle: line appears with fade, 120ms.
7. Active playback lyric: highlight and scroll to center, 180ms.
8. Success light: one small light expands and joins globe, 600ms.
9. Error: no shaking; show calm inline message.
10. Loading skeleton: subtle shimmer, disabled under reduced motion.

### Avoid

- confetti
- aggressive gamification
- dramatic religious spectacle
- animations that delay prayer submission

---

## 18. Design System Suggestion

### Principles

- Quiet, human, readable.
- Mobile first.
- High contrast.
- Few components, deeply polished.
- No decorative UI that competes with prayer.

### Components

- AppShell
- Header
- MobileBottomNav
- PrimaryButton
- SecondaryButton
- PrayerCard
- PrayerDetailHeader
- ResponseComposer
- VoiceRecorder
- TranscriptEditor
- VoicePlayer
- SyncedSubtitle
- PrivacyToggle
- CategoryPicker
- LocationApproxPicker
- ImageUploader
- WorldLightMap
- EmptyState
- LoadingSkeleton
- Toast
- ReportAction

### Tokens

```text
radius-sm: 6px
radius-md: 8px
radius-lg: 12px only for large media/map surfaces
space-1: 4px
space-2: 8px
space-3: 12px
space-4: 16px
space-5: 24px
space-6: 32px
space-7: 48px
```

Use 8px card radius unless an existing component pattern requires otherwise.

---

## 19. Typography

### Font Direction

Use the current project font stack unless a dedicated type decision is made. Prioritize Traditional Chinese readability.

### Scale

```text
Display: 32/40 mobile, 44/52 desktop
H1: 28/36 mobile, 36/44 desktop
H2: 22/30
H3: 18/26
Body: 16/26
Small: 14/22
Caption: 12/18
```

Rules:

- No negative letter spacing.
- Do not scale font size with viewport width.
- Buttons must fit their text on 320px width.
- Long user-generated text needs wrapping, line clamp only with a clear expansion path.

---

## 20. Color System

The product should avoid a one-note palette. Use warm neutrals with restrained spiritual depth and clear action colors.

### Suggested Tokens

```text
surface: #FFFDF8
surface-muted: #F5F1E8
surface-elevated: #FFFFFF
text: #1F2933
text-muted: #667085
border: #DDD6C8
primary: #2F6F73
primary-hover: #265B5F
primary-text: #FFFFFF
accent: #D99A4E
success: #2F7D5C
warning: #B7791F
danger: #B42318
focus: #2563EB
map-dark: #102A2C
map-light: #F5C46B
```

Accessibility:

- Primary text contrast 4.5:1 minimum.
- Button text contrast 4.5:1 minimum.
- Focus ring must be visible on all backgrounds.

---

## 21. Accessibility

### Required

1. All primary flows work with keyboard.
2. All buttons have accessible names.
3. Voice recorder has visible state text, not only waveform.
4. Countdown is announced politely or can be skipped.
5. Captions/transcripts are available for voice playback.
6. Color is never the only state indicator.
7. Reduced motion mode disables non-essential animation.
8. Map has list fallback.
9. Forms show inline errors with `aria-describedby`.
10. Minimum touch target: 44px.

### Sensitive Content

- Avoid forcing users to read intense stories without context.
- Provide report controls near user-generated content.
- Do not autoplay voice.

---

## 22. Mobile Version

Mobile is the primary product.

### Mobile Requirements

- First viewport shows promise and primary CTA.
- Bottom nav available after first screen or globally.
- Recording controls reachable by thumb.
- Form fields stacked.
- Prayer cards no wider than viewport minus 32px.
- Map preview not taller than the primary action area on home.
- Playback lyrics mode can use full screen.

### Mobile Viewports To Test

- 320px
- 375px
- 390px
- 430px

---

## 23. Tablet Version

Tablet should feel spacious but not more complex.

### Tablet Layout

- Home: two-column hero, CTA left, prayer preview right.
- Prayer wall: two-column card grid.
- Detail: content and responses can become two columns.
- Recorder remains centered and focused.
- Map can be larger but still secondary unless on World page.

---

## 24. Desktop Version

Desktop should preserve action-first hierarchy.

### Desktop Layout

- Header nav can show main routes.
- Home hero can use a prayer preview and small world proof panel.
- Prayer wall can use filters on the side.
- Detail page can show prayer content left, response/player right.
- Playback lyrics mode should still support a focused full player.

Do not turn desktop into a dashboard.

---

## 25. Data And Privacy Requirements

### Private Prayer Cards

If `HomePrayerCard.isPrivate === true`, public surfaces must not expose:

- title
- description
- image
- owner
- detailsHref
- exact location

Allowed public representation:

- anonymous approximate location light point
- generic category if safe
- generic copy such as "一份私密代禱正在被守望"

### Images

New card images must only accept internal sources:

- `/uploads/...`
- `/api/card-thumbnail?...`

No arbitrary external image URLs should enter new card records.

### Voice

Voice prayer must store:

- audio URL
- duration
- transcript if available
- moderation status
- anonymous display flag

Voice prayer should not reveal user identity unless explicitly allowed.

---

## 26. Functional Requirements

### Home

- Show one primary CTA.
- Show one featured prayer need.
- Show short product explanation.
- Show small world proof.
- Must load quickly on mobile.

### Pray For One

- Fetch one eligible public, non-blocked card.
- Prefer cards with fewer responses or older last response.
- Must not return private card details.
- User can skip to another card.

### Text Prayer

- Minimum content length: 2 meaningful characters or local equivalent.
- Maximum content length: 1000 characters.
- Anonymous default on.
- Submit can enter moderation pending state.

### Voice Prayer

- Browser microphone permission flow.
- Countdown.
- Recording duration target: 10-60 seconds.
- Too short under 3 seconds should not submit.
- Too long should auto-stop at configured max.
- Transcript generated when service is available.
- User can edit transcript before submit.
- Audio should still submit if transcript fails, if moderation rules allow.

### Playback

- Play/pause.
- Seek.
- Speed: 0.75x, 1x, 1.25x, 1.5x.
- Waveform or progress visualization.
- Synced subtitle highlighting.
- Transcript fallback if sync timestamps are unavailable.
- Report action.

### World Map

- Shows aggregate and approximate activity.
- Never leaks private details.
- Provides non-map list fallback.
- On success page, shows user's contribution as a light joining the world.

### Search And Categories

- Search title/category/body only for public content.
- Categories must use `健康`, not reintroduce `醫治` for the same UI category.
- Empty search gives a prayer action fallback.

---

## 27. Technical Scope

### Likely Files

```text
src/app/page.js
src/app/prayfor/page.js
src/app/prayfor/[id]/page.js
src/app/global-prayer-room/page.js
src/app/customer-portal/create/page.js
src/components/site-chrome.js
src/components/HomePrayerExplorer.js
src/components/GlobalPrayerRoom.js
src/components/PrayerAudioPlayer.js
src/components/prayer-detail/VoiceWallPlayer.js
src/lib/homeCards.js
src/lib/globalPrayerPayload.js
src/lib/default-thumbnail.js
src/app/api/home-cards/*
src/app/api/responses/*
src/app/api/customer/*
src/styles/theme-modern.css
src/styles/theme-customer.css
src/styles/prayer-detail.css
src/app/globals.css
```

### New Components To Consider

```text
src/components/prayer-flow/OnePrayerFlow.js
src/components/prayer-flow/PrayerResponseChoice.js
src/components/prayer-flow/VoicePrayerRecorder.js
src/components/prayer-flow/TranscriptReview.js
src/components/prayer-flow/PrayerSuccess.js
src/components/playback/SyncedSubtitlePlayer.js
src/components/world/PrayerLightProof.js
```

---

## 28. Schema Changes

MVP can avoid schema changes if current response models already support text and voice.

Potential V2 schema additions:

```text
PrayerResponse.transcriptJson
PrayerResponse.transcriptStatus
PrayerResponse.audioDurationSeconds
PrayerResponse.moderationStatus
PrayerResponse.locale
PrayerResponse.clientCreatedAt
PrayerResponse.approxLocationLabel
```

For subtitle sync, transcript storage should support timestamped segments:

```json
[
  { "start": 0.0, "end": 2.4, "text": "願主賜你力量" },
  { "start": 2.4, "end": 5.8, "text": "陪你走過這段治療" }
]
```

Do not add schema changes without a Prisma migration.

---

## 29. API Requirements

### Public

```text
GET /api/home-cards?mode=one
GET /api/home-cards?sort=needsPrayer
POST /api/responses
GET /api/responses/[homeCardId]
```

### Customer

```text
POST /api/customer/cards
PATCH /api/customer/cards/[id]
POST /api/customer/story-audio
```

### Voice

If a new voice upload endpoint is needed:

```text
POST /api/responses/voice
```

Required checks:

- login optional depending on response policy
- account usable if logged in
- target card exists and is public/respondable
- rate limit
- content moderation
- accepted audio MIME types
- size and duration limits

---

## 30. Version Plan: V1 / V2 / V3

The redesign should be planned in three versions. The prompt can ask for the full V3 vision, but implementation should start with V1.

### V1: Prayer-First Wireframe And Prototype

Purpose:

- Produce a new wireframe and test whether the "30-second prayer ritual" is clear.
- Do not change the production homepage.
- Build a preview only if implementation begins.

Product scope:

1. New IA proposal.
2. New mobile-first home/today wireframe.
3. One-prayer flow wireframe.
4. Share need flow wireframe.
5. Text prayer flow wireframe.
6. Voice recording flow wireframe.
7. Playback page wireframe.
8. Success page wireframe.
9. World map strategy wireframe.
10. CTA, empty, loading, error, and success states.

Implementation scope if built:

1. Create preview-only route group, such as `/v3-wireframe`.
2. Use mock data or sanitized public `HomePrayerCard` data.
3. Do not write to production response APIs unless explicitly approved.
4. Do not modify existing `/` homepage.
5. Do not modify current public card detail behavior.
6. Do not add schema changes.
7. Keep CSS scoped to the preview route.

Definition of done:

1. The full V3 wireframe can be reviewed by product/design/engineering.
2. The team can identify what belongs in production V1.
3. No production homepage files are changed.
4. Privacy risks are documented before any real data integration.

### V2: Functional Prayer Ritual

Purpose:

- Turn the selected V1 wireframe into a working prayer response experience.
- Still avoid a full homepage redesign unless the new flow has been validated.

Product scope:

1. "Pray for one person" functional flow.
2. Text prayer response.
3. Anonymous by default.
4. Success state.
5. Under-prayed card matching.
6. Prayer detail improvements for received responses.
7. Basic world light proof after completion.

Implementation scope:

1. Add or extend `GET /api/home-cards?mode=one`.
2. Add safe card selection logic in `src/lib/homeCards.js`.
3. Reuse existing response APIs where possible.
4. Add rate limits and moderation checks where missing.
5. Add preview-to-production feature flag.
6. Verify public payloads never include private card details.
7. Add mobile QA for 320px, 375px, 390px, and 430px widths.

Definition of done:

1. User can tap one CTA and submit one text prayer.
2. Median happy-path flow is under 45 seconds in manual testing.
3. Anonymous mode is default.
4. Private card details do not leak in API payloads or UI.
5. `npm run lint` and `npm run build` pass.

### V3: Full Voice, Playback, And Daily Ritual

Purpose:

- Build the complete product vision: voice-first prayer, synced subtitles, daily ritual, and world impact.

Product scope:

1. Voice recording with permission, countdown, waveform, timer, and transcript confirmation.
2. Speech-to-text with timestamped transcript segments.
3. Playback page with line-by-line synchronized subtitle highlighting.
4. Completion animation where a blessing joins the world map.
5. Daily returning-user ritual.
6. Gentle personal prayer history.
7. Language-aware matching.
8. Optional reminder opt-in.
9. More complete admin moderation for voice and transcript.

Implementation scope:

1. Add voice upload pipeline for prayer responses if current APIs are insufficient.
2. Store audio duration and transcript status.
3. Store timestamped transcript JSON if synced subtitles ship.
4. Add admin review states for audio/transcript.
5. Add accessible fallback transcript display.
6. Add non-map fallback for global prayer room.
7. Add analytics events for activation and completion.
8. Add privacy regression tests around private cards.

Definition of done:

1. User can record, review transcript, and submit a voice prayer.
2. Playback highlights the active subtitle line while audio plays.
3. Reduced motion mode disables non-essential motion.
4. Voice and transcript moderation states are visible to admins.
5. The daily ritual can be completed without search, categories, or login.
6. Production rollout is gradual and reversible.

---

## 31. Practical Implementation Plan

This section describes what must be done if the team decides to build the redesign.

### Phase 0: Decision And Scope Lock

Owner: Product

Tasks:

1. Confirm that the immediate goal is wireframe generation, not homepage implementation.
2. Decide whether the generated wireframe should be mobile-only first or mobile/tablet/desktop.
3. Confirm the primary product promise:

   ```text
   30 seconds, pray for one person.
   ```

4. Confirm the one primary CTA on the future home screen:

   ```text
   我願意禱告
   ```

5. Confirm which flows are mandatory in the wireframe:
   - home/today
   - pray for one person
   - share need
   - text prayer
   - voice recording
   - playback with synced subtitles
   - success
   - world map
   - search/categories
   - footer

Deliverable:

- Approved prompt and design scope.

### Phase 1: Generate V3 Wireframe

Owner: Product Design

Tasks:

1. Run the improved prompt from this PRD against the current website.
2. Ask the model to produce a new IA, not a skin over the current homepage.
3. Require ASCII wireframes for every screen.
4. Require mobile, tablet, and desktop versions.
5. Require one primary CTA per screen.
6. Require all loading, empty, error, permission denied, offline, too-short, and too-long states.
7. Require separate V1/V2/V3 rollout.
8. Require explicit privacy handling for private cards.

Deliverable:

- `docs/design/start-pray-v3-wireframe.md`

Acceptance criteria:

1. The wireframe does not depend on the current homepage layout.
2. The first screen can be understood within 10 seconds.
3. The prayer response flow can be completed in 30-45 seconds.
4. Every major screen has one primary CTA.
5. The map has a clear product job.
6. Voice recording is fully specified.
7. Playback synced subtitles are fully specified.

### Phase 2: Product Review And Cutdown

Owner: Product + Engineering + Trust/Safety

Tasks:

1. Review the generated wireframe against Start Pray principles.
2. Delete anything that feels like social networking.
3. Delete anything that increases first-use cognitive load.
4. Split ideas into:
   - must ship
   - should ship later
   - do not build
5. Confirm what V1 production scope actually includes.
6. Identify privacy risks.
7. Identify backend gaps.
8. Identify moderation gaps.

Deliverable:

- `docs/prd/PRD-011-prayer-first-v1-implementation.md`

Acceptance criteria:

1. V1 can be built in small PRs.
2. V1 does not require complete homepage replacement.
3. V1 does not require unsafe schema changes.
4. V1 has measurable activation criteria.

### Phase 3: Technical Design

Owner: Engineering

Tasks:

1. Map wireframe screens to existing routes and components.
2. Decide whether to use preview route group:

   ```text
   /v3-wireframe
   ```

3. Decide which components are new vs reused.
4. Define API changes.
5. Define data payloads.
6. Define feature flags.
7. Define analytics events.
8. Define moderation behavior.
9. Define privacy test cases.

Deliverable:

- Technical design note in `docs/` or inside the implementation PRD.

Acceptance criteria:

1. Engineering knows which files will be touched.
2. Public/customer/admin boundaries remain clear.
3. Private-card data exposure is reviewed before implementation.
4. There is a rollback plan.

### Phase 4: Build Preview

Owner: Engineering

Tasks:

1. Add preview route.
2. Build static or mock-data version of key screens.
3. Build scoped CSS.
4. Verify responsive behavior.
5. Verify accessibility basics.
6. Do not connect write APIs yet unless approved.
7. Review on mobile widths.

Possible files:

```text
src/app/v3-wireframe/page.js
src/app/v3-wireframe/pray/page.js
src/app/v3-wireframe/share/page.js
src/app/v3-wireframe/playback/page.js
src/app/v3-wireframe/world/page.js
src/components/v3-wireframe/*
src/styles/v3-wireframe.css
```

Acceptance criteria:

1. Current homepage remains unchanged.
2. Preview route renders the new experience.
3. Mobile layout works at 320px and 375px.
4. No production data is modified.
5. `npm run lint` passes.

### Phase 5: Connect Real Data Safely

Owner: Engineering

Tasks:

1. Connect public, non-private prayer cards.
2. Add one-prayer card selection.
3. Ensure private cards return anonymous placeholder only.
4. Connect text response submission.
5. Add rate limiting and moderation checks.
6. Add success state.
7. Add report action.
8. Add API payload tests or manual verification.

Acceptance criteria:

1. Public cards render correctly.
2. Private cards do not expose forbidden fields.
3. Text prayer submission works.
4. Anonymous response is default.
5. Error states preserve user input.
6. `npm run lint` and `npm run build` pass.

### Phase 6: Voice And Playback

Owner: Engineering + Product Design

Tasks:

1. Validate current audio storage and upload flow.
2. Define max audio duration and file size.
3. Build microphone permission UI.
4. Build countdown UI.
5. Build waveform recording UI.
6. Build too-short and too-long states.
7. Build transcript review UI.
8. Add transcript fallback if speech-to-text fails.
9. Build playback transcript display.
10. Build synced subtitle highlighting once timestamps exist.

Acceptance criteria:

1. User can recover from microphone permission denial.
2. User can switch to text prayer.
3. Voice upload failure does not lose the user's transcript.
4. Playback never autoplays.
5. Transcript is accessible to screen readers.

### Phase 7: Launch Plan

Owner: Product + Engineering

Tasks:

1. Run internal QA.
2. Run mobile QA.
3. Run privacy QA.
4. Run accessibility QA.
5. Decide rollout order:
   - preview route
   - limited public link
   - route alias
   - homepage CTA integration
   - homepage redesign only if validated
6. Keep rollback path.

Acceptance criteria:

1. Existing homepage can remain live if issues appear.
2. New prayer flow can be disabled independently.
3. No private content leak is found.
4. Metrics are available after launch.

---

## 32. Implementation Checklist

### Product Checklist

- [ ] Confirm one-sentence product promise.
- [ ] Confirm primary CTA wording.
- [ ] Confirm anonymous-by-default policy.
- [ ] Confirm whether anonymous users can submit responses.
- [ ] Confirm whether anonymous users can create prayer cards.
- [ ] Confirm the role of accounts after first action.
- [ ] Confirm whether world map is proof, reward, or discovery.
- [ ] Confirm V1/V2/V3 scope.
- [ ] Confirm what should be deleted from the current experience.

### UX Checklist

- [ ] First screen explains the product in 10 seconds.
- [ ] User can start praying in one tap.
- [ ] User can complete text prayer in under 45 seconds.
- [ ] Voice flow has every state specified.
- [ ] Playback flow has transcript and synced-subtitle behavior specified.
- [ ] Every screen has one primary CTA.
- [ ] Empty states point users back to prayer.
- [ ] Error states preserve user input.
- [ ] Offline states are defined.
- [ ] Permission denied states are defined.

### Privacy Checklist

- [ ] Private card title is never exposed publicly.
- [ ] Private card description is never exposed publicly.
- [ ] Private card image is never exposed publicly.
- [ ] Private card owner is never exposed publicly.
- [ ] Private card details link is never exposed publicly.
- [ ] Exact location is never exposed publicly.
- [ ] Map uses approximate anonymous lights only.
- [ ] New images only use internal sources.
- [ ] Report controls are visible near user-generated content.

### Engineering Checklist

- [ ] Build preview route before changing homepage.
- [ ] Keep CSS scoped to preview or touched screens.
- [ ] Reuse existing helpers.
- [ ] Keep public/customer/admin API boundaries.
- [ ] Add feature flag if production data is connected.
- [ ] Add rate limits where needed.
- [ ] Add moderation checks where needed.
- [ ] Add mobile QA.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build` before production rollout.

### Design System Checklist

- [ ] Define color tokens.
- [ ] Define type scale.
- [ ] Define spacing scale.
- [ ] Define button states.
- [ ] Define form field states.
- [ ] Define card states.
- [ ] Define recorder states.
- [ ] Define player states.
- [ ] Define reduced-motion behavior.
- [ ] Define mobile/tablet/desktop breakpoints.

---

## 33. Acceptance Criteria

### Product

1. First mobile viewport clearly explains Start Pray in one sentence.
2. Home has exactly one primary CTA.
3. User can reach a prayer response composer in one tap from home.
4. User can submit a text prayer without creating an account if policy allows anonymous responses.
5. Voice flow includes permission, countdown, recording, timer, too-short, too-long, processing, transcript confirmation, and success states.
6. Playback supports readable transcript display in MVP and synced highlighting in V2.
7. Success page shows emotional closure and optional next action.
8. World map is not required to understand or complete the primary prayer flow.
9. Empty states always offer one prayer-first recovery action.
10. Returning user can complete "today's prayer" without navigating through search or categories.

### Privacy

1. Private `HomePrayerCard` data is not included in public page props, API payloads, or map payloads.
2. Public map shows approximate anonymous lights only.
3. New card images reject arbitrary external URLs.
4. Anonymous is default for first-time prayer response and share flows.
5. Report action is available near user-generated responses.

### Engineering

1. Existing route boundaries remain clear: public, customer, admin.
2. No admin-only behavior is added to public routes.
3. No new large UI framework is introduced.
4. Existing helpers are reused where possible.
5. `npm run lint` passes.
6. `npm run build` passes for implementation PRs.
7. If Prisma schema changes, migration is included and `npx prisma generate` passes.

---

## 34. Guardrails For Codex / AI Agents

- Use `Start Pray` only.
- Do not use old project names.
- Do not add financial asset narratives.
- Do not expose private prayer details.
- Do not make a marketing landing page instead of the actual prayer experience.
- Do not add new UI frameworks for a single page.
- Do not rely only on frontend permission checks.
- Do not assume categories exist.
- Use `健康` for health category UI.
- Keep copy warm, clear, and human.
- Prioritize mobile checks after UI changes.

---

## 35. Improved Prompt For External AI V3 Wireframe Generation

Use this prompt when asking Claude, GPT, Gemini, or another design model to produce a completely new V3 wireframe. The output should be a design and product planning artifact only. It should not tell the team to directly edit the current production homepage.

```text
You are acting as a Principal Product Designer, UX Researcher, Staff Product Manager, Interaction Designer, and Design System Architect.

Product:
Start Pray
https://startpray.online

Start Pray is not a forum, social network, chat room, SaaS landing page, or church website.
It is a global anonymous prayer platform.

The product promise:
In 30 seconds, anyone can leave a real blessing for someone who needs prayer.

Product principles:
- Less is More
- Emotion First
- Prayer First
- Speed First
- Anonymous by Default
- Zero Learning Cost
- Mobile First
- Safety and privacy before growth

Core goals:
1. A first-time visitor understands the product within 10 seconds.
2. A first-time visitor can complete a prayer response within 30 seconds.
3. A user can anonymously share a prayer need with minimal cognitive load.
4. Voice prayer becomes the most emotionally meaningful interaction.
5. The world map becomes emotional proof and completion reward, not visual decoration.

Task:
Please generate a completely new V3 product wireframe for Start Pray.
Do not only comment on the current UI.
Do not simply reskin the current homepage.
Do not ask the engineering team to change the current production homepage yet.
The output should be a design artifact that can be reviewed before implementation.

You may review the current site for context, but you are not constrained by the current layout.

Analyze:
- Product Vision
- UX
- UI
- IA
- Sitemap
- User Journey
- User Flow
- Interaction Flow
- Cognitive Load
- Accessibility
- Emotional Design
- Conversion
- User Motivation
- Habit Loop
- Mobile First
- Micro Interaction
- Motion Design
- CTA strategy
- First-Time User Experience
- Returning User Experience
- Trust, safety, anonymity, and privacy

Required output:
1. Product Review
2. Problems
3. Solutions
4. Complete IA
5. Complete Sitemap
6. Complete User Journey
7. Complete User Flow
8. Complete Interaction Flow
9. Every Screen Wireframe in ASCII
10. Every CTA, with one primary CTA per screen
11. Every Loading, Empty, Error, Success state
12. Complete recording flow, step by step
13. Complete playback page with synchronized subtitle behavior
14. World map strategy
15. Habit Loop
16. If 50% of features must be removed, what remains
17. If only 3 core features remain, what are they
18. Design System
19. Typography
20. Spacing
21. Color System
22. Accessibility
23. Mobile / Tablet / Desktop versions
24. V1
25. V2
26. V3
27. Practical implementation plan
28. What must be done before touching the production homepage

Important implementation constraints:
- Existing app is a Next.js App Router project.
- Current main content model is HomePrayerCard.
- Private prayer cards must never expose title, description, image, owner, detailsHref, or exact location on public pages.
- New images must only use internal sources such as /uploads/... or /api/card-thumbnail?...
- Health category UI should use 健康, not 醫治.
- Do not propose a generic SaaS landing page.
- Do not propose social-network features such as followers, DMs, public popularity competition, or noisy gamification.
- Do not propose direct production homepage changes as the first step.
- First step should be a reviewable wireframe or preview route, not a homepage replacement.

Versioning requirement:
- V1 should be the smallest implementation-ready version.
- V2 should add functional voice/playback improvements.
- V3 should describe the complete prayer-first daily ritual vision.

Implementation planning requirement:
Please include a clear checklist of what must be implemented:
- routes
- components
- APIs
- data model changes, if any
- privacy checks
- moderation checks
- analytics events
- mobile QA
- accessibility QA
- launch and rollback plan

Please be specific enough that a design and engineering team can implement the result.
```
