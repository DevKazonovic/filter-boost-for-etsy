const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PROFILE = path.join(ROOT, '.dev-profile');

const HEADLESS = process.argv.includes('--headless');
const START_URL = process.argv.includes('--blank') ? 'about:blank' : 'https://www.etsy.com/search?q=stickers';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toTimeString().slice(0, 8);
const log = (message) => console.log(`[${stamp()}] ${message}`);

async function findWorker(browser, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const target = browser.targets().find((t) => t.type() === 'service_worker');
    if (target) {
      const worker = await target.worker().catch(() => null);
      const ready = worker
        ? await worker.evaluate(() => typeof chrome !== 'undefined' && Boolean(chrome.runtime)).catch(() => false)
        : false;
      if (ready) return worker;
    }
    await sleep(150);
  }
  return null;
}

(async () => {
  fs.mkdirSync(PROFILE, { recursive: true });

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    channel: process.env.DEV_CHANNEL || undefined,
    userDataDir: PROFILE,
    defaultViewport: null,
    args: [
      `--disable-extensions-except=${SRC}`,
      `--load-extension=${SRC}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let worker = await findWorker(browser);
  if (!worker) {
    console.error('The extension service worker never started, is src/ a valid extension?');
    await browser.close();
    process.exit(1);
  }
  const { name, version } = await worker.evaluate(() => chrome.runtime.getManifest());
  log(`${name} ${version} loaded from src/`);

  if (!HEADLESS) {
    const [page] = await browser.pages();
    await (page || (await browser.newPage())).goto(START_URL).catch(() => {});
  }

  let timer = null;
  let reloading = false;

  async function fire() {
    try {
      await worker.evaluate(() => setTimeout(() => chrome.runtime.reload(), 0));
      return true;
    } catch {
      return false;
    }
  }

  async function reload(reason) {
    if (reloading) return;
    reloading = true;

    let sent = await fire();
    if (!sent) {
      const fresh = await findWorker(browser, 5000);
      if (fresh) {
        worker = fresh;
        sent = await fire();
      }
    }
    log(sent ? `reloaded after ${reason}` : `could not reload after ${reason}`);

    await sleep(600);
    const next = await findWorker(browser, 8000);
    if (next) {
      worker = next;
      const version = await next.evaluate(() => chrome.runtime.getManifest().version).catch(() => null);
      if (version) log(`now running ${version}`);
    }

    reloading = false;
  }

  const watcher = fs.watch(SRC, { recursive: true }, (_event, file) => {
    if (file && path.basename(file).startsWith('.')) return;
    clearTimeout(timer);
    timer = setTimeout(() => reload(file || 'a change'), 150);
  });
  watcher.on('error', (error) => log(`watch error: ${error.message}`));

  log(`watching ${path.relative(ROOT, SRC)}/ for changes, ctrl-c to stop`);

  browser.on('disconnected', () => {
    watcher.close();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    watcher.close();
    await browser.close().catch(() => {});
    process.exit(0);
  });
})();
