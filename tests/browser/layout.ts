import axe from 'axe-core'
const frame = document.querySelector('iframe')!
const results = document.querySelector('#results')!
async function audit() {
  const rows = []
  for (const width of [390, 1280]) {
    frame.style.width = width + 'px'
    for (const route of [
      'home',
      'sandbox',
      'duel',
      'battle',
      'campaign',
      'mission',
      'library',
    ]) {
      // Change the query as well as the hash to ensure a fresh load event.
      await new Promise<void>((resolve) => {
        frame.onload = () => resolve()
        frame.src =
          '/dist/index.html?size=' +
          width +
          '&view=' +
          route +
          '#' +
          ({ battle: 'duel', mission: 'campaign' }[route] ?? route)
      })
      const win = frame.contentWindow!,
        doc = frame.contentDocument!
      for (
        let i = 0;
        (!doc.querySelector('main') ||
          (route === 'sandbox' &&
            !doc.querySelector('[data-testid=preview]'))) &&
        i < 120;
        i++
      )
        await new Promise((r) => setTimeout(r, 50))
      if (route === 'battle' || route === 'mission') {
        const selector =
          route === 'battle'
            ? '.setup-controls > button.primary'
            : '.missions button'
        doc.querySelector<HTMLButtonElement>(selector)!.click()
        for (
          let i = 0;
          !doc.querySelector('[data-testid=preview]') && i < 120;
          i++
        )
          await new Promise((r) => setTimeout(r, 50))
      }
      await doc.fonts.ready
      await Promise.all(
        doc.getAnimations().map((a) => a.finished.catch(() => {})),
      )
      const script = doc.createElement('script')
      script.textContent = axe.source
      doc.head.append(script)
      const report = await (win as Window & { axe: typeof axe }).axe.run(doc, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      })
      rows.push({
        width,
        view: route,
        overflow: doc.documentElement.scrollWidth > win.innerWidth,
        issues: report.violations.map((v) => ({
          id: v.id,
          sample: v.nodes[0]?.failureSummary,
          elements: v.nodes.map((n) => n.target),
        })),
      })
      results.textContent = JSON.stringify(rows, null, 2)
    }
  }
  results.textContent = 'Completed\n' + JSON.stringify(rows, null, 2)
}
audit().catch((e) => {
  results.textContent = String(e)
})
