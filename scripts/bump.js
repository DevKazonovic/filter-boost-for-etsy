const fs = require('fs');
const path = require('path');

const MANIFEST = path.resolve(__dirname, '..', 'src', 'manifest.json');
const raw = fs.readFileSync(MANIFEST, 'utf8');
const manifest = JSON.parse(raw);

const parts = manifest.version.split('.').map(Number);
if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
  console.error(`version "${manifest.version}" is not major.minor.patch`);
  process.exit(1);
}

const next = [parts[0], parts[1], parts[2] + 1].join('.');
fs.writeFileSync(MANIFEST, raw.replace(`"version": "${manifest.version}"`, `"version": "${next}"`));
console.log(`${manifest.version} -> ${next}`);
