// =============================================================================
// CONFIGURATION
// =============================================================================

// Image models (higgsfield CLI job_set_type): run `hf model list` to see all
// Video models : 'soul_cast' | 'seedance_pro' | 'kling_pro'
const IMAGE_MODEL = 'text2image_soul_v2';
const VIDEO_MODEL = 'seedance1_5';

// Aspect ratios — Soul V2 supports: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3
const VIDEO_ASPECT = '9:16';

// Safety: small delay between Meta API calls (ms)
const META_DELAY_MS = 1_000;

// =============================================================================
// IMPORTS & ENV
// =============================================================================
import 'dotenv/config';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PROMPTS  = require('./prompts.json');
const CAPTIONS = require('./captions.json');

const IMAGE_HASHTAGS = '#scales10x #contentcreation #digitalmarketing #entrepreneurship #growthmindset #businessowner #marketingstrategy #contentmarketing #socialmediamarketing #smallbusiness';

const REEL_HASHTAGS  = '#scales10x #reels #reelsinstagram #viral #viralreels #fyp #foryoupage #trending #explore #contentcreation #digitalmarketing #entrepreneurship #growthmindset #businessowner #contentmarketing #socialmedia #reelsviral #instareels';

// Pick today's prompt, caption, and media type based on days since epoch
const DAY_INDEX     = Math.floor(Date.now() / 86_400_000);
const CONTENT_PROMPT = PROMPTS[DAY_INDEX % PROMPTS.length];
const MEDIA_TYPE     = DAY_INDEX % 2 === 0 ? 'image' : 'reel';
const IMAGE_ASPECT   = MEDIA_TYPE === 'reel' ? '9:16' : '3:4';

const BASE_CAPTION   = CAPTIONS[DAY_INDEX % CAPTIONS.length];
const POST_CAPTION   = `${BASE_CAPTION}\n\n${MEDIA_TYPE === 'reel' ? REEL_HASHTAGS : IMAGE_HASHTAGS}`;

const {
  IG_USER_ID,      // Instagram Business account numeric ID
  IG_ACCESS_TOKEN, // Long-lived Meta access token (~60 days)
} = process.env;

