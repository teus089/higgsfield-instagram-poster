# Higgsfield → Instagram Auto-Poster

Generates AI images or Reels with the **Higgsfield CLI** and publishes them to an Instagram Business account via the **Meta Graph API v25.0**. No browser automation — all official APIs and CLIs.

---

## How It Works

```
node post.mjs
      │
      ├─ Step 1: Higgsfield CLI generates the image
      │    higgsfield generate create text2image_soul_v2 --prompt "..." --wait
      │    → returns a public CDN URL (cloudfront.net)
      │
      ├─ Step 2: Meta Graph API creates a media container
      │    POST /v25.0/{IG_USER_ID}/media
      │    → returns a container ID
      │
      └─ Step 3: Meta Graph API publishes the container
           POST /v25.0/{IG_USER_ID}/media_publish
           → post is live on Instagram
```

For **Reels**, Step 1 runs twice: first generates a source image (Soul V2), then animates it into a video (Seedance/Kling image-to-video). Meta then processes the video server-side before publishing.

---

## Prerequisites

- **Node.js 18+**
- **Higgsfield account** with credits — [higgsfield.ai](https://higgsfield.ai)
- **Instagram Business account** connected to a Facebook Page
- **Meta Developer App** (Business type) with **Facebook Login for Business** configured

---

## Setup

### 1. Install dependencies

```bash
npm install
npm install -g @higgsfield/cli
```

### 2. Authenticate with Higgsfield

```bash
higgsfield auth login
```

This opens a browser tab for one-click device login. On success it saves credentials to `~/.config/higgsfield/credentials.json`. The CLI uses these automatically on every run — no API key needed in `.env`.

**Refresh when expired:** just run `higgsfield auth login` again (~10 seconds).

### 3. Set up your `.env`

```bash
cp .env.example .env
```

Fill in three values:

```
IG_USER_ID=          # Your Instagram Business account numeric ID
IG_ACCESS_TOKEN=     # Long-lived Meta User Access Token (~60 days)
POST_CAPTION=        # Caption text and hashtags for every post
```

#### Getting `IG_USER_ID`

Your Instagram Business account's numeric ID. Find it via the Graph API Explorer:

```
GET /me/accounts              → get your Facebook Page ID
GET /{page_id}?fields=instagram_business_account  → get the IG account ID
```

#### Getting `IG_ACCESS_TOKEN`

You need a **User Access Token** with these permissions:
- `instagram_content_publish`
- `instagram_basic`
- `pages_read_engagement`
- `pages_show_list`

**How to get it:**

1. In [developers.facebook.com](https://developers.facebook.com), create a **Business** app
2. Add the **Instagram API** use case → **API setup with Facebook login**
3. Click **Add required content permissions**
4. In **Facebook Login for Business → Settings**, add `http://localhost:8080` as a Valid OAuth Redirect URI
5. Run the capture server: `node capture-token.mjs`
6. Open this URL in your browser (swap in your App ID):
   ```
   https://www.facebook.com/dialog/oauth
     ?client_id=YOUR_APP_ID
     &redirect_uri=http://localhost:8080
     &scope=instagram_content_publish,instagram_basic,pages_read_engagement,pages_show_list,business_management
     &response_type=token
   ```
7. Complete the Facebook login flow — select your Page, Business, and Instagram account
8. The capture server writes the token to `.token` and exits
9. The response includes a `long_lived_token` valid for ~60 days — use that as `IG_ACCESS_TOKEN`

**Refresh every ~50 days:**

```bash
curl "https://graph.facebook.com/v25.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=YOUR_APP_ID
  &client_secret=YOUR_APP_SECRET
  &fb_exchange_token=YOUR_CURRENT_TOKEN"
```

---

## Configuration

Edit the **CONFIGURATION** block at the top of `post.mjs`:

```js
const CONTENT_PROMPT = 'Your image/video description here';

// 'image' → Instagram feed photo (3:4)
// 'reel'  → Instagram Reel (9:16)
const MEDIA_TYPE = 'image';

// Run `higgsfield model list` to see all available models
const IMAGE_MODEL = 'text2image_soul_v2';
const VIDEO_MODEL = 'seedance_pro';
```

**Supported aspect ratios for Soul V2:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`

The `POST_CAPTION` lives in `.env` so you can update hashtags without touching code.

---

## Running

```bash
node post.mjs
```

Example output:

```
========================================
 Higgsfield → Instagram Auto-Poster
========================================

[Step 1] Generating image with Higgsfield…
  Prompt : "A sleek, modern workspace…"
  Model  : text2image_soul_v2
  Aspect : 3:4

  → higgsfield generate create text2image_soul_v2 --wait
  ✓ Image ready: https://d8j0ntlcm91z4.cloudfront.net/...

[Step 2] Creating Instagram media container…
  → POST https://graph.facebook.com/v25.0/{IG_USER_ID}/media
  ✓ Container created — id: 17877...

[Step 3] Publishing to Instagram…
  → POST https://graph.facebook.com/v25.0/{IG_USER_ID}/media_publish

========================================
 SUCCESS! Posted to Instagram
 Media ID : 17989...
========================================
```

---

## Scheduling

**Windows Task Scheduler:**

```powershell
schtasks /create /tn "IG Auto-Post" /tr "node C:\path\to\higgsfield-instagram-poster\post.mjs" /sc daily /st 09:00
```

**Linux / macOS cron** (once a day at 9 AM):

```
0 9 * * * cd /path/to/higgsfield-instagram-poster && node post.mjs >> logs/post.log 2>&1
```

---

## Limits

| Item | Value |
|---|---|
| Instagram posts per 24h | 50 |
| Meta access token lifespan | ~60 days |
| Higgsfield CLI generation timeout | 5 min (images), 10 min (videos) |
| Reel video processing on Meta's side | Up to 5 minutes |

---

## Files

| File | Purpose |
|---|---|
| `post.mjs` | Main script — generate + publish |
| `capture-token.mjs` | One-time helper: local OAuth server that captures the Meta access token from the browser redirect |
| `.env.example` | Template for required environment variables |
| `.env` | Your credentials (gitignored) |
