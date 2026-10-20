// Fails when a page, stylesheet or post entry points at a local file that does not exist.
// Checks href/src in the HTML pages, url() in the stylesheets and the POSTS slugs in config.js.
import fs from 'node:fs';
import path from 'node:path';

const pages = ['index.html', '404.html', ...fs.readdirSync('posts').filter(f => f.endsWith('.html')).map(f => 'posts/' + f)];
const styles = fs.readdirSync('css').filter(f => f.endsWith('.css')).map(f => 'css/' + f);
// %23 is '#' inside inline SVG data URLs (a filter reference, not a file)
const external = /^(https?:|mailto:|tel:|data:|javascript:|#|%23|\/\/)/;
const missing = [];

function check(from, ref) {
  if (!ref || external.test(ref) || ref.includes('${')) return;
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return;
  // "/" and "../" both mean the site root here (404.html links home with "/")
  const target = clean === '/' ? 'index.html' : path.join(path.dirname(from), clean);
  const file = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
  if (!fs.existsSync(file)) missing.push(`${from}: ${ref}`);
}

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const [, ref] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) check(page, ref);
}
for (const sheet of styles) {
  const css = fs.readFileSync(sheet, 'utf8');
  for (const [, ref] of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) check(sheet, ref);
}
const config = fs.readFileSync('js/config.js', 'utf8');
for (const [, slug] of config.matchAll(/slug:\s*'([^']+)'/g)) check('js/config.js', `../posts/${slug}.html`);

if (missing.length) {
  console.error('Missing local files:\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log(`Links OK (${pages.length} pages, ${styles.length} stylesheets)`);
