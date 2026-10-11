#!/usr/bin/env node
// Builds data.json for the Main Stats site from the Windsor.ai pulls saved in raw/.
//
//   node scripts/build.mjs            build, keeping everything already in data.json
//   node scripts/build.mjs --force    skip the "count changed too much" safety check
//   node scripts/build.mjs --comments list the comments that still need a theme, and write nothing
//
// raw/ holds one JSON file per pull, exactly as Windsor.ai returned it
// (a bare array of rows, or {"result": [...]}):
//   ig_profile  ig_daily  ig_media  yt_channel  yt_views  yt_subs  yt_videos
// one optional file to fill in older days (the daily pulls only reach back 30 days):
//   ig_history   date and views for up to a year; Instagram gives follower changes for 30 days only.
//                yt_views and yt_subs can simply be pulled for a longer range, they need no extra file.
// and two optional ones for the Comments section:
//   ig_comments  every comment and reply on the posts of the last 30 days
//   ig_themes    which theme each comment belongs to, written by the daily task:
//                {"themes": [{"id": "wants-list", "label": "Asking for the list"}],
//                 "assign": {"<comment id>": "wants-list"}}
//
// What it keeps between runs (so history grows past Windsor's 30 days):
//   reported   every day's views and reported follower change, newest pull wins
//   snapshots  the real follower and subscriber count on each day the build ran
// What it rebuilds every run:
//   daily      one row per day with the totals the page draws
//   top        the top posts and videos of the last 30 days
//   comments   the comments on the last 30 days of posts (a comment's theme is kept between runs)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TZ = 'Asia/Kuala_Lumpur';
const force = process.argv.includes('--force');
const listComments = process.argv.includes('--comments');

const fail = (message) => {
  console.error('BUILD FAILED: ' + message);
  process.exit(1);
};

const readRaw = (name, { optional = false } = {}) => {
  const file = join(root, 'raw', name + '.json');
  if (!existsSync(file)) {
    if (optional) return [];
    fail(`raw/${name}.json is missing`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`raw/${name}.json is not valid JSON (${error.message})`);
  }
  const rows = Array.isArray(parsed) ? parsed : parsed && (parsed.result || parsed.data || parsed.rows);
  if (!Array.isArray(rows)) fail(`raw/${name}.json has no list of rows`);
  if (!rows.length && !optional) fail(`raw/${name}.json has zero rows`);
  return rows;
};

