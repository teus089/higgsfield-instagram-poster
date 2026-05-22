// =============================================================================
// CONFIGURATION
// =============================================================================

// Image model — run `higgsfield model list` to see all options
const IMAGE_MODEL  = 'text2image_soul_v2';
const IMAGE_ASPECT = '3:4'; // portrait feed posts

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

const HASHTAGS = '#scales10x #digitalmarketing #businessgrowth #marketingstrategy #entrepreneurship #smallbusiness';

// Pick today's prompt and caption based on days since epoch
const DAY_INDEX      = Math.floor(Date.now() / 86_400_000);
const CONTENT_PROMPT = PROMPTS[DAY_INDEX % PROMPTS.length];
const BASE_CAPTION   = CAPTIONS[DAY_INDEX % CAPTIONS.length];
const POST_CAPTION   = `${BASE_CAPTION}\n\n${HASHTAGS}`;

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

// =============================================================================
// INSTAGRAM GRAPH API HELPERS
// =============================================================================
const IG_BASE = 'https://graph.facebook.com/v25.0';

async function createInstagramContainer(mediaUrl) {
  const endpoint = `${IG_BASE}/${IG_USER_ID}/media`;
  console.log(`  → POST ${endpoint}`);

  const params = new URLSearchParams({
    image_url: mediaUrl,
    caption: POST_CAPTION,
    access_token: IG_ACCESS_TOKEN,
  });

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
  // STEP 1 — Generate image with Higgsfield
  // ------------------------------------------------------------------
  console.log(`[Step 1] Generating image with Higgsfield…`);
  console.log(`  Prompt : "${CONTENT_PROMPT}"`);
  console.log(`  Model  : ${IMAGE_MODEL}`);
  console.log(`  Aspect : ${IMAGE_ASPECT}\n`);

  const { url: mediaUrl } = generateImage(IMAGE_MODEL, CONTENT_PROMPT, IMAGE_ASPECT);

  console.log(`\n  Media URL: ${mediaUrl}\n`);

  // ------------------------------------------------------------------
  // STEP 2 — Create Instagram media container
  // ------------------------------------------------------------------
  console.log('[Step 2] Creating Instagram media container…');
  const containerId = await createInstagramContainer(mediaUrl);

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
