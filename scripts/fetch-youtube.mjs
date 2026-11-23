// Refreshes the YouTube playlist snapshot the page shows (Ryo 2026-11-21: videos come from one playlist, loaded automatically).
// Reads the playlist's public feed (no API key; the newest 15 entries), saves each thumbnail under public/youtube/
// so the page never loads images from YouTube, and writes the list to the snapshot file named in the settings.
// Run by .github/workflows/youtube.yml; the build itself never goes to YouTube.
// Usage: node scripts/fetch-youtube.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';

const site = JSON.parse(readFileSync('src/config/site.json', 'utf8'));
const { playlistId = '', snapshot } = site.youtube ?? {};
if (!snapshot) throw new Error('youtube.snapshot is not set in src/config/site.json');
const DIR = 'public/youtube';
const ID = /^[A-Za-z0-9_-]{11}$/;

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
let videos = [];
if (playlistId) {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(playlistId)) throw new Error(`youtube.playlistId looks wrong: ${playlistId}`);
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`);
  if (!res.ok) throw new Error(`playlist feed returned ${res.status}`);
  const xml = await res.text();
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = decode(entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').trim();
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? '';
    if (!id || !ID.test(id) || !title) continue;
    videos.push({ id, title, published, thumb: `youtube/${id}.jpg` });
  }
  mkdirSync(DIR, { recursive: true });
  for (const v of videos) {
    const file = `public/${v.thumb}`;
    if (existsSync(file)) continue;
    const img = await fetch(`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`);
    if (!img.ok) throw new Error(`thumbnail for ${v.id} returned ${img.status}`);
    writeFileSync(file, Buffer.from(await img.arrayBuffer()));
  }
}
// Thumbnails of videos that left the playlist go too.
if (existsSync(DIR)) for (const name of readdirSync(DIR)) if (!videos.some(v => `${v.id}.jpg` === name)) rmSync(`${DIR}/${name}`);
writeFileSync(snapshot, JSON.stringify({ playlistId, videos }, null, 2) + '\n');
console.log(`YouTube snapshot: ${videos.length} videos from ${playlistId || '(no playlist set)'}`);
