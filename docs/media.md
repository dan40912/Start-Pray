# Media Pipeline

Start Pray supports uploaded images, generated thumbnails, and voice-related URLs.

The goal is simple: keep media safe enough, predictable, and easy to render across the site.

## Image Uploads

Route:

```text
POST /api/upload-image
```

Main file:

```text
src/app/api/upload-image/route.js
```

Upload behavior:

- requires a signed-in member
- accepts image files only
- rejects files above the configured size limit
- decodes the image with `sharp`
- rotates based on metadata
- resizes large images
- outputs WebP
- stores the file through the media storage helper
- returns a site-local URL

## Media Storage Helper

Main file:

```text
src/lib/server-media-storage.js
```

This helper centralizes where files are written and how public URLs are built.

Keeping this logic in one place makes it easier to change storage later.

## Default Card Thumbnails

If a user creates a prayer card without uploading an image, the app can use a generated SVG thumbnail.

Route:

```text
GET /api/card-thumbnail?title=...
```

Main files:

```text
src/app/api/card-thumbnail/route.js
src/lib/default-thumbnail.js
```

The generated image is intentionally simple: dark background, white title text, and automatic line wrapping.

This keeps card creation lightweight while still giving every card a usable visual preview.

## Prayer Share Images

Public prayer detail pages use `/api/prayer-og/[id]` for Open Graph and Twitter
images instead of reusing the page cover. The endpoint returns a 1200 × 630 PNG
rendered by Sharp with the bundled Noto Sans TC font in `assets/fonts/`.

The title uses large type in a central 600px area so it remains readable in small
and square previews. Only the image title is shortened to 21 characters; the page
heading and metadata retain the full title. Uploaded photos are not reused in
the share image, keeping text contrast predictable.

Private, blocked, pending-review, missing, and invalid cards return 404. Images
must revalidate on every request; metadata also includes the card update timestamp
in the URL to distinguish revisions. Sharing services may retain their own cached
previews, so verify actual mobile previews again after deployment.

`src/lib/seo.js` only declares image dimensions when supplied explicitly. Other
images no longer claim to be 1200 × 630 regardless of their actual dimensions.

## Gallery Metadata

Prayer card gallery images are stored in the card `meta` array using a prefix:

```text
gallery::/uploads/example.webp
```

Helpers:

```text
src/lib/card-meta.js
```

The helper parses normal info lines and gallery image references into separate lists.

## Voice

### Global player controls

The compact player uses three separate grid columns for the track details, play
controls, and close button. Keep the close button in normal layout flow: an
absolute close button previously overlapped the mobile play button, so tapping
play actually dismissed the player. The track details button opens the shared
companion controls; no additional audio engine is created.

`player-visibility.mjs` applies the same route rules to Chinese and English URLs.
A stored dismissal hides idle playback, but must not hide active playback or an
explicitly opened companion session. Playback errors and completion notices stay
visible in the compact player.

The detail queue bootstrap aborts obsolete requests on page changes and refreshes.
An old response must not replace the new page's queue or collapse a queue the user
has already opened. Route/dismissal regressions: `tests/player-visibility.test.mjs`.

Mobile verification (2026-10-02): play/pause, advancing progress, opening full
controls, next track, closing and reopening, and English detail playback passed.
At viewport widths 320, 375, 414 and 1280, hit-testing the play button centre returns
the play button itself rather than the close button. Verify again on real iOS and
Android devices after deployment; the local browser check is not a device test.

Voice fields are currently stored as URLs on prayer cards or responses.

Important fields:

```text
HomePrayerCard.voiceHref
PrayerResponse.voiceUrl
```

The UI reads these values and builds playable queues for the global player and prayer detail views.

### Repeated Recording

Response recording uses `VoicePrayerOverlay` on the detail page and
`usePrayerRecorder` through the homepage recorder. Each new take must acquire a
fresh microphone stream. A track whose `readyState` is `live` can still be muted
or supply silent audio; reusing it is not evidence that the device is recording.

After the final recorder chunks arrive, release the microphone before decoding
and previewing. Cancel and unmount must also release the stream, close the input
meter's AudioContext, stop recognition, and invalidate pending permission results.
Keep the verified Blob until upload succeeds so a failed request can be retried.

The same-card two-minute response cooldown is separate from recording quality.
The detail-page voice entry shows its countdown before a visitor starts another
take. A moving timer or animated waveform alone does not prove sound was captured;
the final audio analysis and preview remain necessary.

Regression checks: `tests/recorder-lifecycle.test.mjs` and
`tests/voice-submit-retry.test.mjs`. See
[`recording flow verification`](review-2026-10-02-recording.md) for the controlled
browser reproduction and actual local guest uploads.
