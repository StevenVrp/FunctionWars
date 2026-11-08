import { compile } from './weapon'
self.onmessage = (e) => {
  const { id, source, params } = e.data
  try {
    self.postMessage({ id, weapon: compile(source, params) })
  } catch (e) {
    self.postMessage({ id, error: (e as Error).message })
  }
}
