/**
 * Objective Geometry Audit — Swarm
 *
 * Launches the production build, captures desktop/mobile screenshots,
 * and inspects every key section's bounding boxes for unintended
 * intersections, overflow, and clipping — using precise DOM selectors
 * that match the actual component structure.
 *
 * Usage: node scripts/geometry-audit.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const ROOT = join(__dirname, '..');
const SCREENSHOT_DIR = join(ROOT, 'docs', 'screenshots');
const DIST_DIR = join(ROOT, 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.json': 'application/json',
};

function md5File(p) { return createHash('md5').update(readFileSync(p)).digest('hex'); }

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      if (urlPath.startsWith('/swarm')) urlPath = urlPath.slice('/swarm'.length) || '/';
      if (urlPath === '/') urlPath = '/index.html';
      const fp = join(DIST_DIR, urlPath);
      if (existsSync(fp) && statSync(fp).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
        res.end(readFileSync(fp));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(DIST_DIR, 'index.html')));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[serve] http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
  });
}

function intersects(a, b) {
  if (!a || !b) return false;
  const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  return ox >= 4 && oy >= 4;
}

/**
 * Get computed bounding rects for elements matching a CSS selector.
 * Returns a flat array of geometry objects.
 */
async function getRects(page, label, selector) {
  return page.evaluate(({ sel, lb }) => {
    const els = document.querySelectorAll(sel);
    return Array.from(els).map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        label: lb,
        tag: el.tagName,
        id: el.id,
        cls: (el.className || '').slice(0, 100),
        text: ((el.textContent || '').trim().slice(0, 50) || lb),
        visible: el.checkVisibility ? el.checkVisibility() : true,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        zi: parseInt(s.zIndex) || 0,
        sw: el.scrollWidth,
        cw: el.clientWidth,
        overflowX: s.overflowX,
        overflowY: s.overflowY,
      };
    });
  }, { sel: selector, lb: label });
}