function requireEnv() {
  const missing = ['IG_USER_ID', 'IG_ACCESS_TOKEN']
    .filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}\nCopy .env.example → .env and fill them in.`);
  }
}

// =============================================================================
// HIGGSFIELD HELPERS (via CLI — handles auth automatically)
// =============================================================================

function hfCli(args) {
  return execSync(`higgsfield ${args} --json --no-color`, { encoding: 'utf8' }).trim();
}

// Returns { jobId, url }
function generateImage(model, prompt, aspectRatio) {
  console.log(`  → higgsfield generate create ${model}`);
  const submitOut = hfCli(`generate create ${model} --prompt ${JSON.stringify(prompt)} --aspect_ratio ${aspectRatio}`);
  const jobId = JSON.parse(submitOut)[0];
  if (!jobId) throw new Error(`No job ID in CLI output: ${submitOut}`);
  console.log(`  ⏳ Job ${jobId} — waiting…`);
  const waitOut = hfCli(`generate wait ${jobId} --timeout 5m`);
  const data = JSON.parse(waitOut);
  const url = data.result_url;
  if (!url) throw new Error(`No result_url in CLI output: ${waitOut}`);
  console.log(`  ✓ Image ready: ${url}`);
  return { jobId, url };
}

// sourceJobId must be the UUID from a prior generateImage call
function generateVideo(model, prompt, aspectRatio, sourceJobId) {
  console.log(`  → higgsfield generate create ${model}`);
  const submitOut = hfCli(`generate create ${model} --prompt ${JSON.stringify(prompt)} --aspect_ratio ${aspectRatio} --image ${sourceJobId}`);
  const jobId = JSON.parse(submitOut)[0];
  if (!jobId) throw new Error(`No job ID in CLI output: ${submitOut}`);
  console.log(`  ⏳ Job ${jobId} — waiting…`);
  const waitOut = hfCli(`generate wait ${jobId} --timeout 10m`);
  const data = JSON.parse(waitOut);
  const url = data.result_url;
  if (!url) throw new Error(`No result_url in CLI output: ${waitOut}`);
  console.log(`  ✓ Video ready: ${url}`);
  return url;
}

// =============================================================================
// INSTAGRAM GRAPH API HELPERS
// =============================================================================
const IG_BASE = 'https://graph.facebook.com/v25.0';

/**
 * Step 2 — Create a media container on Instagram.
 * For videos (Reels), Meta must fetch the video from a public URL.
 * The Higgsfield CDN URL is public — no re-hosting required.
 */
async function createInstagramContainer(mediaUrl) {
  const endpoint = `${IG_BASE}/${IG_USER_ID}/media`;
  console.log(`  → POST ${endpoint}`);

  const params = new URLSearchParams({
    caption: POST_CAPTION,
    access_token: IG_ACCESS_TOKEN,
  });

  if (MEDIA_TYPE === 'reel') {
    params.set('media_type', 'REELS');
    params.set('video_url', mediaUrl);
  } else {
    params.set('image_url', mediaUrl);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    body: params,
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(
      `Instagram container creation failed [${res.status}]: ${JSON.stringify(data.error ?? data)}`
    );
  }

  const containerId = data.id;
  if (!containerId) {
    throw new Error(`No container ID in IG response: ${JSON.stringify(data)}`);
  }

  console.log(`  ✓ Container created — id: ${containerId}`);
  return containerId;
}

/**
 * For Reels, Meta processes the video asynchronously after container creation.
 * Poll the container's status_code until FINISHED before publishing.
 */
async function waitForVideoContainer(containerId) {
  const deadline = Date.now() + 5 * 60_000; // up to 5 minutes for Meta video processing
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    await sleep(5_000);

    const res = await fetch(
      `${IG_BASE}/${containerId}?fields=status_code,status&access_token=${IG_ACCESS_TOKEN}`
    );
    const data = await res.json();

    if (data.error) {
      throw new Error(`IG container status check failed: ${JSON.stringify(data.error)}`);
    }

    const statusCode = data.status_code;
    console.log(`  ⏳ Attempt ${attempt}: IG container status = ${statusCode}`);

    if (statusCode === 'FINISHED') {
      console.log('  ✓ Instagram video processing complete');
      return;
    }
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new Error(`Instagram container processing failed with status: ${statusCode}\nFull: ${JSON.stringify(data)}`);
    }
    // IN_PROGRESS or PUBLISHED — keep polling
  }

  throw new Error('Timed out waiting for Instagram to process the video container');
}

/**
 * Step 3 — Publish the container.
 */
async function publishContainer(containerId) {
  await sleep(META_DELAY_MS);
  const endpoint = `${IG_BASE}/${IG_USER_ID}/media_publish`;
  console.log(`  → POST ${endpoint}`);

  const res = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: IG_ACCESS_TOKEN,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(
      `Instagram publish failed [${res.status}]: ${JSON.stringify(data.error ?? data)}`
    );
  }

  if (!data.id) {
    throw new Error(`Publish succeeded but no media ID returned: ${JSON.stringify(data)}`);
  }

  return data.id;
}

// =============================================================================
// UTILITIES
// =============================================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('\n========================================');
  console.log(' Higgsfield → Instagram Auto-Poster');
  console.log('========================================\n');

  requireEnv();

  // ------------------------------------------------------------------
  // STEP 1 — Generate content with Higgsfield
  // ------------------------------------------------------------------
  console.log(`[Step 1] Generating ${MEDIA_TYPE} with Higgsfield…`);
  console.log(`  Prompt : "${CONTENT_PROMPT}"`);
  console.log(`  Model  : ${IMAGE_MODEL}`);
  console.log(`  Aspect : ${IMAGE_ASPECT}\n`);

  let mediaUrl;

  if (MEDIA_TYPE === 'image') {
    mediaUrl = generateImage(IMAGE_MODEL, CONTENT_PROMPT, IMAGE_ASPECT).url;

  } else if (MEDIA_TYPE === 'reel') {
    console.log('  [1a] Generating source image for Reel…');
    const { jobId } = generateImage(IMAGE_MODEL, CONTENT_PROMPT, IMAGE_ASPECT);

    console.log(`\n  [1b] Animating image into video with ${VIDEO_MODEL}…`);
    mediaUrl = generateVideo(VIDEO_MODEL, CONTENT_PROMPT, VIDEO_ASPECT, jobId);

  } else {
    throw new Error(`Unknown MEDIA_TYPE: "${MEDIA_TYPE}". Must be 'image' or 'reel'.`);
  }

  console.log(`\n  Media URL: ${mediaUrl}\n`);

  // ------------------------------------------------------------------
  // STEP 2 — Create Instagram media container
  // ------------------------------------------------------------------
  console.log('[Step 2] Creating Instagram media container…');
  const containerId = await createInstagramContainer(mediaUrl);

  // For Reels, wait for Meta to finish processing the video server-side
  if (MEDIA_TYPE === 'reel') {
    console.log('\n  Waiting for Instagram to process the Reel video…');
    await waitForVideoContainer(containerId);
  }

  console.log();

  // ------------------------------------------------------------------
  // STEP 3 — Publish to Instagram
  // ------------------------------------------------------------------
  console.log('[Step 3] Publishing to Instagram…');
  const igMediaId = await publishContainer(containerId);

  console.log('\n========================================');
  console.log(` SUCCESS! Posted to Instagram`);
  console.log(` Media ID : ${igMediaId}`);
  console.log(` View     : https://www.instagram.com/p/${igMediaId}/`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('\n[FATAL ERROR]', err.message);
  process.exit(1);
});
