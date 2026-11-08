import fs from 'node:fs/promises'
import path from 'node:path'
const root = path.resolve('dist'),
  assets = path.join(root, 'assets')
const html = await fs.readFile(path.join(root, 'index.html'), 'utf8')
const files = await fs.readdir(assets)
const js = await fs.readFile(
  path.join(
    assets,
    files.find((n) => /^index-.*\.js$/.test(n)),
  ),
  'utf8',
)
let css = await fs.readFile(
  path.join(
    assets,
    files.find((n) => n.endsWith('.css')),
  ),
  'utf8',
)
function mime(name) {
  return name.endsWith('.svg')
    ? 'image/svg+xml'
    : name.endsWith('.woff2')
      ? 'font/woff2'
      : 'font/woff'
}
async function uri(file) {
  return (
    'data:' +
    mime(file) +
    ';base64,' +
    (await fs.readFile(file)).toString('base64')
  )
}
for (const match of [...css.matchAll(/url\(([^)]+)\)/g)]) {
  const filename = match[1].replace(/^["']|["']$/g, '')
  if (!filename.startsWith('data:')) {
    const data = await uri(path.resolve(assets, filename))
    css = css.replace(match[0], () => 'url(' + data + ')')
  }
}
const images = {}
for (const name of await fs.readdir(path.join(root, 'art')))
  images[name] = await uri(path.join(root, 'art', name))
const escapeScript = (s) => s.replace(/<\/script/gi, '<\\/script')
const setup = 'window.__fwStandalone=true;window.__fwAssets=' + JSON.stringify(images) + ';'
const offline = html
  .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, '')
  .replace(/<link rel="stylesheet"[^>]*>/, '')
  .replace('./art/mark.svg', images['mark.svg'])
  .replace('</head>', () => '<style>' + css + '</style></head>')
  .replace(
    '</body>',
    () =>
      '<script>' +
      escapeScript(setup) +
      '</script><script type="module">' +
      escapeScript(js) +
      '</script></body>',
  )
await fs.writeFile('PLAY.html', offline)
console.log(
  'Created self-contained PLAY.html, ' +
    Math.round(Buffer.byteLength(offline) / 1024) +
    ' KiB',
)
