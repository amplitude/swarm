import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const DEPLOY_URL = 'https://vigilant-adventure-pzzr7n9.pages.github.io/';
const REPO = 'amplitude/swarm';
const SHA = execSync('git rev-parse HEAD').toString().trim();

async function main() {
  console.log(`\n=== Remote deploy verification for ${REPO}@${SHA} ===`);
  console.log(`URL: ${DEPLOY_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => consoleLogs.push({ type: 'error', text: err.message }));

  // Navigate
  console.log('Navigating to deployed URL...');
  let response;
  try {
    response = await page.goto(DEPLOY_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log(`Navigation error: ${e.message}`);
  }

  const statusCode = response?.status() || 'unknown';
  const finalUrl = page.url();
  console.log(`\nHTTP status: ${statusCode}`);
  console.log(`Final URL: ${finalUrl}`);

  // Screenshot
  await page.screenshot({ path: 'scripts/deploy-verify-remote.png', fullPage: false });
  console.log('Screenshot saved to scripts/deploy-verify-remote.png');

  // Network requests
  const networkRequests = [];
  page.on('request', req => networkRequests.push({ url: req.url(), status: 'sent' }));
  page.on('requestfinished', req => networkRequests.push({ url: req.url(), status: 'done' }));
  page.on('requestfailed', req => networkRequests.push({ url: req.url(), status: 'failed', error: req.failure()?.errorText }));

  // Console output
  console.log('\n=== Console output ===');
  for (const log of consoleLogs.slice(0, 20)) {
    console.log(`[${log.type}] ${log.text.substring(0, 300)}`);
  }
  if (consoleLogs.length > 20) {
    console.log(`... and ${consoleLogs.length - 20} more`);
  }

  // Check for redirect to login
  if (finalUrl.includes('github.com/login') || finalUrl.includes('github.com/session')) {
    console.log('\n⚠ Site redirects to GitHub login — private Pages site.');
    
    // Try authenticated request with GH token
    console.log(`\nTrying authenticated request with token...`);
    
    const curlResult = execSync(`curl -s -o /dev/null -w "%{http_code} %{url_effective}" -H "Authorization: token $(gh auth token)" "${DEPLOY_URL}"`, { encoding: 'utf8', timeout: 15000 });
    console.log(`Curl HTTP status: ${curlResult}`);
    
    // Check actual content with token
    const contentResult = execSync(`curl -s -H "Authorization: token $(gh auth token)" "${DEPLOY_URL}"`, { encoding: 'utf8', timeout: 15000 });
    const isHTML = contentResult.includes('<!DOCTYPE html>') || contentResult.includes('<html');
    console.log(`Content is HTML: ${isHTML}`);
    console.log(`Content length: ${contentResult.length}`);
    
    if (isHTML) {
      const titleMatch = contentResult.match(/<title>([^<]+)<\/title>/i);
      console.log(`Title: ${titleMatch ? titleMatch[1] : 'none found'}`);
      const hasRoot = contentResult.includes('id="root"');
      console.log(`Has React root: ${hasRoot}`);
      const swarmRefs = (contentResult.match(/\/swarm\//g) || []).length;
      console.log(`/swarm/ references in HTML: ${swarmRefs}`);
      const manifestMatch = contentResult.match(/href="([^"]*manifest[^"]*)"/);
      console.log(`Manifest href: ${manifestMatch ? manifestMatch[1] : 'none'}`);
      const iconMatch = contentResult.match(/icon-192\.png/g);
      console.log(`icon-192.png references: ${iconMatch ? iconMatch.length : 0}`);
      
      // Check start_url in manifest
      if (contentResult.includes('start_url')) {
        const startUrlMatch = contentResult.match(/"start_url"\s*:\s*"([^"]+)"/);
        console.log(`Manifest start_url: ${startUrlMatch ? startUrlMatch[1] : 'none found'}`);
      }
    } else {
      console.log('Content snippet:', contentResult.substring(0, 300));
    }
  } else {
    // We actually got through!
    console.log('\n✅ SUCCESS: Site is accessible!');
    
    const hasRoot = await page.$('#root');
    console.log(`Has React root: ${!!hasRoot}`);
    
    // Try to get page text
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || 'no body');
    console.log(`Body text: ${bodyText}`);
    
    // Reload for service worker test
    console.log('\nReloading to test service worker...');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    console.log('Reload complete');
    
    // Check for sw
    const swInfo = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker?.getRegistrations();
      return registrations?.map(r => ({
        scope: r.scope,
        active: r.active?.state,
        installing: r.installing?.state,
        waiting: r.waiting?.state,
      })) || [];
    });
    console.log(`Service workers: ${JSON.stringify(swInfo)}`);
  }

  await browser.close();
  console.log('\n=== Remote verification complete ===');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
