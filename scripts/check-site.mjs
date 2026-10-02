import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';

const root = resolve('dist');
assert.ok(existsSync(join(root, 'index.html')), '先运行 npm run build');
function htmlFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : extname(path) === '.html' ? [path] : [];
  });
}

const pages = htmlFiles(root);
let checkedLinks = 0;
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const pageUrl = new URL(relative(root, file).replaceAll('\\', '/').replace(/index\.html$/, ''), 'https://yzaziy.cn/');
  for (const tag of html.matchAll(/<(?:a|img|script|link|source|video)\b[^>]*>/g)) {
    const value = tag[0].match(/\b(?:href|src)="([^"]+)"/)?.[1];
    if (!value || /^(?:mailto:|tel:|data:)/.test(value)) continue;
    const url = new URL(value.replaceAll('&amp;', '&'), pageUrl);
    if (url.origin !== pageUrl.origin) continue;
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    assert.ok(path === root || path.startsWith(root + '\\') || path.startsWith(root + '/'), `路径越界：${value}`);
    const target = extname(path) ? path : join(path, 'index.html');
    assert.ok(existsSync(target), `${relative(root, file)} 的资源或链接不存在：${value}`);
    if (url.hash && extname(target) === '.html') {
      const id = decodeURIComponent(url.hash.slice(1));
      assert.ok(readFileSync(target, 'utf8').includes(`id="${id}"`), `锚点不存在：${value}`);
    }
    checkedLinks++;
  }
}

const home = readFileSync(join(root, 'index.html'), 'utf8');
const posts = readdirSync('src/content/blog').filter((file) => file.endsWith('.md')).map((file) => {
  const text = readFileSync(join('src/content/blog', file), 'utf8');
  const field = (key) => text.match(new RegExp(`^${key}:\\s*"?([^"\\n\\r]+)`, 'm'))?.[1].trim();
  const title = field('title');
  const pubDate = field('pubDate');
  assert.ok(title && field('description') && pubDate, `${file} 缺少文章元数据`);
  const href = field('customUrl') || `/blog/${file.replace(/\.md$/, '')}`;
  assert.ok(home.includes(`href="${href}"`), `首页未同步文章：${file}`);
  assert.ok(home.includes(title), `首页标题未同步：${file}`);
  return { title, date: Date.parse(pubDate) };
});
const positions = posts.map((post) => ({ ...post, position: home.indexOf(post.title) })).sort((a, b) => a.position - b.position);
for (let i = 1; i < positions.length; i++) {
  assert.ok(positions[i - 1].date >= positions[i].date, '首页文章未按发布日期倒序');
}
console.log(`检查通过：${pages.length} 个页面、${checkedLinks} 个站内链接与资源、${posts.length} 篇首页文章。`);
