import { describe, expect, it } from 'vitest'
import { isHttpUrl } from '../src/lib/validate'

describe('isHttpUrl', () => {
  it('accepts complete http and https URLs', () => {
    expect(isHttpUrl('https://example.com/path?x=1')).toBe(true)
    expect(isHttpUrl('http://localhost:5173')).toBe(true)
  })

  it('rejects unsafe or incomplete URLs', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('mailto:sales@example.com')).toBe(false)
    expect(isHttpUrl('ftp://example.com/file')).toBe(false)
    expect(isHttpUrl('/relative/path')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
  })
})
