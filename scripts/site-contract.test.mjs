import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Fast, offline quality gate for the public portfolio. No npm or live API calls.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const pages = [
  ['index.html', '/', 'ru'],
  ['services.html', '/services', 'ru'],
  ['projects.html', '/projects', 'ru'],
  ['about.html', '/about', 'ru'],
  ['contact.html', '/contact', 'ru'],
  ['en/index.html', '/en', 'en'],
  ['en/services.html', '/en/services', 'en'],
  ['en/projects.html', '/en/projects', 'en'],
  ['en/about.html', '/en/about', 'en'],
  ['en/contact.html', '/en/contact', 'en'],
];

function tags(html, tag) {
  return [...html.matchAll(new RegExp('<' + tag + '\\b[^>]*>', 'gi'))].map(m => m[0]);
}
function attr(tag, name) {
  const match = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(["\\x27])(.*?)\\1', 'i'));
  return match?.[2] ?? null;
}
function meta(html, name) {
  return tags(html, 'meta').find(t => attr(t, 'name')?.toLowerCase() === name);
}
function localAssets(html, route) {
  const assets = new Set();
  for (const element of [...tags(html, 'link'), ...tags(html, 'script'), ...tags(html, 'img')]) {
    const tag = element.match(/^<([a-z]+)/i)?.[1].toLowerCase();
    if (tag === 'link' && !['stylesheet', 'icon', 'preload', 'modulepreload'].includes(attr(element, 'rel'))) continue;
    const raw = attr(element, 'src') ?? attr(element, 'href');
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) continue;
    let resolved;
    try { resolved = new URL(raw, 'https://dashhkuns.com' + route); }
    catch { continue; }
    if (resolved.hostname !== 'dashhkuns.com') continue;
    if (!/\.(?:css|m?js|png|webp|jpe?g|svg|gif|ico|woff2?|avif)$/i.test(resolved.pathname)) continue;
    const relativePath = decodeURIComponent(resolved.pathname).replace(/^\/+/, '');
    assets.add(relativePath);
  }
  return [...assets];
}

test('Vercel rewrites preserve the public RU/EN routes', () => {
  const rewrites = new Map((config.rewrites ?? []).map(({ source, destination }) => [source, destination]));
  for (const [filename, route] of pages) {
    if (route === '/') continue;
    assert.equal(rewrites.get(route), '/' + filename, 'missing rewrite for ' + route);
  }
});

for (const [filename, route, language] of pages) {
  test(route + ' (' + language + ') — HTML, SEO, assets', () => {
    const html = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.equal(attr(tags(html, 'html')[0] ?? '', 'lang'), language, 'html lang');
    assert.match(html, /<title>\s*[^<\s][\s\S]*?<\/title>/i, 'page title');
    assert.ok(meta(html, 'viewport')?.includes('width=device-width'), 'mobile viewport');
    assert.ok(attr(meta(html, 'description') ?? '', 'content')?.trim(), 'meta description');
    assert.equal(tags(html, 'h1').length, 1, 'exactly one H1');
    assert.equal(tags(html, 'main').length, 1, 'main landmark');
    const canonical = tags(html, 'link').find(t => attr(t, 'rel') === 'canonical');
    assert.ok(attr(canonical ?? '', 'href')?.startsWith('https://dashhkuns.com/'), 'canonical URL');
    for (const asset of localAssets(html, route)) {
      assert.ok(fs.existsSync(path.join(root, asset)), 'missing local asset ' + asset + ' in ' + filename);
    }
  });
}

test('contact destinations exist in both languages', () => {
  for (const filename of ['contact.html', 'en/contact.html']) {
    const html = fs.readFileSync(path.join(root, filename), 'utf8');
    assert.match(html, /<form\b[^>]*\bid=["']project-form["']/i, filename + ': lead form');
    assert.match(html, /<form\b[^>]*\bid=["']booking-form["']/i, filename + ': booking form');
  }
});

test('indexing and crawl files are present', () => {
  for (const asset of ['robots.txt', 'sitemap.xml']) {
    assert.ok(fs.existsSync(path.join(root, asset)), asset);
  }
});
