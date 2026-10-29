import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Serves the bench firmware sketches from firmware/bench_sync_test so the
 * Show Studio can fill in a show and offer them as a download. LumaCue runs
 * locally from the repo, so the files are read straight from disk; the repo
 * copies stay the single source of truth.
 */
const ROOT = path.resolve(process.cwd(), '..', 'firmware', 'bench_sync_test')

const FILES = {
  baseIno: 'base_station/base_station.ino',
  baseProtocol: 'base_station/lumacue_protocol.h',
  costumeIno: 'test_costume/test_costume.ino',
  costumeProtocol: 'test_costume/lumacue_protocol.h',
} as const

export async function GET() {
  try {
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, rel]) => [key, await readFile(path.join(ROOT, rel), 'utf8')] as const),
    )
    return Response.json(Object.fromEntries(entries))
  } catch (e) {
    return Response.json(
      { error: `Firmware sketches not found next to the app (${ROOT}): ${(e as Error).message}` },
      { status: 404 },
    )
  }
}
