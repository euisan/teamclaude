# teamcodex → teamclaude port plan

Source: `euisan/teamcodex` main `2ce8ba3`. Only the owner's own commits count here (author `Euisan Kim`, 34 commits, numbered #1..#34 oldest first).
Target: teamclaude `931e8b1` (upstream v1.1.22). Every `file:line` in the Evidence column points at the teamclaude tree at that commit unless the path is prefixed `teamcodex:`.

Categories:

- **(a) port as-is**: applies to teamclaude essentially unchanged.
- **(b) port with Claude adaptation**: useful, but needs rework for teamclaude's multi-provider (Claude + Codex) code.
- **(c) codex-only / not applicable**: only meaningful for the codex-only fork (removing the Anthropic surface, codex-only pinning, fork-only subsystems), or docs/CI for teamcodex itself.
- **(d) already in teamclaude**: v1.1.22 already has equivalent behaviour, in many cases because the teamcodex commit was itself a port *from* teamclaude.

## Commit table

| # | Commit | Title | Category | Evidence (file:line) | Notes |
|---|---|---|---|---|---|
| 1 | b025c17 | codex-only stage 1: pin provider, drop teamclaude bin, reject Anthropic accounts | (c) | Removes `src/teamclaude.js` and the provider env, and rejects Anthropic credentials. teamclaude is multi-provider by design (`package.json` bins `teamclaude`/`teamrouter`, `src/provider.js`). | Opposite of teamclaude's goal. |
| 2 | cc22ada | docs(design): run inversion stage-2 design | (c) | Adds only `docs/design/2026-09-10-run-inversion.md`, which is about making `teamcodex run` spawn Codex. | Fork design doc. |
| 3 | be76ded | test: guard the Claude-account rotation exclusion in resolveAccounts | (c) | Tests only `test/codex-only.test.js`, which asserts that Claude accounts are excluded from rotation. teamclaude must keep rotating them. | |
| 4 | 4a13764 | docs: model recovery gate (TAP 284) non-determinism investigation | (c) | Adds only a doc about the fork's `test_model_recovery_gate.py` pinned-hash gate. teamclaude has no such gate. | |
| 5 | 986c786 | run inversion stage A: teamcodex run spawns Codex, with proxy autostart | (c) | Rewrites `src/index.js` `run` to spawn Codex. teamclaude's `run` launches Claude Code, with its own fallback at `src/index.js:1336-1343`. | |
| 6 | 2dacab2 | clean(stage-c): residual Anthropic surface, conditional Fbl gauge, [TeamClaude] log rename | (c) | Mostly a rename from `[TeamClaude]` to `[TeamCodex]`. The conditional third-bar part already exists: family bars are drawn only when `families > 0` (`src/tui.js:2284`). | |
| 7 | a16a02a | fix(run): revert proxy autostart and add --auto-fallback parity with upstream teamclaude | (d) | The commit copies teamclaude behaviour. `--auto-fallback` is already parsed and honoured at `src/index.js:1336-1343`. | |
| 8 | 63597a7 | test: remove continuity and supervisor startup races | (c) | Injects `now`/`sleep` into the fork's `continuity` deadline machinery (`teamcodex:src/server.js:284-375`). teamclaude has no `continuity` subsystem: grepping `src/` for it finds nothing. | |
| 9 | f35e648 | clean(stage-b): remove Claude and cmux session rescue dead code | (c) | Deletes fork-only `claude-recovery.js`, `claude-wrapper.js` and `cmux-*.js`, none of which exist in teamclaude `src/`. | |
| 10 | 71ee40b | feat(tui): port settings screen (g key) from teamclaude | (d) | Explicitly a port from teamclaude. The `g` key opens settings at `src/tui.js:945`, and the rows are defined around `src/tui.js:960-1135`. | |
| 11 | 63de2a3 | fix: clear stale codex quota windows | (b) | `applyCodexUsageData` only writes the windows that are present and never clears a 5h/7d window the payload stopped advertising (`src/account-manager.js:4479-4495`). The parsing lives in `src/codex-usage.js:121-158`, not in account-manager. | `sessionWindowStated` (`src/tui.js:2603`) already hides the stale bar, but selection can still read it. |
| 12 | 04e92c3 | feat: render status as quota bars | (d) | `teamclaude status` already draws gradient quota bars: `quotaLines`/`usageBar`/`gradientColor` at `src/status-renderer.js:675-755`, called from `src/index.js:1500`. | Handled in stage 1. See the Stage 1 section below. |
| 13 | ebb1f73 | feat: start unused five-hour windows and rank weekly-only accounts by weekly reset | (b) | teamclaude starts 5h windows only via the opt-in `Warmer`, which spawns `claude` and is limited to Claude OAuth accounts (`src/warmer.js:192-198`). There is no passive start-target routing for Codex accounts. Weekly-reset ranking already exists (`src/account-manager.js:3936-3965`). | Port together with #14 and #32. |
| 14 | 9ade95a | test: route the starvation case through connection affinity | (b) | Test-only change (`test/account-manager.test.js`) for #13's start-target and affinity interaction. | Only meaningful once #13 is ported. |
| 15 | 04f3ef6 | feat: order accounts by weekly pacing deviation | (b) | teamclaude ranks by priority, then expiry pressure (opt-in), then weekly reset (`src/account-manager.js:3920-3965`). It has no `unified7d − elapsedFraction` pacing key. | Overlaps `expiryRouting`, so this is a policy decision more than a port. |
| 16 | 3725d26 | Raise request body cap and document streaming recovery | (d) | teamclaude's default body cap is already 64 MiB (`DEFAULT_MAX_BODY_BYTES`, `src/server.js:2090`), overridable through `proxy.maxBodyBytes`. | |
| 17 | b52ad1f | fix(tui): restore gray background on quota bars | (d) | The TUI bar already paints the unused part on gray (`100;37m`, `src/tui.js:534`) and unmeasured windows on dim gray (`src/tui.js:497-502`). | Handled in stage 1. See the Stage 1 section below. |
| 18 | 4f05adb | feat(tui): match quota bars to TeamClaude background slab and foreground status block | (d) | The commit copies teamclaude's design: the background-slab `bar`/`barColor` with burn-rate colouring (`src/tui.js:441-537`), and the foreground-block status bar (`src/status-renderer.js:730-755`). | Handled in stage 1. See the Stage 1 section below. |
| 19 | 606e5b5 | feat(tui): display both percentage and reset time in quota bar label | (d) | Already in teamclaude: the label shows `97% · 2h30m` when it fits and falls back to the countdown when it does not (`src/tui.js:519-521`). The `quotaBarPercent` setting controls it (`src/tui.js:1002`). | Handled in stage 1. See the Stage 1 section below. |
| 20 | 90da376 | feat(pacing): pacing tiebreak to headroomRate with stickiness and 0.05 band | (d) | `headroomRate = (1−u7d)/remaining` is teamclaude's expiry pressure ("headroom per second until reset", `src/account-manager.js:2896-2910`). It has a tolerance band and a current-account stay (`src/band-decision.js`, `src/account-manager.js:2148-2155`). | In teamclaude it is opt-in (`expiryRouting.enabled`, `src/account-manager.js:2825-2834`). |
| 21 | 7296e40 | feat(tui): compact layout for terminals narrower than 70 columns | (b) | teamclaude refuses widths below 40 columns (`src/tui.js:2030-2031`). Below `LIST_MIN = 70` (`src/tui.js:225`) it drops bars instead of folding each account onto per-gauge lines. The commit has to be adapted to `_listLayout` and split panes (`src/tui.js:2194`, `src/tui.js:2369-2391`). | Handled in stage 1. See the Stage 1 section below. |
| 22 | 46aa2a3 | test: harden TUI formatReset coverage and load-sensitive test gates | (a) | The useful part is `formatReset(resetTs, now = Date.now())`. teamclaude's `formatReset` reads `Date.now()` directly (`src/tui.js:427-439`). The recovery-gate and supervisor test edits are fork-only. | Only the `formatReset(now)` part and its tests. It helps stage-1 tests. |
| 23 | 0a34280 | feat(tui): compact bar 2-column right padding (mobile) | (b) | Adds `COMPACT_BAR_RIGHT_MARGIN = 2` to #21's compact gauge width (`teamcodex:src/tui.js:1391-1396`). teamclaude has no compact gauge yet. | Handled in stage 1. See the Stage 1 section below. |
| 24 | 72f526f | feat(codex): swallow upstream capacity overload and retry at a fixed interval | (b) | teamclaude already detects `server_is_overloaded` in a 200 stream and holds headers to peek (`src/server.js:2526-2570`), but it hops once to a sibling and relays the error when there is none (`src/server.js:3534-3556`). The fork retries the same account every 5s with no limit. | Retry policy needs owner sign-off. |
| 25 | bc00739 | make codex fallback opt-in and preamble hold 10s | (d) | teamclaude has no default model fallback chain: `modelFallbacks` does not appear anywhere in `src/`. Its stream peek already holds up to 10s (`DEFAULT_STREAM_PEEK_HOLD_MS = 10_000`, `src/server.js:2565`). | |
| 26 | 4e1d219 | feat(codex): make capacity retry protection forfeit and leaks visible | (b) | Logs when the preamble hold times out and an overload later leaks (`teamcodex:src/server.js:3645-3656`). teamclaude's peek releases an undecided stream silently (`src/server.js:2559-2565`, `src/server.js:2634`). | A cheap observability win, even without #24. |
| 27 | fa5a934 | test(codex): measure capacity leak interval | (b) | Adds `overloadLeakIntervalMs` to the fork's capacity gate, plus a report and a mutation script. It needs #26's leak detection on teamclaude's `peekStreamFailure`. | Optional. Only together with #26. |
| 28 | 5bcd062 | Show Codex model and session identity in TUI | (d) | teamclaude reads Codex's `session-id` header (`src/server.js:1197`). The activity log already shows a session tag and the model (`src/tui.js:840-860`), and session titles live in `src/session-titles.js`. | |
| 29 | 3f3eec8 | feat(selection): priority numbers become tiers | (d) | Selection already ranks by priority first, so equal numbers compete on the automatic order (`src/account-manager.js:3936-3965`, `docs/routing.md:21`). A strictly better tier preempts, while the same tier stays put (`src/account-manager.js:2148-2155`). | teamclaude has no per-account concurrency cap, so the "wait instead of spill" rule does not apply. The TUI part is covered by #30. |
| 30 | 1317edc | feat(tui): priority edit selects with ↑/↓ and sets numbers with ←/→ | (b) | teamclaude's TUI cannot edit priority. Settings "reorder" changes display order only, never `priority` (`src/tui.js:1099`, `test/tui-reorder.test.js:9-16`). Priority can be set only through the CLI (`src/index.js:2259`) or MCP (`src/mcp-tools.js:303`). | Needs to fit the existing ←/→ key handling (`src/tui.js:883-884`). |
| 31 | 14a221c | ci(tests): run on euisan-kim self-hosted runners | (c) | Changes only `.github/workflows/tests.yml` to use the fork's own runners. | |
| 32 | 1ad2fcb | fix: reserve start-target and warm-up routing for inference requests | (b) | Gates #13's start-target and warm-up routing on `isInference` and adds `routingRetryAfterMs`. teamclaude has no such routing. It does keep untagged requests from moving the shared cursor (`src/account-manager.js:1610-1640`). | Port together with #13. |
| 33 | 4d50a99 | feat(tui): Codex reset-credit ticket list and apply path | (b) | teamclaude only auto-redeems (`src/index.js:696-697`, toggled at `src/tui.js:980`). It already has `consumeResetCredit({ creditId })` (`src/codex-reset-credits.js:179-186`) and `fetchResetCreditDetails` (`src/codex-reset-credits.js:138`), but no ticket list, no manual apply, and no HTTP endpoint. | Fits on top of the existing redeemer. Codex rows only. |
| 34 | 2ce8ba3 | feat: add headless service, attach dashboard and runtime switch | (d) | teamclaude has `attach`, `switch` and `service` (`src/index.js:141`, `:153`, `:181`) and `--headless`/`--no-tui` (`src/index.js:386`). `src/service.js` covers systemd and launchd, and `src/tui-remote.js` provides attach. | |

