import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CAPTIONS = require('./captions.json');
const PROMPTS  = require('./prompts.json');

const IMAGE_HASHTAGS = '#scales10x #contentcreation #digitalmarketing #entrepreneurship #growthmindset #businessowner #marketingstrategy #contentmarketing #socialmediamarketing #smallbusiness';
const REEL_HASHTAGS  = '#scales10x #reels #reelsinstagram #viral #viralreels #fyp #foryoupage #trending #explore #contentcreation #digitalmarketing #entrepreneurship #growthmindset #businessowner #contentmarketing #socialmedia #reelsviral #instareels';

const DAY_INDEX  = Math.floor(Date.now() / 86_400_000);
const MEDIA_TYPE = DAY_INDEX % 2 === 0 ? 'image' : 'reel';
const caption    = `${CAPTIONS[DAY_INDEX % CAPTIONS.length]}\n\n${MEDIA_TYPE === 'reel' ? REEL_HASHTAGS : IMAGE_HASHTAGS}`;

console.log('Media type :', MEDIA_TYPE);
console.log('Prompt     :', PROMPTS[DAY_INDEX % PROMPTS.length]);
console.log('\nCaption:\n' + caption);
