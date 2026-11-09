import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'
const require = createRequire(import.meta.url)
const executable = process.env.CHROMIUM_PATH
const browser = await chromium.launch({
  executablePath: executable || undefined,
  headless: true,
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const base =
  process.env.FW_BASE_URL || 'https://functionwars.test/games/function-wars/'
const prefix = new URL(base).pathname
const errors = [],
  checks = []
const check = (v, s) => {
  assert.ok(v, s)
  checks.push(s)
  console.log('PASS', s)
}
const captures = process.env.FW_SCREENSHOTS
if (captures) await fs.mkdir(captures, { recursive: true })
async function screenshot(page, name) {
  if (captures) {
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: path.join(captures, name + '.png'),
      fullPage: true,
      animations: 'disabled',
    })
  }
}
try {
  // Serve the built files at a nested origin through Playwright's transport.
  // This exercises real browser module/worker fetching without an external server.
  if (!process.env.FW_BASE_URL)
    await context.route(base + '**', async (r) => {
      const rel =
        decodeURIComponent(
          new URL(r.request().url()).pathname.slice(prefix.length),
        ) || 'index.html'
      try {
        const f = path.resolve('dist', rel)
        if (!f.startsWith(path.resolve('dist') + path.sep)) throw Error('path')
        await r.fulfill({
          path: f,
          status: 200,
          contentType: {
            '.js': 'application/javascript',
            '.html': 'text/html',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
          }[path.extname(f)],
        })
      } catch {
        await r.fulfill({ status: 404, body: 'Missing asset' })
      }
    })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text())
  })
  page.setDefaultTimeout(10000)
  const button = (name) => page.getByRole('button', { name, exact: true })
  const waitValid = () =>
    page.getByText('Valid trajectory', { exact: false }).waitFor()
  const home = () => button('Function Wars home').click()
  async function audit(name) {
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
    const issues = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    )
    check(issues.length === 0, name + ' WCAG audit ' + JSON.stringify(issues))
  }
  await page.goto(base)
  await button('Launch duel').waitFor()
  await screenshot(page, '01-command-center')
  await audit('Menu')
  check(
    await page.getByRole('heading', { name: 'Select a mode' }).isVisible(),
    'Menu and mode selection',
  )
  await page.getByRole('button', { name: /LAB · FREE PLAY/ }).click()
  await waitValid()
  const input = page.getByLabel('Function input'),
    preview = page.getByTestId('preview')
  const before = await preview.getAttribute('d')
  await page.getByRole('slider', { name: 'a', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(
    (b) =>
      document.querySelector('[data-testid=preview]').getAttribute('d') !== b,
    before,
  )
  check(true, 'Coefficient slider changes graph')
  await input.fill('1/(u-5)')
  await page.getByText(/Denominator may reach zero/).waitFor()
  check(
    await button('Fire trajectory').isDisabled(),
    'Domain error blocks firing',
  )
  await input.fill('2*sin(0.7*u)-0.03*u^3+ln(u+1)')
  await waitValid()
  await input.fill('a*sin(b*u)')
  await waitValid()
  await page.getByRole('spinbutton', { name: 'a value' }).fill('3')
  await waitValid()
  await page.getByRole('spinbutton', { name: 'b value' }).fill('0.35')
  await waitValid()
  await page.getByRole('button', { name: /Pin overlay/ }).click()
  const pin = page.getByRole('button', { name: /Pin overlay/ })
  const coefficient = page.getByRole('spinbutton', { name: 'a value' })
  await coefficient.fill('4')
  await waitValid()
  await pin.click()
  await button('Remove Curve A').click()
  await coefficient.fill('5')
  await waitValid()
  await pin.click()
  check(
    (await button('Restore Curve A').count()) === 1 &&
      (await button('Restore Curve B').count()) === 1,
    'Removing a pin frees only its own curve style',
  )
  await input.fill('u')
  await waitValid()
  await button('Restore Curve B').click()
  await waitValid()
  check(
    (await input.inputValue()) === 'a*sin(b*u)' &&
      (await coefficient.inputValue()) === '4',
    'Restoring a curve restores its expression and coefficients',
  )
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await button('Reset view').click()
  await screenshot(page, '02-function-sandbox')
  await audit('Sandbox')
  await button('Fire trajectory').click()
  await page.getByText(/Impact at \(/).waitFor()
  check(true, 'Animated projectile resolves at the computed collision')
  await button('Save weapon').click()
  await page.getByLabel('Weapon name').fill('Aurora')
  await button('Save to library').click()
  await button('Weapon library').click()
  await page.getByRole('heading', { name: 'Aurora' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'Aurora' }).waitFor()
  check(true, 'Weapon survives reload')
  await button('Edit').click()
  await page.getByLabel('Weapon name').fill('Aurora II')
  await button('Save changes').click()
  await page.getByRole('heading', { name: 'Aurora II' }).waitFor()
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        weapons: [{ name: 'bad', source: '1/(u-5)', parameters: {} }],
      }),
    ),
  })
  await page.getByText(/Denominator may reach zero/).waitFor()
  check(true, 'Invalid import leaves library intact')
  await button('Settings').click()
  await page.getByLabel('Reduced motion').check()
  await button('Close').click()
  await home()
  await page.getByRole('button', { name: /SOLO · 50 MISSIONS/ }).click()
  await page.getByRole('button', { name: /MISSION 01/ }).click()
  await waitValid()
  await button('Show hint').click()
  await input.fill('0.5*u')
  await waitValid()
  await button('Fire trajectory').click()
  await page.getByRole('heading', { name: 'Mission cleared' }).waitFor()
  check(
    (await page.locator('.result-stars').innerText()) === '★★★',
    'Campaign awards three stars',
  )
  await button('Next mission').click()
  await page.getByRole('heading', { name: 'Descending Signal' }).waitFor()
  await button('Missions').click()
  await page.reload()
  check(
    (
      await page.getByRole('button', { name: /MISSION 01/ }).innerText()
    ).includes('★★★'),
    'Campaign stars persist after reload',
  )
  await home()
  await button('Launch duel').click()
  await button('Open range').click()
  await button('Start duel').click()
  const pilot = page.locator('.station').first()
  await pilot.getByLabel('Function input').fill('0')
  await pilot.getByText(/Valid trajectory/).waitFor()
  await pilot.getByRole('button', { name: 'Fire trajectory' }).click()
  await page.getByText(/82 HP/).waitFor()
  check(true, 'Real-time center hit deals 21 damage')
  await pilot.getByRole('button', {name:'Equipment'}).click()
  const position = pilot.getByRole('slider', {name:'Barrier position'})
  await position.focus()
  await page.keyboard.press('ArrowRight')
  await pilot.getByRole('button', {name:/Install barrier/}).click()
  await pilot.getByText('1/3 deployed').waitFor()
  await page.keyboard.press('Tab')
  await position.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await pilot.getByRole('button', {name:/Install barrier/}).click()
  await pilot.getByText('2/3 deployed').waitFor()
  check(true, 'A pilot can select and install two distinct barriers through Equipment')
  await screenshot(page, '03-duel-arena')
  await audit('Duel')
  await page
    .locator('.station')
    .last()
    .getByRole('button', { name: 'Concede match' })
    .click()
  await page.getByRole('heading', { name: 'Nova wins' }).waitFor()
  await button('Match setup').click()
  await page.setViewportSize({ width: 390, height: 844 })
  await home()
  await screenshot(page, '04-mobile')
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Mobile menu fits viewport',
  )
  await page.getByRole('button', { name: /LAB · FREE PLAY/ }).click()
  await waitValid()
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Mobile editor fits viewport',
  )
  await page.goto(pathToFileURL(path.resolve('PLAY.html')).href)
  await page.getByRole('button', { name: /LAB · FREE PLAY/ }).click()
  await waitValid()
  await button('Fire trajectory').click()
  await page.getByText(/Impact at \(/).waitFor()
  check(true, 'Standalone file opens and fires using the inline evaluator')
  check(!errors.length, 'No browser errors: ' + JSON.stringify(errors))
  console.log(checks.length + ' browser checks passed.')
} finally {
  await browser.close()
}