const num = (value, what) => {
  const n = Number(value);
  if (value == null || value === '' || !Number.isFinite(n)) fail(`${what} is not a number: ${JSON.stringify(value)}`);
  return n;
};
const dayOf = (value, what) => {
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${what} is not a date: ${JSON.stringify(value)}`);
  return s;
};
const addDays = (day, n) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const todayIn = (timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// ---- read the pulls ---------------------------------------------------------

const igProfile = readRaw('ig_profile')[0];
const ytChannel = readRaw('yt_channel')[0];
const profile = {
  instagram: {
    username: String(igProfile.username || ''),
    followers: num(igProfile.followers_count, 'Instagram followers_count'),
    posts: igProfile.media_count == null ? null : num(igProfile.media_count, 'Instagram media_count'),
  },
  youtube: {
    title: String(ytChannel.channel_title || ''),
    subscribers: num(ytChannel.subscriber_count, 'YouTube subscriber_count'),
    lifetime_views: ytChannel.view_count == null ? null : num(ytChannel.view_count, 'YouTube view_count'),
    videos: ytChannel.video_count == null ? null : num(ytChannel.video_count, 'YouTube video_count'),
  },
};
if (profile.instagram.followers <= 0) fail('Instagram follower count is 0 or less');

const igDaily = readRaw('ig_daily');
const ytViews = readRaw('yt_views');
const ytSubs = readRaw('yt_subs');
if (igDaily.length < 7) fail(`raw/ig_daily.json has only ${igDaily.length} days, expected about 30`);
if (ytViews.length < 7) fail(`raw/yt_views.json has only ${ytViews.length} days, expected about 27`);
if (ytSubs.length < 7) fail(`raw/yt_subs.json has only ${ytSubs.length} days, expected about 27`);

// ---- merge with what is already saved ---------------------------------------

const dataFile = join(root, 'data.json');
let previous = { reported: [], snapshots: [] };
if (existsSync(dataFile)) {
  try {
    previous = JSON.parse(readFileSync(dataFile, 'utf8'));
  } catch (error) {
    fail(`the existing data.json is not valid JSON (${error.message}); fix or restore it before building`);
  }
}

const reported = new Map((previous.reported || []).map((r) => [r.date, { ...r }]));
const reportedRow = (date) => {
  if (!reported.has(date)) reported.set(date, { date, ig_views: null, ig_new_followers: null, yt_views: null, yt_net_subscribers: null });
  return reported.get(date);
};
for (const r of readRaw('ig_history', { optional: true })) {
  reportedRow(dayOf(r.date, 'ig_history date')).ig_views = num(r.views, `ig_history views on ${r.date}`);
}
for (const r of igDaily) {
  const row = reportedRow(dayOf(r.date, 'ig_daily date'));
  row.ig_views = num(r.views, `ig_daily views on ${r.date}`);
  row.ig_new_followers = num(r.follower_count_1d, `ig_daily follower_count_1d on ${r.date}`);
}
for (const r of ytViews) reportedRow(dayOf(r.date, 'yt_views date')).yt_views = num(r.views, `yt_views views on ${r.date}`);
for (const r of ytSubs) {
  reportedRow(dayOf(r.date, 'yt_subs date')).yt_net_subscribers =
    num(r.subscribers_gained_channel, `yt_subs gained on ${r.date}`) - num(r.subscribers_lost_channel, `yt_subs lost on ${r.date}`);
}

const today = todayIn(TZ);
const snapshots = new Map((previous.snapshots || []).map((s) => [s.date, { ...s }]));
const lastSnapshot = [...snapshots.values()].filter((s) => s.date < today).sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
if (lastSnapshot && !force) {
  const jump = (now, before, name) => {
    if (before == null) return;
    const diff = Math.abs(now - before);
    if (diff > 500 && diff / Math.max(before, 1) > 0.25) {
      fail(`${name} went from ${before} (${lastSnapshot.date}) to ${now}. That looks like a typo in raw/. If it is real, run again with --force`);
    }
  };
  jump(profile.instagram.followers, lastSnapshot.ig_followers, 'Instagram followers');
  jump(profile.youtube.subscribers, lastSnapshot.yt_subscribers, 'YouTube subscribers');
}
snapshots.set(today, {
  date: today,
  ig_followers: profile.instagram.followers,
  yt_subscribers: profile.youtube.subscribers,
  yt_lifetime_views: profile.youtube.lifetime_views,
});

// ---- one row per day --------------------------------------------------------

const firstDay = [...reported.keys(), ...snapshots.keys()].sort()[0];
const dates = [];
for (let d = firstDay; d <= today; d = addDays(d, 1)) dates.push(d);

// Instagram reports the latest day or two late, as 0 new followers: treat those as not reported yet.
const igReported = dates.map((d) => (reported.get(d) ? reported.get(d).ig_new_followers : null));
for (let i = dates.length - 1; i >= Math.max(dates.length - 3, 0) && !igReported[i]; i--) igReported[i] = null;
const ytReported = dates.map((d) => (reported.get(d) ? reported.get(d).yt_net_subscribers : null));

// A day's change is the real difference between two saved counts when both exist,
// otherwise what the platform reported for that day.
// The total is the saved count when there is one, otherwise the next known total
// worked back through the changes in between (an estimate).
const series = (reportedChange, snapshotField, current) => {
  const snap = dates.map((d) => (snapshots.get(d) ? snapshots.get(d)[snapshotField] : null));
  const change = dates.map((d, i) => (i > 0 && snap[i] != null && snap[i - 1] != null ? snap[i] - snap[i - 1] : reportedChange[i]));
  const total = new Array(dates.length).fill(null);
  const real = new Array(dates.length).fill(false);
  let t = current;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (snap[i] != null) { t = snap[i]; real[i] = true; }
    if (snap[i] != null || change[i] != null) total[i] = t;
    if (change[i] != null) t -= change[i];
  }
  return { change, total, real };
};
const ig = series(igReported, 'ig_followers', profile.instagram.followers);
const yt = series(ytReported, 'yt_subscribers', profile.youtube.subscribers);

const daily = dates.map((date, i) => {
  const r = reported.get(date) || {};
  return {
    date,
    yt_subscribers: yt.total[i], yt_change: yt.change[i], yt_real: yt.real[i], yt_views: r.yt_views ?? null,
    ig_followers: ig.total[i], ig_change: ig.change[i], ig_real: ig.real[i], ig_views: r.ig_views ?? null,
  };
});

// ---- top content ------------------------------------------------------------

const clean = (text, max) => {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
};
const byViews = (a, b) => b.views - a.views;
const count = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));

const topInstagram = readRaw('ig_media', { optional: true })
  .filter((r) => /^https:\/\/www\.instagram\.com\/[\w\-./]+$/.test(String(r.media_permalink || '')))
  .map((r) => ({
    permalink: r.media_permalink,
    caption: clean(r.media_caption, 140),
    date: dayOf(r.date, 'ig_media date'),
    views: count(r.media_views), likes: count(r.media_like_count), comments: count(r.media_comments_count),
    shares: count(r.media_shares), saves: count(r.media_saved),
  }))
  .sort(byViews).slice(0, 30);

const topYoutube = readRaw('yt_videos', { optional: true })
  .filter((r) => /^[\w-]{6,20}$/.test(String(r.video || '')))
  .map((r) => ({
    video: r.video,
    title: clean(r.video_title, 140),
    published: r.published_at ? dayOf(r.published_at, 'yt_videos published_at') : null,
    views: count(r.views), likes: count(r.likes), comments: count(r.comments),
  }))
  .sort(byViews).slice(0, 30);

const previousTop = previous.top || {};
const top = {
  instagram: topInstagram.length ? topInstagram : previousTop.instagram || [],
  youtube: topYoutube.length ? topYoutube : previousTop.youtube || [],
};

// ---- comments ---------------------------------------------------------------
// One entry per comment somebody else left: the top comment of each thread, plus any
// reply that tags the account. "replied" is true when the account answered after it.
// Windsor.ai only names the author on the account's own comments, which is what makes this work.

const previousComments = (previous.comments && previous.comments.instagram) || null;
const buildComments = () => {
  const rows = readRaw('ig_comments', { optional: true });
  if (!rows.length) return previousComments;

  const me = profile.instagram.username.toLowerCase();
  const mine = (r) => String(r.comment_username || '').toLowerCase() === me;
  const stamp = (r) => {
    const t = new Date(String(r.comment_timestamp || '').replace(/\+0000$/, 'Z'));
    return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 19) + 'Z';
  };
  const valid = rows.filter((r) => /^\d{5,25}$/.test(String(r.comment_id || '')));
  const repliesTo = new Map();
  for (const r of valid) {
    if (!r.comment_parent_id) continue;
    const parent = String(r.comment_parent_id);
    if (!repliesTo.has(parent)) repliesTo.set(parent, []);
    repliesTo.get(parent).push(r);
  }
  const captions = new Map([...(top.instagram || []), ...((previousTop.instagram) || [])].map((p) => [p.permalink, p.caption]));
  const oldTheme = new Map(((previousComments && previousComments.items) || []).map((c) => [c.id, c.theme || null]));

  const items = [];
  for (const r of valid) {
    if (mine(r)) continue;
    const text = clean(r.comment_text, 400);
    if (!text) continue; // a GIF or sticker
    const at = stamp(r);
    if (!at) fail(`ig_comments comment ${r.comment_id} has no usable comment_timestamp`);
    const post = String(r.media_permalink || '');
    if (!/^https:\/\/www\.instagram\.com\/[\w\-./]+$/.test(post)) continue;
    const parent = r.comment_parent_id ? String(r.comment_parent_id) : null;
    // A reply only counts when it is aimed at the account; replies between other people are skipped.
    if (parent && !text.toLowerCase().includes('@' + me)) continue;
    const thread = repliesTo.get(parent || String(r.comment_id)) || [];
    const id = String(r.comment_id);
    items.push({
      id,
      text,
      likes: count(r.comment_like_count),
      replies: parent ? 0 : count(r.comment_reply_count),
      at,
      post,
      caption: captions.get(post) || '',
      posted: r.date ? dayOf(r.date, 'ig_comments date') : null,
      is_reply: Boolean(parent),
      replied: thread.some((x) => mine(x) && (stamp(x) || '') > at),
      theme: oldTheme.get(id) || null,
    });
  }
  if (!items.length) return previousComments;

  // themes: what was saved before, plus anything new in raw/ig_themes.json
  const themes = new Map(((previousComments && previousComments.themes) || []).map((t) => [t.id, { ...t }]));
  const themesFile = join(root, 'raw', 'ig_themes.json');
  if (existsSync(themesFile)) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(themesFile, 'utf8'));
    } catch (error) {
      fail(`raw/ig_themes.json is not valid JSON (${error.message})`);
    }
    for (const t of parsed.themes || []) {
      const id = String(t.id || '');
      const label = clean(t.label, 48);
      if (!/^[a-z0-9-]{1,30}$/.test(id)) fail(`raw/ig_themes.json theme id ${JSON.stringify(t.id)} must be lowercase letters, digits and dashes`);
      if (!label) fail(`raw/ig_themes.json theme ${id} has no label`);
      themes.set(id, { id, label });
    }
    const byId = new Map(items.map((c) => [c.id, c]));
    for (const [commentId, themeId] of Object.entries(parsed.assign || {})) {
      if (!byId.has(commentId)) fail(`raw/ig_themes.json gives a theme to comment ${commentId}, which is not in today's comments. Copy the id exactly from "node scripts/build.mjs --comments"`);
      if (!themes.has(themeId)) fail(`raw/ig_themes.json puts comment ${commentId} in theme ${JSON.stringify(themeId)}, which is not in its "themes" list or saved from before`);
      byId.get(commentId).theme = themeId;
    }
  }
  for (const c of items) if (c.theme && !themes.has(c.theme)) c.theme = null;
  const used = new Set(items.map((c) => c.theme));
  items.sort((a, b) => (a.at < b.at ? 1 : -1));
  return { themes: [...themes.values()].filter((t) => used.has(t.id)), all_themes: [...themes.values()], items };
};
const builtComments = buildComments();

