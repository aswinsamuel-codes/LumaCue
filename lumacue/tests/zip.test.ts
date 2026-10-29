import { describe, expect, it } from 'vitest'
import { inflateRawSync } from 'node:zlib'
import { makeZip } from '@/lib/zip'

/** Reads a zip with the central directory, like an unzip tool would. */
function readZip(buf: Buffer) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const out: { name: string; text: string; crc: number }[] = []
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50)
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    expect(buf.readUInt32LE(local)).toBe(0x04034b50)
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataStart, dataStart + size)
    out.push({ name, text: (method ? inflateRawSync(raw) : raw).toString('utf8'), crc })
    p += 46 + nameLen
  }
  return out
}

function crc32(data: Buffer) {
  let c = ~0
  for (const byte of data) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return ~c >>> 0
}

describe('makeZip', () => {
  it('writes a valid archive with folders and UTF-8 names', async () => {
    const files = [
      { path: 'show/base/base.ino', text: 'void setup() {}\n' },
      { path: 'show/README.txt', text: 'Powered by Aswin Samuel — ✓\r\n' },
    ]
    const buf = Buffer.from(await makeZip(files).arrayBuffer())
    const read = readZip(buf)
    expect(read.map((f) => [f.name, f.text])).toEqual(files.map((f) => [f.path, f.text]))
    for (const f of read) expect(f.crc).toBe(crc32(Buffer.from(f.text, 'utf8')))
  })
})
