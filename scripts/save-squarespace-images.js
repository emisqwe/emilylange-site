// Downloads every image listed in image-sources.json into src/images/.
// Run once (via the GitHub "Save Squarespace images" action) BEFORE cancelling Squarespace.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'image-sources.json'), 'utf8'));

(async () => {
  let saved = 0, skipped = 0, failed = [];
  for (const [local, url] of Object.entries(sources)) {
    const dest = path.join(ROOT, 'src', local.replace(/^\/+/, ''));
    if (fs.existsSync(dest)) { skipped++; continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      saved++;
      console.log('saved', local);
    } catch (e) {
      failed.push(`${local} (${e.message})`);
    }
  }
  console.log(`\n${saved} saved, ${skipped} already here, ${failed.length} failed`);
  if (failed.length) { console.log(failed.join('\n')); process.exitCode = 1; }
})();
