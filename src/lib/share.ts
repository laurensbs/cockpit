// Share windows of the platforms, with the text already filled in. He still presses "Post" himself.

const MAX = 1300

const clip = (text: string) => (text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text)

/** LinkedIn's own "start a post" window with the text in it. */
export const linkedinShareUrl = (text: string) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(clip(text))}`

/** X's compose window with the text in it (X itself shortens to 280 characters). */
export const xShareUrl = (text: string) => `https://x.com/intent/post?text=${encodeURIComponent(clip(text))}`

/** The share window for a platform, or null when it has none that takes text. */
export function shareUrl(platform: string, text: string): string | null {
  if (platform === 'linkedin') return linkedinShareUrl(text)
  if (platform === 'x') return xShareUrl(text)
  return null
}
