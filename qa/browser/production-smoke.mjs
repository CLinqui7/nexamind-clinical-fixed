import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';

const base = process.env.LINKARE_PRODUCTION_URL || 'https://nexamind-clinical.vercel.app';
const durations = [];
let html = '';
for (let index = 0; index < 10; index += 1) {
  const started = performance.now();
  const response = await fetch(`${base}/?production-smoke=${index}`, { redirect: 'follow' });
  durations.push(performance.now() - started);
  assert.equal(response.status, 200);
  if (!html) html = await response.text();
  else await response.arrayBuffer();
}
const assetPath = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
assert.ok(assetPath, 'Production HTML did not reference the application bundle.');
const bundleResponse = await fetch(new URL(assetPath, base));
assert.equal(bundleResponse.status, 200);
const bundle = await bundleResponse.text();
assert.ok(bundle.includes('fvucylgrqgxjqabacnlt.supabase.co'));
assert.ok(bundle.includes('linkare_patient_directory_v1'));
assert.ok(bundle.includes('linkare_profile_assets_v1'));

const browser = await chromium.launch({
  channel: process.env.LINKARE_BROWSER || 'msedge',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => failedRequests.push(request.failure()?.errorText || 'failed'));
const started = performance.now();
await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
const usableMs = performance.now() - started;
await page.getByRole('button', { name: 'Ingresar a Linkare', exact: true }).waitFor();
assert.deepEqual(pageErrors, []);
assert.deepEqual(consoleErrors, []);
assert.deepEqual(failedRequests, []);
const navigation = await page.evaluate(() => {
  const entry = performance.getEntriesByType('navigation')[0];
  return entry ? {
    domContentLoadedMs: entry.domContentLoadedEventEnd,
    loadMs: entry.loadEventEnd,
    transferBytes: entry.transferSize,
  } : null;
});
await browser.close();

durations.sort((left, right) => left - right);
const percentile = (fraction) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * fraction) - 1)];
console.log(JSON.stringify({
  url: base,
  status: 'PASS',
  htmlRequests: {
    samples: durations.length,
    p50Ms: Number(percentile(0.5).toFixed(2)),
    p95Ms: Number(percentile(0.95).toFixed(2)),
    maxMs: Number(durations.at(-1).toFixed(2)),
  },
  browser: {
    usableMs: Number(usableMs.toFixed(2)),
    navigation,
    pageErrors: 0,
    consoleErrors: 0,
    failedRequests: 0,
  },
  contracts: ['production Supabase URL', 'paginated directory RPC', 'lazy profile assets RPC'],
}, null, 2));
