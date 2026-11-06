# API Documentation

This file gives a practical overview of the API routes. It is not a full OpenAPI spec yet.

Most routes return JSON. Member and admin routes require the matching session.

## Public Prayer Cards

### `GET /api/home-cards`

Returns public prayer cards.

Common query parameters:

```text
sort=recent | responses | updated
limit=12
skip=0
category=health
categoryId=1
search=family
```

Used by the home page and prayer wall.

### `POST /api/home-cards`

Creates a prayer card for the signed-in member.

Important fields:

```text
title
description
categoryId
image
tags
meta
voiceHref
locationCity
locationCountry
locationLat
locationLng
isPrivate
shareToThreads
```

`shareToThreads` is an explicit opt-in. It is rejected for private cards. If selected, an admin-only review record is created; the card itself is still created when Threads sharing is not selected.

If no image is provided by the create page, the app can use the default generated thumbnail route.

### `GET /api/home-cards/[id]`

Returns a single public prayer card.

Private or blocked cards are not returned through the public route.

## Member Routes

### `GET /api/customer/cards`

Returns prayer cards owned by the signed-in member.

### `GET /api/customer/cards/[id]`

Returns one owned prayer card.

### `PUT /api/customer/cards/[id]`

Updates a member-owned prayer card.

### `PATCH /api/customer/cards/[id]`

Updates simple visibility-related fields.

### `DELETE /api/customer/cards/[id]`

Deletes a member-owned prayer card.

### `GET /api/customer/profile`

Returns the signed-in member profile.

### `PUT /api/customer/profile`

Updates member profile fields.

### `GET /api/customer/responses`

Returns response history for the signed-in member.

## Responses

### `GET /api/responses/[homeCardId]`

Returns responses for a prayer card.

### `POST /api/responses`

Creates a response for a prayer card.

Responses can include text and may reference voice media.

## Categories

### `GET /api/home-categories`

Returns active public categories.

Admin routes can create and update categories.

## Uploads

### `POST /api/upload-image`

Uploads and compresses an image.

The route validates:

- signed-in member
- image file type
- file size
- image decoding

The result is a site-local image URL.

### `GET /api/card-thumbnail`

Returns a generated SVG thumbnail.

Used when a prayer card has no uploaded image.

Example:

```text
/api/card-thumbnail?title=為家人健康代禱
```

## Admin Routes

Admin routes live under:

```text
/api/admin/*
```

They cover:

- users
- prayer cards
- responses
- categories
- reports
- site settings
- admin accounts
- operation logs

See [Admin and Moderation](admin.md) for the operational overview.

### `POST /api/admin/prayfor/[id]/threads`

Admin-only. Publishes a reviewed, consented public prayer card to the configured Start Pray Threads account. The request body is `{ "action": "publish", "text": "..." }`; `text` is the reviewed post preview (up to 500 characters). Use `{ "action": "skip" }` to record that the card will not be shared. Published status and the returned Threads post ID/permalink are stored with the share record. Failed posts can be retried from the admin UI.

### `/api/admin/threads-settings`

Admin-only `GET` returns whether Threads is enabled, the configured account ID and API version, and whether a token is stored. It never returns the token. `PATCH` saves the toggle and credentials; a blank token preserves the stored token unless `clearAccessToken: true` is sent.
