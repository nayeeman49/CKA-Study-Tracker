// Splits content/guide-src/*.md bundles ("@@ <lesson id>" delimiters) into content/guides/<id with __>.md
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'content', 'guide-src'), out = path.join(__dirname, '..', 'content', 'guides');
fs.mkdirSync(out, { recursive: true });
const cur = require('../data/curriculum.json');
const ids = new Set(cur.sections.flatMap(s => s.lessons.map(l => l.id)));
let n = 0; const seen = new Set(); const bundle = {};
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.md')).sort()) {
  const parts = fs.readFileSync(path.join(src, f), 'utf8').split(/^@@(\+?) (.+)$/m);
  for (let i = 1; i < parts.length; i += 3) {
    const add = parts[i] === '+', id = parts[i + 1].trim();
    let body = parts[i + 2].trim();
    if (add && bundle[id]) body = bundle[id].trim() + '\n\n' + body;
    if (/^14-Lightning/.test(id)) continue;
    if (!ids.has(id)) { console.error('UNKNOWN id', id, 'in', f); process.exitCode = 1; continue; }
    fs.writeFileSync(path.join(out, id.replace(/\//g, '__') + '.md'), body + '\n'); bundle[id] = body + '\n'; seen.add(id); n++;
  }
}
fs.writeFileSync(path.join(__dirname, '..', 'content', 'guides.json'), JSON.stringify(bundle));
const missing = [...ids].filter(i => !seen.has(i));
console.log(n + ' guides written; missing:', missing.length, missing.slice(0, 200).join('\n'));
