/**
 * Scaffolds new content so contributors don't have to copy files by hand.
 *
 *   npm run new service <id>                  e.g. npm run new service jellyfin
 *   npm run new wiki <group> <english-name> [german-url-slug]
 *       e.g. npm run new wiki 03-containers podman
 *   npm run new guide <stage> <english-name> [german-url-slug]
 *       e.g. npm run new guide 06-operations log-rotation logs-rotieren
 *
 * Folder names are English and language-neutral. The German URL can differ via `slug:` in de.mdx.
 */
import fs from 'node:fs';
import path from 'node:path';

const [kind, a, b, c] = process.argv.slice(2);
const slug = /^[a-z0-9][a-z0-9-]*$/;
const die = (m) => (console.error(`✗ ${m}`), process.exit(1));
const write = (file, content) => {
  if (fs.existsSync(file)) die(`${file} already exists`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`✓ ${file}`);
};
const nextNumber = (dir) => {
  const nums = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => parseInt(f, 10)).filter((n) => !isNaN(n)) : [];
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
};

if (kind === 'service') {
  if (!a || !slug.test(a)) die('Usage: npm run new service <id>  (lowercase, e.g. jellyfin)');
  const dir = `content/services/${a}`;
  const tpl = 'content/services/_template';
  for (const f of fs.readdirSync(tpl)) write(`${dir}/${f}`, fs.readFileSync(`${tpl}/${f}`, 'utf8').replaceAll('myservice', a));
  console.log(`\nNext: fill in ${dir}/service.yaml, compose.yaml, .env.example and de.md. English (en.md) is translated automatically.`);
} else if (kind === 'wiki' || kind === 'guide') {
  const base = kind === 'wiki' ? 'content/wiki' : 'content/guides';
  if (!a || !b || !slug.test(b) || (c && !slug.test(c))) die(`Usage: npm run new ${kind} <folder> <english-name> [german-url-slug]`);
  const groups = fs.readdirSync(base).filter((d) => !d.startsWith('_') && fs.statSync(`${base}/${d}`).isDirectory());
  if (!groups.includes(a)) die(`Folder ${base}/${a} does not exist. Existing: ${groups.join(', ')}`);
  const dir = `${base}/${a}/${nextNumber(`${base}/${a}`)}-${b}`;
  const slugLine = c ? `slug: ${c}\n` : '';
  const fm =
    kind === 'wiki'
      ? `---\n${slugLine}title: Titel des Artikels\ndescription: Ein bis zwei Sätze, worum es geht.\nlevel: 1\nrelated: []\n---\n\n## Erster Abschnitt\n\nText …\n`
      : `---\n${slugLine}title: Titel des Guides\ndescription: Ein bis zwei Sätze, was am Ende läuft.\nlevel: 1\nminutes: 15\nrequires: []\nservices: []\n---\n\n<Steps>\n\n<Step title="Erster Schritt">\nWas zu tun ist und warum.\n\n\`\`\`bash\nmkdir -p __ROOT__/beispiel\n\`\`\`\n</Step>\n\n</Steps>\n`;
  write(`${dir}/de.mdx`, fm);
  console.log('\nEnglish (en.mdx) is added later by DeepL or Claude Code, see CONTRIBUTING.md.');
} else {
  die('Usage: npm run new <service|wiki|guide> …');
}
