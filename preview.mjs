import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CAPTIONS = require('./captions.json');
const PROMPTS  = require('./prompts.json');

const HASHTAGS = '#scales10x #digitalmarketing #businessgrowth #marketingstrategy #entrepreneurship #smallbusiness';

const DAY_INDEX = Math.floor(Date.now() / 86_400_000);
const caption   = `${CAPTIONS[DAY_INDEX % CAPTIONS.length]}\n\n${HASHTAGS}`;

console.log('Prompt  :', PROMPTS[DAY_INDEX % PROMPTS.length]);
console.log('\nCaption:\n' + caption);
