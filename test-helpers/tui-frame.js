import { mock } from 'node:test';
import { AccountManager } from '../src/account-manager.js';
import { TUI } from '../src/tui.js';

// A deterministic dashboard frame: a fixed fleet, a frozen clock, a terminal of
// the requested size, and the real render() path down to the buffer _paint
// would write. Deterministic so a frame can be compared byte for byte against
// one recorded from an earlier build (test/fixtures/tui-wide-frames.json).
//
// This file lives outside test/ on purpose: node's default test glob includes
// `**/test/**/*.js`, so anything under test/ is run as a test file.

// 2026-10-02T00:00:00Z. Any fixed instant works; the readings are relative to it.
export const NOW = 1790899200000;
const h = 3600_000;

/** The fleet every frame draws: a Claude seat with both family buckets (one
 *  blocked) and extra usage allowed, a Claude seat whose long name starts
 *  with double-width (Hangul) characters, a
 *  metered API key, and a Codex seat that states no five-hour window. */
export function fleetAccounts() {
  return [
    { name: 'alice@example.com', type: 'oauth', accessToken: 't-a', refreshToken: 'r', expiresAt: NOW + h, allowExtraUsage: true },
    { name: '가나다라마바사-wide@example.test', type: 'oauth', accessToken: 't-k', refreshToken: 'r', expiresAt: NOW + h },
    { name: 'metered-key', type: 'apikey', apiKey: 'k-m' },
    { name: 'codex@example.com', type: 'oauth', provider: 'codex', accountId: 'acct-c', accessToken: 'c-c', refreshToken: 'r', expiresAt: NOW + h },
  ];
}

function fill(/** @type {any} */ am) {
  const [alice, wide, metered, codex] = am.accounts;
  Object.assign(alice.quota, {
    unified5h: 0.42, unified5hReset: NOW + 4 * h,
    unified7d: 0.31, unified7dReset: NOW + 2 * 24 * h,
    unified7dSonnet: 0.2, unified7dSonnetReset: NOW + 3 * 24 * h,
    unified7dFable: 0.99, unified7dFableReset: NOW + 3 * 24 * h,
  });
  Object.assign(wide.quota, {
    unified5h: 0.75, unified5hReset: NOW + 90 * 60_000,
    unified7d: 0.6, unified7dReset: NOW + 5 * 24 * h,
  });
  Object.assign(metered.quota, {
    tokensLimit: 1_000_000, tokensRemaining: 600_000,
    requestsLimit: 1000, requestsRemaining: 700,
    resetsAt: new Date(NOW + h).toISOString(),
  });
  Object.assign(codex.quota, {
    unified5h: null, unified5hReset: null, sessionWindowStated: false,
    unified7d: 0.5, unified7dReset: NOW + 6 * 24 * h,
  });
  return am;
}

/**
 * Render the fleet at `width` x `height` through TUI.render().
 * @returns {{ buf: string, rows: { idx: number, out: string | string[] }[], tui: any }}
 *   `buf` is the frame exactly as _paint receives it; `rows` is what each
 *   _renderRow call returned, before the frame's fitLine pads or cuts it.
 *   `tweak(am)` adjusts the filled fleet before the frame is drawn.
 *   With `realPaint`, _paint is left alone and `buf` is what it wrote to
 *   process.stdout instead.
 */
export function renderFrame(width, { height = 40, accounts = fleetAccounts(), mode = null, selIdx = 0, realPaint = false, tweak = null } = {}) {
  mock.timers.enable({ apis: ['Date'], now: NOW });
  const cols = Object.getOwnPropertyDescriptor(process.stdout, 'columns');
  const rowsDesc = Object.getOwnPropertyDescriptor(process.stdout, 'rows');
  try {
    const am = fill(new AccountManager(accounts, 0.98, {}));
    if (tweak) tweak(am);
    const tui = new TUI({
      accountManager: am, config: { proxy: { port: 3456 }, accounts: [], routes: [] }, sx: null,
      saveConfig: async () => {}, syncAccounts: async () => 0, onQuit: () => {}, probeQuota: () => {},
    });
    if (mode) { tui.mode = mode; tui.selIdx = selIdx; }
    Object.defineProperty(process.stdout, 'columns', { value: width, configurable: true });
    Object.defineProperty(process.stdout, 'rows', { value: height, configurable: true });
    /** @type {{ idx: number, out: string | string[] }[]} */
    const rows = [];
    const real = tui._renderRow.bind(tui);
    tui._renderRow = (/** @type {number} */ idx, /** @type {any} */ L, /** @type {any} */ current) => {
      const out = real(idx, L, current);
      rows.push({ idx, out });
      return out;
    };
    let buf = '';
    tui.running = true;
    if (realPaint) {
      const write = process.stdout.write;
      // @ts-ignore -- a capture in place of the terminal for this one frame
      process.stdout.write = (/** @type {string} */ chunk) => { buf += chunk; return true; };
      try { tui.render({ force: true }); } finally { process.stdout.write = write; }
    } else {
      tui._paint = (/** @type {string} */ b) => { buf = b; };
      tui.render({ force: true });
    }
    return { buf, rows, tui };
  } finally {
    // A non-TTY stdout has no own size properties: remove the mocked ones rather
    // than leave them for the next test to read.
    if (cols) Object.defineProperty(process.stdout, 'columns', cols);
    else delete process.stdout.columns;
    if (rowsDesc) Object.defineProperty(process.stdout, 'rows', rowsDesc);
    else delete process.stdout.rows;
    mock.timers.reset();
  }
}

/** The frame's lines, cursor-home and cursor-visibility escapes removed, colour kept. */
export function frameLines(/** @type {string} */ buf) {
  return buf.replace(/^\x1b\[H/, '').replace(/\x1b\[\?25[hl]$/, '').split('\r\n');
}
