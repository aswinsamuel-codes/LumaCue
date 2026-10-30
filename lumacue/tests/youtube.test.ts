import { describe, expect, it } from 'vitest'
import { parseYouTubeId } from '@/lib/show/youtube'

describe('parseYouTubeId', () => {
  const id = 'dQw4w9WgXcQ'
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&list=PL123&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}&si=abc`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=xyz&t=10`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `www.youtube.com/watch?v=${id}`,
    `youtu.be/${id}`,
    `  ${id}  `,
  ])('reads %s', (link) => {
    expect(parseYouTubeId(link)).toBe(id)
  })

  it.each([
    '',
    'not a link',
    'https://vimeo.com/123456',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/@channel',
    'https://evil.example.com/watch?v=dQw4w9WgXcQ',
  ])('rejects %s', (link) => {
    expect(parseYouTubeId(link)).toBeNull()
  })
})
