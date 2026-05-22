# Higgsfield → Instagram Auto-Poster

Generates AI images or Reels with the Higgsfield API, then publishes them to your Instagram Business page via the official Meta Graph API. No browser automation — all official APIs.

---

## Prerequisites

- **Node.js 18+** (`node --version`)
- **Higgsfield account** with API credits — [platform.higgsfield.ai](https://platform.higgsfield.ai)
- **Meta Developer App** with an Instagram Business account connected
- Required Meta app permissions: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`

---

## Setup

### 1. Install dependencies

```bash
cd higgsfield-instagram-poster
npm install
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Then fill in all four values. See the sections below for how to get each one.

---

### 3. Get your Higgsfield API Key

1. Log in at [platform.higgsfield.ai](https://platform.higgsfield.ai)
2. Go to **Settings → API Keys → Create Key**
3. You'll receive a `KEY_ID:KEY_SECRET` pair — paste the entire string as `HIGGSFIELD_API_KEY`

---

### 4. Get a long-lived Instagram access token

#### a. Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App**
2. Choose **Business** type
3. Add the **Instagram Graph API** product
4. Under **App Settings → Basic**, note your **App ID** and **App Secret**

#### b. Generate a short-lived token

1. Open the [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click **Add a Permission** and add:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
4. Click **Generate Access Token** → authorize with your Facebook account
5. Copy the token (valid for ~1 hour)

#### c. Exchange for a long-lived token (~60 days)

```bash
curl "https://graph.facebook.com/v25.0/oauth/access_token\
?grant_type=fb_exchange_token\
&client_id=YOUR_APP_ID\
&client_secret=YOUR_APP_SECRET\
&fb_exchange_token=YOUR_SHORT_LIVED_TOKEN"
```

Copy the returned `access_token` → paste into `.env` as `IG_ACCESS_TOKEN`.

#### d. Refresh before expiry (every ~50 days)

Run the same `fb_exchange_token` exchange with your current long-lived token. Meta resets the 60-day clock each time.

---

### 5. Find your Instagram Business Account ID (`IG_USER_ID`)

Run this in Graph API Explorer (or curl) with your access token:

```
GET /me/accounts
```

Find your Facebook Page in the response, copy its `id`, then run:

```
GET /{page_id}?fields=instagram_business_account
```

Copy `instagram_business_account.id` → paste into `.env` as `IG_USER_ID`.

---

## Configuration

Open `post.mjs` and edit the **CONFIGURATION** block at the top:

```js
const CONTENT_PROMPT = 'Your image/video description here';

const MEDIA_TYPE = 'image';  // 'image' (feed, 4:5) or 'reel' (9:16)

const IMAGE_MODEL = 'higgsfield-ai/soul/standard';
// Alternatives: 'higgsfield-ai/soul/v2/text-to-image'

const VIDEO_MODEL = 'bytedance/seedance/v1/pro/image-to-video';
// Alternative : 'kling-video/v2.1/pro/image-to-video'
```

The `POST_CAPTION` (with your hashtags) lives in `.env` so you can change it without touching code.

---

## How to Run

```bash
node post.mjs
```

Expected output:

```
========================================
 Higgsfield → Instagram Auto-Poster
========================================

[Step 1] Generating image with Higgsfield…
  Prompt : "A sleek, modern workspace…"
  Model  : higgsfield-ai/soul/standard
  Aspect : 4:5

  → POST https://platform.higgsfield.ai/higgsfield-ai/soul/standard
  ✓ Job submitted — request_id: req_abc123
  ⏳ Attempt 1: status = queued
  ⏳ Attempt 2: status = in_progress
  ✓ Media ready: https://cdn.higgsfield.ai/...

[Step 2] Creating Instagram media container…
  → POST https://graph.facebook.com/v25.0/1234567890/media
  ✓ Container created — id: 17891234567890

[Step 3] Publishing to Instagram…
  → POST https://graph.facebook.com/v25.0/1234567890/media_publish

========================================
 SUCCESS! Posted to Instagram
 Media ID : 17891234567890
 View     : https://www.instagram.com/p/17891234567890/
========================================
```

---

## Scheduling with cron (Linux / macOS)

Post once a day at 9 AM:

```bash
crontab -e
```

Add:

```
0 9 * * * cd /path/to/higgsfield-instagram-poster && node post.mjs >> logs/post.log 2>&1
```

### On Windows with Task Scheduler

```powershell
schtasks /create /tn "IG Auto-Post" /tr "node C:\Users\matsi\higgsfield-instagram-poster\post.mjs" /sc daily /st 09:00
```

---

## Important Limits & Notes

| Limit | Value |
|---|---|
| Instagram published posts | 50 per 24-hour rolling window |
| Meta access token lifespan | ~60 days (refresh every 50 days) |
| Higgsfield poll timeout | 120 seconds per generation job |
| Reels video container processing | Up to 5 minutes on Meta's side |

### Is the Higgsfield CDN URL publicly accessible?

Yes — Higgsfield's `cdn.higgsfield.ai` URLs are publicly accessible without auth. Meta's servers can fetch them directly. You do **not** need to re-host or proxy the media file.

If you run into a Meta error like `OAuthException: Invalid image/video URL`, try downloading the file locally and re-hosting it on S3 or Cloudinary first, then pass that URL to the Graph API instead.

### For Reels

The script generates an image first (Soul model), then animates it into a video (Seedance/Kling). This two-step flow is required because the Soul model is text-to-image only. If you have a direct text-to-video endpoint from Higgsfield, update the `reel` branch in `main()` accordingly.
