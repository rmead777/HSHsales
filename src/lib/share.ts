// Native share with a clipboard fallback. Both APIs require a secure context (https or
// localhost). navigator.share must be called *directly inside the click handler* (it needs
// a user gesture) and rejects with AbortError when the user cancels — which we treat as success.

export type ShareResult = 'shared' | 'copied' | 'failed'

export async function shareOrCopy(data: { title?: string; text?: string; url: string }): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare !== 'function' || navigator.canShare(data)) {
        await navigator.share(data)
        return 'shared'
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
      // otherwise fall through to clipboard
    }
  }
  return copyText(data.url)
}

export async function copyText(text: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      // fall through to legacy
    }
  }
  // Legacy fallback for older / insecure contexts.
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok ? 'copied' : 'failed'
  } catch {
    return 'failed'
  }
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}