## Counts by category

| Category | Count | Commits |
|---|---|---|
| (a) port as-is | 1 | #22 |
| (b) port with Claude adaptation | 12 | #11, #13, #14, #15, #21, #23, #24, #26, #27, #30, #32, #33 |
| (c) codex-only / not applicable | 9 | #1, #2, #3, #4, #5, #6, #8, #9, #31 |
| (d) already in teamclaude | 12 | #7, #10, #12, #16, #17, #18, #19, #20, #25, #28, #29, #34 |
| **Total** | **34** | |

## Next port candidates (suggested order)

1. **#22 `formatReset(now)`**: a tiny change that makes countdown labels deterministic in tests. Stage 1 did not need it (its tests freeze the clock with `mock.timers`), so it is optional.
2. ~~**#21 + #23 compact layout and right padding**~~: done in stage 1, see below.
3. **#11 clear stale Codex windows**: a small correctness fix in `codex-usage.js` and `applyCodexUsageData`. It stops a 5h value the plan no longer advertises from gating selection.
4. **#26 (+ #27) surface undecided or leaked stream releases**: logging only. It adds no new retry behaviour and shows how often the 10s peek gives up before a capacity error.
5. **#33 reset-credit ticket list and manual apply**: the backend pieces (`fetchResetCreditDetails`, `consumeResetCredit({ creditId })`) already exist. This is mostly TUI work plus one local endpoint.
6. **#30 TUI priority edit (←/→)**: teamclaude can only set priority from the CLI or MCP. It must not conflict with the settings-screen reorder, which is display-only.
7. **#24 fixed-interval capacity retry when no sibling is left**: needs an owner decision. Unbounded same-account retry differs from teamclaude's "hop once, then relay" contract.
8. **#13 + #14 + #32 start unopened 5h windows via routing**: the largest change. It needs a provider-aware design next to the opt-in `Warmer` (Claude-only today) and must stay off for untagged or auxiliary traffic.
9. **#15 weekly pacing deviation**: lowest priority. teamclaude's opt-in `expiryRouting` (headroom per second) already serves the same goal, so adding a second ranking key needs a deliberate policy choice.

