#!/usr/bin/env node

/**
 * inspect-visual.mjs — Programmatic visual inspection of the built app
 *
 * Launches the preview server, takes screenshots at desktop/mobile,
 * then extracts all computed layout, color, text, spacing, and overflow
 * info from the DOM. Reports concrete findings.
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';
import { existsSync } from 'fs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const BASE_URL = 'http://127.0.0.1:5199/swarm/';
const SCREENSHOT_DIR = join(ROOT, 'docs', 'screenshots');

async function inspect() {
  // Start preview server
  const server = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '5199'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview server did not start')), 15000);
    const handler = (d) => {
      if (d.toString().includes('Local')) {
        clearTimeout(timeout);
        setTimeout(resolve, 1500);
      }
    };
    server.stdout.on('data', handler);
    server.stderr.on('data', handler);
  });

  console.log('=== VISUAL INSPECTION ===\n');

  const browser = await chromium.launchPersistentContext(
    join(ROOT, 'test-output', 'viz-inspect-' + Date.now()),
    { headless: true, args: ['--no-sandbox'] },
  );
  const page = await browser.newPage();

  // --- DESKTOP ---
  console.log('DESKTOP (1280x720):');
  console.log('-'.repeat(40));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  const desktopLayout = await page.evaluate(() => {
    const results = { panels: [], colors: {}, overflow: [], textElements: [] };

    // Color scheme
    const body = window.getComputedStyle(document.body);
    const html = window.getComputedStyle(document.documentElement);
    results.colors.bodyBg = body.backgroundColor;
    results.colors.bodyColor = body.color;
    results.colors.htmlBg = html.backgroundColor;
    results.colors.font = body.fontFamily;

    // Extract all visible text elements with positions and styles
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || '').trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      results.textElements.push({
        text: text.slice(0, 80),
        tag: el.tagName,
        x: rect.x | 0, y: rect.y | 0,
        w: rect.width | 0, h: rect.height | 0,
        color: style.color,
        bg: style.backgroundColor,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        textAlign: style.textAlign,
        padding: style.padding,
        margin: style.margin,
        fontFamily: style.fontFamily,
      });
    }

    // Main layout panels
    const mainEls = document.querySelectorAll('header, main, aside, nav, section, div[class*="sidebar"], div[class*="panel"], div[class*="main"], div[class*="content"]');
    for (const el of mainEls) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) continue;
      const style = window.getComputedStyle(el);
      results.panels.push({
        tag: el.tagName,
        cls: (el.className || '').toString().slice(0, 80),
        x: rect.x | 0, y: rect.y | 0,
        w: rect.width | 0, h: rect.height | 0,
        bg: style.backgroundColor,
        border: style.border,
        borderRadius: style.borderRadius,
        display: style.display,
        flexDirection: style.flexDirection,
        gap: style.gap,
        padding: style.padding,
        margin: style.margin,
      });
    }

    // Overflow check
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const s = window.getComputedStyle(el);
      if (s.overflow && s.overflow !== 'visible') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 &&
            (el.scrollWidth > r.width + 5 || el.scrollHeight > r.height + 5)) {
          results.overflow.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 40),
            client: r.width + 'x' + r.height,
            scroll: el.scrollWidth + 'x' + el.scrollHeight,
            overflow: s.overflow,
            text: (el.textContent || '').trim().slice(0, 40),
          });
        }
      }
    }

    return results;
  });

  // Print DESKTOP report
  console.log('\nColor Scheme:');
  console.log('  body bg:', desktopLayout.colors.bodyBg);
  console.log('  body text:', desktopLayout.colors.bodyColor);
  console.log('  html bg:', desktopLayout.colors.htmlBg);
  console.log('  font:', desktopLayout.colors.font);

  console.log('\nLayout Panels:');
  const sortedPanels = desktopLayout.panels.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of sortedPanels.slice(0, 30)) {
    console.log(`  [${p.tag}] y=${p.y} x=${p.x} ${p.w}x${p.h} bg=${p.bg} display=${p.display} gap=${p.gap} cls="${p.cls.slice(0, 50)}"`);
    if (p.border && p.border !== '0px none rgb(0, 0, 0)') console.log(`    border: ${p.border} radius: ${p.borderRadius}`);
    if (p.padding && p.padding !== '0px') console.log(`    padding: ${p.padding}`);
  }

  console.log('\nVisible Text Elements:');
  const sortedText = desktopLayout.textElements.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const t of sortedText.slice(0, 50)) {
    console.log(`  y=${t.y} x=${t.x} "${t.text}" [${t.tag}] color=${t.color} bg=${t.bg} fs=${t.fontSize} fw=${t.fontWeight} ta=${t.textAlign}`);
    if (t.padding && t.padding !== '0px') console.log(`    padding: ${t.padding}`);
    if (t.margin && t.margin !== '0px') console.log(`    margin: ${t.margin}`);
  }

  if (desktopLayout.overflow.length > 0) {
    console.log('\nOVERFLOW ISSUES:');
    for (const o of desktopLayout.overflow) {
      console.log(`  [${o.tag}] "${o.text}" client=${o.client} scroll=${o.scroll} overflow=${o.overflow}`);
    }
  } else {
    console.log('\nNo overflow issues detected');
  }

  // --- MOBILE ---
  console.log('\n\nMOBILE (375x812):');
  console.log('-'.repeat(40));

  await page.setViewportSize({ width: 375, height: 812 });
  await sleep(500);

  const mobileLayout = await page.evaluate(() => {
    const results = { panels: [], textElements: [], overflow: [] };

    // Panels
    const mainEls = document.querySelectorAll('header, main, aside, nav, section, div[class*="sidebar"], div[class*="panel"], div[class*="main"], div[class*="content"]');
    for (const el of mainEls) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) continue;
      results.panels.push({
        tag: el.tagName,
        cls: (el.className || '').toString().slice(0, 60),
        x: rect.x | 0, y: rect.y | 0,
        w: rect.width | 0, h: rect.height | 0,
        display: window.getComputedStyle(el).display,
        flexDirection: window.getComputedStyle(el).flexDirection,
      });
    }

    // Text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || '').trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      results.textElements.push({
        text: text.slice(0, 50),
        tag: el.tagName,
        x: rect.x | 0, y: rect.y | 0,
        w: rect.width | 0, h: rect.height | 0,
        color: style.color,
        fs: style.fontSize,
        fw: style.fontWeight,
      });
    }

    // Overflow
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const s = window.getComputedStyle(el);
      if (s.overflow && s.overflow !== 'visible') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 &&
            (el.scrollWidth > r.width + 5 || el.scrollHeight > r.height + 5)) {
          results.overflow.push({
            tag: el.tagName,
            client: r.width + 'x' + r.height,
            scroll: el.scrollWidth + 'x' + el.scrollHeight,
            text: (el.textContent || '').trim().slice(0, 30),
          });
        }
      }
    }

    return results;
  });

  console.log('\nLayout Panels:');
  const mPanels = mobileLayout.panels.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of mPanels.slice(0, 25)) {
    console.log(`  [${p.tag}] y=${p.y} x=${p.x} ${p.w}x${p.h} display=${p.display} dir=${p.flexDirection || '-'}`);
  }

  console.log('\nVisible Text:');
  const mText = mobileLayout.textElements.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const t of mText.slice(0, 40)) {
    console.log(`  y=${t.y} x=${t.x} "${t.text}" [${t.tag}] ${t.w}x${t.h} c=${t.color} fs=${t.fs} fw=${t.fw}`);
  }

  if (mobileLayout.overflow.length > 0) {
    console.log('\nOVERFLOW ISSUES:');
    for (const o of mobileLayout.overflow) {
      console.log(`  [${o.tag}] "${o.text}" client=${o.client} scroll=${o.scroll}`);
    }
  } else {
    console.log('\nNo overflow issues detected');
  }

  await browser.close();
  server.kill('SIGTERM');
  await sleep(500);
  console.log('\n=== INSPECTION COMPLETE ===');
}

inspect().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