async function runAudit(page, viewport, label) {
  const { width, height } = viewport;
  console.log(`\n═══ AUDIT: ${label} (${width}×${height}) ═══\n`);

  await page.setViewportSize(viewport);
  await page.goto(`http://127.0.0.1:PORT/swarm/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Screenshot
  const fname = label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
  const spath = join(SCREENSHOT_DIR, fname);
  await page.screenshot({ path: spath, fullPage: false });
  const st = statSync(spath);
  console.log(`  Screenshot:  ${spath}`);
  console.log(`  Dimensions:  ${width}×${height}`);
  console.log(`  Size:        ${(st.size / 1024).toFixed(1)} KB`);
  console.log(`  MD5:         ${md5File(spath)}`);

  // ── 1. Page-level overflow ──
  const po = await page.evaluate(() => ({
    html: {
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    },
    body: {
      sw: document.body.scrollWidth,
      cw: document.body.clientWidth,
    },
  }));
  const htmlOver = po.html.sw > po.html.cw + 1;
  const bodyOver = po.body.sw > po.body.cw + 1;
  console.log(`\n  ● Page overflow:`);
  console.log(`    html: ${htmlOver ? '⚠️  YES' : '✅  no'}  (scrollW=${po.html.sw} clientW=${po.html.cw})`);

  // ── 2. All visible DOM text (ground truth) ──
  const allText = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const s = getComputedStyle(el);
        return el.children.length === 0 &&
          (el.textContent || '').trim().length > 0 &&
          s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0;
      })
      .map(el => (el.textContent || '').trim())
      .filter(t => t.length > 0);
  });
  console.log(`\n  ● Visible DOM text (${allText.length} items):`);
  allText.slice(0, 50).forEach(t => console.log(`    "${t.slice(0, 100)}"`));
  if (allText.length > 50) console.log(`    ... +${allText.length - 50} more`);

  // ── 3. Precise element geometry ──
  // Dashboard layout (MissionControl)
  const sections = [
    // Container
    { sel: 'header', label: 'Top header bar' },
    { sel: 'header + div, header ~ div.flex', label: 'Main split container' },
    { sel: '[class*="w-\\[63%\\]"]', label: 'Left panel (63%)' },
    { sel: '[class*="w-\\[37%\\]"]', label: 'Right panel (37%)' },
    { sel: 'footer, [class*="h-7 shrink-0"][class*="border-t"]', label: 'Status footer' },
    // Chat components in left panel
    { sel: 'textarea', label: 'Chat textarea' },
    { sel: 'button:has(svg.lucide-send-horizonal)', label: 'Send button' },
    // Right panel elements
    { sel: 'h3', label: 'Section headings' },
    { sel: '[class*="grid-cols-2"]', label: 'Agent card grid' },
  ];
  const allRects = [];
  for (const { sel, label: lbl } of sections) {
    const rr = await getRects(page, lbl, sel);
    for (const r of rr) {
      if (!r.visible) continue;
      const ovn = r.sw > r.cw + 1 ? ` ⚠️ +${r.sw - r.cw}px overflow` : '';
      console.log(`    ${lbl}: [${r.x},${r.y} ${r.w}×${r.h}] z=${r.zi}${ovn}`);
      allRects.push(r);
    }
  }

  // ── 4. Intersection scan ──
  console.log(`\n  ● Intersection scan:`);
  const expectedOverlapPrefixes = ['top header', 'main split container'];
  let ic = 0;
  for (let i = 0; i < allRects.length; i++) {
    for (let j = i + 1; j < allRects.length; j++) {
      const a = allRects[i], b = allRects[j];
      if (a.label === b.label) continue;
      if (a.h <= 0 || b.h <= 0 || a.w <= 0 || b.w <= 0) continue;
      // Skip known parent-child nesting
      if (isNested(a, b)) continue;
      // Skip header+main split which are adjacent
      if ((a.label.includes('header') && b.label.includes('split')) ||
          (b.label.includes('header') && a.label.includes('split'))) continue;
      if (!intersects(a, b)) continue;
      console.log(`  ⚠️  "${a.label}" ↔ "${b.label}"`);
      ic++;
    }
  }
  console.log(`  → ${ic} unintended intersections`);

  // ── 4.5 Overflow source investigation ──
  const overflowSources = await page.evaluate(() => {
    // Find right-side panel elements
    const panel = document.querySelector('[class*="w-\\[37%\\]"]') ||
      document.querySelector('aside') ||
      document.querySelectorAll('[class*="overflow-y-auto"]')[1];
    if (!panel) return { found: false };
    const items = [];
    // Walk descendants in the right panel looking for scrollWidth > clientWidth
    const walk = (el, depth) => {
      if (depth > 5) return;
      for (const child of el.children) {
        const s = getComputedStyle(child);
        if (s.display === 'none') continue;
        const sw = child.scrollWidth;
        const cw = child.clientWidth;
        if (sw > cw + 2) {
          items.push({
            tag: child.tagName,
            cls: (child.className || '').slice(0, 80),
            text: ((child.textContent || '').trim().slice(0, 40) || '(no text)'),
            sw, cw, diff: sw - cw,
          });
        }
        walk(child, depth + 1);
      }
    };
    walk(panel, 0);
    return { found: true, items: items.slice(0, 20) };
  });
  if (overflowSources.found && overflowSources.items.length > 0) {
    console.log(`\n  ● Overflow sources (right panel):`);
    for (const s of overflowSources.items) {
      console.log(`    ⚠️  +${s.diff}px  <${s.tag}> ${s.cls ? `class="${s.cls}"` : ''} text="${s.text}"`);
    }
  }

  // ── 5. Header text truncation ──
  const hdrText = await page.evaluate(() => {
    const h = document.querySelector('header');
    if (!h) return [];
    return Array.from(h.querySelectorAll('span')).map(s => ({
      text: (s.textContent || '').trim(),
      sw: s.scrollWidth, cw: s.clientWidth,
      clipped: s.scrollWidth > s.clientWidth + 1,
    })).filter(x => x.text.length > 0);
  });
  console.log(`\n  ● Header text:`);
  for (const t of hdrText) {
    console.log(`    ${t.clipped ? '⚠️ CLIPPED' : '✅ OK'}  "${t.text}" ${t.sw > t.cw + 1 ? `(${t.sw}>${t.cw})` : ''}`);
  }

  // ── 6. Agent card grid width check (mobile) ──
  if (width <= 480) {
    console.log(`\n  ● Mobile agent cards:`);
    const cards = allRects.filter(r => r.label.includes('Agent card'));
    // Also check the actual card elements
    const cardInfo = await page.evaluate(() => {
      // Find the grid container
      const grid = document.querySelector('[class*="grid grid-cols-2"]');
      if (!grid) return { found: false };
      const children = Array.from(grid.children);
      return {
        found: true,
        childCount: children.length,
        childRects: children.map(c => {
          const r = c.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), text: (c.textContent || '').trim().slice(0, 40) };
        }),
        gridRect: { w: grid.clientWidth, h: grid.clientHeight, sw: grid.scrollWidth, cw: grid.clientWidth },
      };
    });
    if (cardInfo.found) {
      for (const c of cardInfo.childRects) {
        const ok = c.w >= 140;
        console.log(`    ${ok ? '✅' : '⚠️'}  card "${c.text}" ${c.w}×${c.h}px ${!ok ? '(may be too narrow)' : ''}`);
      }
      if (cardInfo.gridRect.sw > cardInfo.gridRect.cw + 1) {
        console.log(`  ⚠️  Grid overflow: ${cardInfo.gridRect.sw} > ${cardInfo.gridRect.cw}`);
      }
    }

    console.log(`\n  ● Touch targets (mobile):`);
    // Check specific interactive elements
    const touchCheck = await page.evaluate(() => {
      const targets = [];
      // Header buttons
      document.querySelectorAll('header button').forEach(b => {
        const r = b.getBoundingClientRect();
        targets.push({ name: (b.textContent || '').trim().slice(0, 30) || 'icon button', w: r.width, h: r.height });
      });
      // Send button
      const sendBtn = document.querySelector('button:has(svg.lucide-send-horizonal)');
      if (sendBtn) {
        const r = sendBtn.getBoundingClientRect();
        targets.push({ name: 'send', w: r.width, h: r.height });
      }
      // Agent card buttons
      document.querySelectorAll('[class*="grid grid-cols-2"] button, [class*="grid grid-cols-2"] [role="button"], [class*="grid grid-cols-2"] > div[class*="cursor-pointer"]').forEach(el => {
        const r = el.getBoundingClientRect();
        targets.push({ name: 'agent card', w: r.width, h: r.height });
      });
      // Settings button
      const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerHTML.includes('Settings'));
      if (settingsBtn) {
        const r = settingsBtn.getBoundingClientRect();
        targets.push({ name: 'settings', w: r.width, h: r.height });
      }
      return targets;
    });
    for (const t of touchCheck) {
      const ok = t.w >= 32 && t.h >= 32;
      console.log(`    ${ok ? '✅' : '⚠️'}  "${t.name}" ${t.w}×${t.h}px ${!ok ? '(<32px)' : ''}`);
    }
  }

  return {
    label, spath, md5: md5File(spath),
    htmlOverflow: htmlOver,
    bodyOverflow: bodyOver,
    intersectionCount: ic,
    allRects, hdrText,
  };
}

function isNested(a, b) {
  // A contains B or B contains A
  const aContainsB = a.x <= b.x && a.y <= b.y && a.right >= b.right && a.bottom >= b.bottom;
  const bContainsA = b.x <= a.x && b.y <= a.y && b.right >= a.right && b.bottom >= a.bottom;
  return aContainsB || bContainsA;
}

async function main() {
  if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const { server, port } = await serve();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });

  try {
    const results = [];

    for (const vp of [
      { width: 1280, height: 720, label: 'Desktop 1280x720' },
      { width: 375, height: 812, label: 'Mobile 375x812' },
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.width <= 480,
        hasTouch: vp.width <= 480,
      });
      const page = await ctx.newPage();
      const origGoto = page.goto.bind(page);
      page.goto = (url, opts) => origGoto(url.replace('PORT', port), opts);
      results.push(await runAudit(page, vp, vp.label));
      await ctx.close();
    }

    // Summary
    console.log(`\n══════════════════════════════════════════════`);
    console.log(`  FINAL SUMMARY`);
    console.log(`══════════════════════════════════════════════`);
    for (const r of results) {
      console.log(`\n  ${r.label}`);
      console.log(`    Page overflow:   ${r.htmlOverflow ? '⚠️ YES — DEFECT' : '✅ none'}`);
      console.log(`    Intersections:   ${r.intersectionCount > 0 ? `⚠️ ${r.intersectionCount} — DEFECT` : '✅ none'}`);
      for (const t of r.hdrText || []) {
        if (t.clipped) console.log(`    Header clipped:  ⚠️ "${t.text}"`);
      }
    }

    const defects = [];
    for (const r of results) {
      if (r.htmlOverflow) defects.push(`${r.label}: page overflow`);
      if (r.intersectionCount > 0) defects.push(`${r.label}: ${r.intersectionCount} overlaps`);
      for (const t of r.hdrText || []) {
        if (t.clipped) defects.push(`${r.label}: header text "${t.text}" clipped`);
      }
    }

    if (defects.length === 0) {
      console.log(`\n  ✅ No defects found.`);
    } else {
      console.log(`\n  ⚠️  Defects:`);
      defects.forEach(d => console.log(`       - ${d}`));
    }

    return results;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
