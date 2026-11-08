declare global {
  interface Window {
    __fwAssets?: Record<string, string>
    __fwStandalone?: boolean
  }
}
export function art(name: string): string {
  return window.__fwAssets?.[name] ?? './art/' + name
}