if (listComments) {
  if (!builtComments) {
    console.log('No comments to sort: raw/ig_comments.json is missing or empty.');
    process.exit(0);
  }
  const { all_themes: allThemes, items } = builtComments;
  console.log(`THEMES SO FAR (${allThemes.length})`);
  for (const t of allThemes) console.log(`  ${t.id}  "${t.label}"  ${items.filter((c) => c.theme === t.id).length} comments`);
  const todo = items.filter((c) => !c.theme);
  console.log(`\nCOMMENTS WITHOUT A THEME (${todo.length} of ${items.length})`);
  for (const c of todo) console.log(`  ${c.id}  [${c.caption || 'post from ' + c.posted}]  ${c.text}`);
  process.exit(0);
}
const comments = builtComments ? { instagram: { themes: builtComments.themes, items: builtComments.items } } : previous.comments || null;

// ---- write ------------------------------------------------------------------

const sortedSnapshots = [...snapshots.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
const out = {
  updated_at: new Date().toISOString(),
  tracking_since: sortedSnapshots[0].date,
  profile,
  daily,
  top,
  comments,
  reported: [...reported.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
  snapshots: sortedSnapshots,
};
writeFileSync(dataFile, JSON.stringify(out, null, 1) + '\n');

const last = (field) => [...daily].reverse().find((d) => d[field] != null);
console.log('BUILD OK');
console.log(`  date (${TZ}): ${today}`);
console.log(`  days stored: ${daily.length} (${daily[0].date} to ${daily[daily.length - 1].date}), snapshots: ${sortedSnapshots.length}`);
console.log(`  Instagram: ${profile.instagram.followers} followers, latest reported change ${last('ig_change')?.ig_change} on ${last('ig_change')?.date}`);
console.log(`  YouTube:   ${profile.youtube.subscribers} subscribers, latest reported change ${last('yt_change')?.yt_change} on ${last('yt_change')?.date}`);
console.log(`  top content: ${top.instagram.length} Instagram posts, ${top.youtube.length} YouTube videos`);
if (comments && comments.instagram) {
  const list = comments.instagram.items;
  console.log(`  comments: ${list.length} on Instagram, ${list.filter((c) => !c.replied).length} not replied to, ${list.filter((c) => !c.theme).length} without a theme`);
} else {
  console.log('  comments: none saved yet');
}
