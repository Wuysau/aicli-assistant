import { beforeAll } from 'vitest'

beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    Object.defineProperty(globalThis, 'window', {
      value: {
        setTimeout,
        clearTimeout,
      },
      writable: true,
    })
  }
})
