# Security

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](https://github.com/aswinsamuel-codes/LumaCue/security/advisories/new)
and include steps to reproduce. You should get a reply within 7 days.

## Threat model

LumaCue runs a live LED show. The realistic risks are:

1. **Someone in the venue messing with the show:** a person at the show laptop, or a device on the same Wi-Fi.
2. **A malicious show file:** a `.lumacue.json` shared by someone else.
3. **The desktop app being abused:** web content gaining access to the operating system.

Costumes play the show from their own memory over a private radio link (NRF24 or ESP-NOW). The laptop only arms, starts and keeps them in sync.

## What is in place

| Area | Protection |
|---|---|
| Screen lock | Access code chosen on first start, stored only as a **salted PBKDF2-SHA256 hash** (210,000 iterations), with a lockout after 5 wrong codes (30 s, doubling, max 10 min). It replaces the old hard-coded code. It is a lock against casual use of the show laptop, **not** encryption: someone with full access to the computer can clear the app's storage. |
| Desktop: renderer | `contextIsolation`, `sandbox`, no `nodeIntegration`, no `<webview>`, `webSecurity` on. The preload exposes one read-only flag. |
| Desktop: navigation | The window can only show the local Show Studio. Other links open in the system browser, and **only `https:`** links (no `file:`, `smb:`, `ms-*:` or custom protocols). Frames are limited to the app and YouTube's embedded player. |
| Desktop: permissions | Only `serial` (USB base station), clipboard write and fullscreen, and only for the app's own origin. Camera, microphone, location, notifications, HID and USB are refused. Serial ports are chosen by the operator in a native dialog. |
| Desktop: local server | Next.js runs inside the app, bound to **127.0.0.1** on a random port. Requests whose `Host` header isn't the app are refused (blocks DNS rebinding). Responses send `nosniff`, `X-Frame-Options: DENY` and `no-referrer`. |
| Firmware API | `?board=` is allow-listed (`nano` / `esp32`) and file names are fixed, so there's no path traversal. |
| Show files | Parsed with `JSON.parse` only (no `eval`), validated and repaired by the show model before use. |
| Raspberry Pi hardware server | `WS_TOKEN` shared secret (checked in constant time), an optional `WS_ALLOWED_ORIGINS` allow-list, and a 16 KB message limit. A warning is printed when it listens on the network without a token. **Set `WS_TOKEN`** and use `NEXT_PUBLIC_WS_URL=ws://<pi>:8080/?token=<same token>`. |

The automated checks live in `tests/desktop-security.test.ts` and `tests/passcode.test.ts`, and run with `npm test`.

## Known limitations

- The renderer has no strict Content-Security-Policy, because Next.js uses inline scripts. Navigation, frame and permission locks compensate.
- The radio links between base station and costumes are not authenticated. Someone with a matching NRF24/ESP-NOW transmitter near the stage could send packets. Signed packets are on the roadmap.
- Installers are not code-signed yet, so Windows SmartScreen will warn on first run.
