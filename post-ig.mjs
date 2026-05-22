import 'dotenv/config';
import fetch from 'node-fetch';

const { IG_USER_ID, IG_ACCESS_TOKEN, POST_CAPTION } = process.env;
const BASE = 'https://graph.facebook.com/v25.0';
const mediaUrl = 'https://d8j0ntlcm91z4.cloudfront.net/user_38B8REe2Fv9C6iQ1M1liUAId5c2/hf_20260522_124446_24135541-aa2c-43df-8f75-9b8756c1a194.png';

console.log('[Step 2] Creating Instagram media container...');
const r1 = await fetch(`${BASE}/${IG_USER_ID}/media`, {
  method: 'POST',
  body: new URLSearchParams({ caption: POST_CAPTION, access_token: IG_ACCESS_TOKEN, image_url: mediaUrl })
});
const d1 = await r1.json();
if (!r1.ok || d1.error) throw new Error(`Container failed: ${JSON.stringify(d1.error ?? d1)}`);
console.log(`  Container ID: ${d1.id}`);

await new Promise(r => setTimeout(r, 1000));

console.log('[Step 3] Publishing...');
const r2 = await fetch(`${BASE}/${IG_USER_ID}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({ creation_id: d1.id, access_token: IG_ACCESS_TOKEN })
});
const d2 = await r2.json();
if (!r2.ok || d2.error) throw new Error(`Publish failed: ${JSON.stringify(d2.error ?? d2)}`);
console.log(`\nSUCCESS! Media ID: ${d2.id}`);
