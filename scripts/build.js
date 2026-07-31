const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const problems = [];
const fail = (message) => problems.push(message);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pngSize(file) {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  if (head.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full)];
  });
}

const manifest = readJson(path.join(SRC, 'manifest.json'));
const files = walk(SRC);

if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail(`version "${manifest.version}" is not major.minor.patch`);
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (!manifest.default_locale) fail('default_locale is missing');

const locales = fs.readdirSync(path.join(SRC, '_locales'));
if (!locales.includes(manifest.default_locale)) fail(`default_locale "${manifest.default_locale}" has no _locales folder`);

const messages = readJson(path.join(SRC, '_locales', manifest.default_locale, 'messages.json'));
const baseKeys = Object.keys(messages).sort().join(',');
for (const locale of locales) {
  const entries = readJson(path.join(SRC, '_locales', locale, 'messages.json'));
  if (Object.keys(entries).sort().join(',') !== baseKeys) fail(`_locales/${locale} does not match _locales/${manifest.default_locale}`);
  for (const [key, entry] of Object.entries(entries)) {
    if (!entry.message || !entry.message.trim()) fail(`_locales/${locale}: "${key}" is empty`);
  }
  if (entries.extName.message.length > 45) fail(`_locales/${locale}: name exceeds 45 characters`);
  if (entries.extDescription.message.length > 132) fail(`_locales/${locale}: description exceeds 132 characters`);
}

for (const token of JSON.stringify(manifest).match(/__MSG_([A-Za-z0-9_]+)__/g) || []) {
  const key = token.slice(6, -2);
  if (!(key in messages)) fail(`manifest references missing message "${key}"`);
}

for (const [size, file] of Object.entries(manifest.icons)) {
  const full = path.join(SRC, file);
  if (!fs.existsSync(full)) {
    fail(`icon ${file} is missing`);
    continue;
  }
  const dimensions = pngSize(full);
  if (!dimensions) fail(`icon ${file} is not a PNG`);
  else if (dimensions.width !== Number(size) || dimensions.height !== Number(size)) {
    fail(`icon ${file} is ${dimensions.width}x${dimensions.height}, expected ${size}x${size}`);
  }
}

const referenced = [manifest.background.service_worker, manifest.action.default_popup];
for (const file of referenced) {
  if (!fs.existsSync(path.join(SRC, file))) fail(`${file} referenced by the manifest is missing`);
}

const junk = files.filter((file) => path.basename(file).startsWith('.') || file.endsWith('.map'));
if (junk.length) fail(`remove before packaging: ${junk.join(', ')}`);

const risky = ['tabs', 'webRequest', 'declarativeNetRequestFeedback', '<all_urls>'];
for (const permission of [...(manifest.permissions || []), ...(manifest.host_permissions || [])]) {
  if (risky.includes(permission)) fail(`permission "${permission}" will slow store review, drop it if unused`);
}

if (problems.length) {
  console.error('Package validation failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });
const slug = messages.extName.message.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const zipPath = path.join(DIST, `${slug}-${manifest.version}.zip`);
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-r', '-X', '-q', zipPath, '.', '-x', '.*', '-x', '*/.*'], { cwd: SRC });

const size = fs.statSync(zipPath).size;
console.log(`${manifest.version}  ${files.length} files  ${(size / 1024).toFixed(1)} KB`);
console.log(path.relative(process.cwd(), zipPath));
