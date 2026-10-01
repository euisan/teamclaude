// Below 70 columns (a phone over a remote terminal, say) an account row no
// longer fits a name, a status and its quota bars on one line. The list used to
// drop every bar past the first and then shrink that one to a couple of cells;
// it now folds each account into a heading line and one line per bar, each bar
// stopping two columns short of the right edge. At 70 columns and wider the
// frame is unchanged, byte for byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { displayWidth } from '../src/tui.js';
import { renderFrame, frameLines } from '../test-helpers/tui-frame.js';

const strip = (/** @type {string} */ s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const NARROW = [69, 50, 40, 30];
// The margin a folded bar keeps from the right edge. Spelled out rather than
// imported, so a change to the constant is a change these tests notice.
const MARGIN = 2;

// A folded bar line: four columns holding the indent (or, for a family bar, the
// selection cursor and the route marker), the three-column label, a space.
const BAR_LINE = /^ {2}[ >][ ►](Ses|Wk |Tok|Req|S7 |F7 ) /;
const labelOf = (/** @type {string} */ line) => strip(line).match(BAR_LINE)?.[1].trim();

/** Each account's folded lines, in the order they were drawn. */
function folded(/** @type {number} */ width, /** @type {any} */ opts = {}) {
  const { buf, rows } = renderFrame(width, opts);
  return { buf, accounts: rows.map(r => /** @type {string[]} */ (r.out)), lines: frameLines(buf) };
}

test('at 70 columns and wider the frame is byte-identical to the one 1.1.22 drew', () => {
  // Recorded from the unmodified 1.1.22 renderer with the same fleet and clock.
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/tui-wide-frames.json', import.meta.url), 'utf8'));
  for (const [w, frame] of Object.entries(recorded)) {
    assert.equal(renderFrame(Number(w)).buf, frame, `W=${w}: the wide frame changed`);
  }
});

test('below 70 columns each account folds into a heading and one line per quota bar', () => {
  for (const w of NARROW) {
    const { accounts } = folded(w);
    assert.ok(accounts.every(Array.isArray), `W=${w}: every account is folded`);
    const [alice, korean, metered, codex] = accounts;
    assert.match(strip(alice[0]), /^ {2}► alice@exa\S* +Anthropic active$/);
    assert.deepEqual(alice.slice(1, 5).map(labelOf), ['Ses', 'Wk', 'S7', 'F7'], `W=${w}: both family bars are kept`);
    assert.match(strip(alice[5]), /^ {4}⊘ Fable {2}xu *$/, `W=${w}: the tags follow the bars`);
    assert.equal(alice.length, 6);
    assert.deepEqual(korean.slice(1).map(labelOf), ['Ses', 'Wk'], `W=${w}: the weekly bar is no longer dropped`);
    assert.deepEqual(metered.slice(1).map(labelOf), ['Tok', 'Req']);
    // A Codex seat that states no five-hour window draws its weekly bar alone,
    // as it does wide, rather than an empty `Ses -`.
    assert.deepEqual(codex.slice(1).map(labelOf), ['Wk'], `W=${w}: no empty session bar`);
  }
});

test('no line of a folded frame is wider than the terminal, in display columns', () => {
  for (const w of NARROW) {
    const { accounts, lines } = folded(w);
    for (const line of accounts.flat()) {
      assert.ok(displayWidth(line) <= w, `W=${w}: ${displayWidth(line)} columns: ${strip(line)}`);
    }
    // The frame itself is exactly the terminal wide on every line, so nothing
    // wraps and nothing of the previous frame is left behind.
    for (const line of lines) assert.equal(displayWidth(line), w, `W=${w}: ${strip(line)}`);
  }
});

test('a folded bar takes the row and stops two columns short of the right edge', () => {
  for (const w of NARROW) {
    const { accounts, lines } = folded(w);
    const bars = accounts.flat().filter(l => labelOf(l));
    assert.equal(bars.length, 9, `W=${w}: every bar is drawn`);
    for (const line of bars) {
      assert.equal(displayWidth(line), w - MARGIN, `W=${w}: ${strip(line)}`);
    }
    // In the painted frame the margin is blank: the bar's colour is reset
    // before it, so the last two cells are terminal background.
    const painted = lines.filter(l => labelOf(l));
    assert.equal(painted.length, bars.length);
    for (const line of painted) {
      assert.ok(line.endsWith('\x1b[0m' + ' '.repeat(MARGIN)), `W=${w}: no blank margin after ${JSON.stringify(line.slice(-12))}`);
    }
  }
});

test('the folded heading spends what the type and status leave on the name, in display columns', () => {
  for (const w of NARROW) {
    const { accounts } = folded(w);
    for (const [heading] of accounts) {
      // The status ends on the last column: the name took every column left.
      assert.equal(displayWidth(strip(heading).trimEnd()), w, `W=${w}: ${strip(heading)}`);
    }
  }
  // Ten Hangul syllables are twenty columns, not ten: the name is cut where it
  // reaches the type column, never past it.
  assert.match(strip(folded(40).accounts[1][0]), /^ {4}홍길동-업무용-계정@ Anthropic active$/);
  assert.match(strip(folded(30).accounts[1][0]), /^ {4}홍길동-업 Anthropic active$/);
  assert.match(strip(folded(69).accounts[1][0]), /^ {4}홍길동-업무용-계정@예시\.한국 +Anthropic active$/);
});

test('every folded bar keeps its whole percentage and countdown', () => {
  const labels = ['42% · 4h', '31% · 2d', '20% · 3d', '99% · 3d', '75% · 1h30m', '60% · 5d', '40% · 1h', '30% · 1h', '50% · 6d'];
  for (const w of NARROW) {
    const text = folded(w).lines.map(strip).join('\n');
    for (const label of labels) assert.ok(text.includes(label), `W=${w}: "${label}" is missing`);
  }
});

test('tags that do not fit one line wrap onto the next, whole', () => {
  const tweak = (/** @type {any} */ am) => {
    Object.assign(am.accounts[0], { switchThreshold: 0.5, routing: 'socks5h://alice:***@proxy.example.com:1080' });
  };
  for (const w of NARROW) {
    const [alice] = folded(w, { tweak }).accounts;
    const tagLines = alice.slice(5).map(strip);
    for (const line of alice.slice(5)) assert.ok(displayWidth(line) <= w, `W=${w}: ${strip(line)}`);
    const tags = tagLines.join('  ');
    for (const tag of ['⊘ Fable', 'xu', 'switch at 50%']) assert.ok(tags.includes(tag), `W=${w}: "${tag}" is cut`);
    assert.ok(tags.includes('via socks5h://'), `W=${w}: the routing tag starts`);
    if (w <= 40) assert.ok(tagLines.length > 1, `W=${w}: the tags wrapped`);
  }
});

test('a 30-column terminal is drawn; a 29-column one is refused', () => {
  assert.match(strip(renderFrame(30).buf), /alice@exa/);
  assert.match(renderFrame(29).buf, /Terminal too small \(need 30x8\+\)/);
});

test('the real paint writes the folded frame to the terminal', () => {
  // _paint left in place: what reaches process.stdout is the frame.
  const { buf } = renderFrame(40, { realPaint: true });
  assert.ok(buf.startsWith('\x1b[H'), 'a frame, homed');
  const lines = frameLines(buf);
  assert.equal(lines.length, 40);
  for (const line of lines) assert.equal(displayWidth(line), 40, strip(line));
  assert.deepEqual(lines.map(labelOf).filter(Boolean), ['Ses', 'Wk', 'S7', 'F7', 'Ses', 'Wk', 'Tok', 'Req', 'Wk']);
});

test('the selected account keeps its cursor when folded', () => {
  const { accounts } = folded(40, { mode: 'select', selIdx: 1 });
  assert.match(strip(accounts[1][0]), /^ > {2}홍길동/);
  assert.equal(displayWidth(strip(accounts[1][0]).trimEnd()), 40);
});
