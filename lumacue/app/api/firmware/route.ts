import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Serves the firmware sketches from firmware/ so the Show Studio can fill in a
 * show and offer them as a download: ?board=nano (bench, NRF24, default) or
 * ?board=esp32 (ESP-NOW). LumaCue runs locally from the repo, so the files are
 * read straight from disk; the repo copies stay the single source of truth.
 */
const BOARDS = {
  nano: {
    root: 'bench_sync_test',
    files: {
      baseIno: 'base_station/base_station.ino',
      baseProtocol: 'base_station/lumacue_protocol.h',
      costumeIno: 'test_costume/test_costume.ino',
      costumeProtocol: 'test_costume/lumacue_protocol.h',
    },
  },
  esp32: {
    root: 'esp32',
    files: {
      baseIno: 'base/base.ino',
      baseProtocol: 'base/lumacue_protocol.h',
      costumeIno: 'costume/costume.ino',
      costumeProtocol: 'costume/lumacue_protocol.h',
    },
  },
} as const

export async function GET(request: Request) {
  const board = new URL(request.url).searchParams.get('board') === 'esp32' ? 'esp32' : 'nano'
  const { root, files: FILES } = BOARDS[board]
  // Read at request time from the repo next to the app (turbopackIgnore: don't trace it into the build).
  const ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), '..', 'firmware', root)
  try {
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, rel]) => [key, await readFile(path.join(/*turbopackIgnore: true*/ ROOT, rel), 'utf8')] as const),
    )
    return Response.json(Object.fromEntries(entries))
  } catch (e) {
    return Response.json(
      { error: `Firmware sketches not found next to the app (${ROOT}): ${(e as Error).message}` },
      { status: 404 },
    )
  }
}