## Stage 1: narrow-screen usage bars

Done on branch `euisan/narrow-usage-bars`. Ported behaviour: #21 (fold below 70 columns) and #23 (2-column right margin on folded bars). Nothing was taken from #12, #17, #18 or #19, because teamclaude 1.1.22 already has all four (see their rows above). The bars are reused exactly as they are.

**What changed in teamclaude.**

- Below `LIST_MIN` (70 columns), a full-width list no longer squeezes an account into one row. That used to drop every bar past the first and shrink the remaining one to a cell or two. Now each account folds into:
  - a heading: marker, route cells, name, type and status. The name gets every column the rest leaves, measured in display columns, so a CJK name is cut where it actually reaches the type column.
  - one line per quota bar: `Ses`, `Wk ` (or `Tok`/`Req`), and `S7`/`F7` when the account has them. Each bar is `W - 8 - COMPACT_BAR_RIGHT_MARGIN` wide (at least `BAR_MIN`), so it ends 2 columns before the right edge.
  - the trailing tags (`⊘`, money, `xu`, credits, switch threshold, routing), wrapped a whole tag at a time.
- A Codex seat that states no five-hour window draws only its weekly bar, the same rule as the wide row.
- The smallest drawable terminal is now 30x8 instead of 40x8, so the folded layout is reachable at phone widths.
- At 70 columns and wider the frame is byte-identical to 1.1.22. The trailing tags were moved into a list and appended in the same order with the same `  ` separator. `test/fixtures/tui-wide-frames.json` holds frames recorded from the unmodified 1.1.22 renderer.

**How it maps onto teamclaude's structure.** teamcodex folds inside a single-list renderer. teamclaude lays rows out with a per-category width budget (`_listLayout`) and splits mixed pools into two panes. The fold hooks in with one flag: `_listLayout` returns `narrow` for a full-width list below `LIST_MIN`, `_renderRow` passes the width to `_renderAcct`, and `_renderAcct` returns an array of lines instead of one string. Panes are never narrow, because a split needs at least `2 × PANE_MIN` columns.

**Not ported from #21:** wrapping the in-flight activity lines below 70 columns. teamclaude's activity line carries a coloured session tag and model, so the final `fitLine` cuts it at the edge as before. It can follow if wanted.

**Evidence:** `docs/evidence/2026-10-02-narrow-usage-bars-render.txt` has the real `TUI.start()` paint at 30/40/50/69/80 columns, captured through a pty sized with `stty`.
