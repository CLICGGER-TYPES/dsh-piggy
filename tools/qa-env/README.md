# QAENV: M1 Linux test foundation

This small harness checks the offline Linux test environment before product work resumes. It runs serially on the already-authorized QA VM and never boots or shuts it down. Root starts the resource guard and owns VM startup, memory thresholds and final shutdown.

## One command

Copy `config.example.json` to a mode-0600 private file under `.work`, fill the current root lease, pinned SSH files and existing artifact paths, then ask root to authorize the two short directory parents from `print-layout`. After root starts the guard and the QA VM, run from a normal host shell:

```sh
python3 tools/qa-env/bin/qa-env.py --config /path/to/.work/QAENVV01-private.json verify
```

The command creates its own task-named tmux session for SSH/SCP, transfers the pinned source/tool/dependency/runtime inputs once, runs A then B with fresh IDs, and exports each report, screenshot and cleanup ledger before removing private profiles and short directories. A failure stops the batch; there is no automatic retry and no manual repair between A and B. `print-layout` derives exact paths and Unix socket budgets without contacting the VM. `preflight` verifies the root lease, live resource guard and already-running VM without starting product code.

Use a new `runBatchId` after a failed batch. Do not reuse run roots or delete a path the ownership marker does not match. Actual SSH details, lease/guard files, AppImage and dependency archives stay in private `.work` configuration.

## Scope

Each run verifies source/runtime/dependency identities and starts the exact M1 AppImage for CDP readiness/screenshot/stop. A performs the single project typecheck with the M1 Electron 44.5.1 ELF in Node mode; B records that it reused A's pass. Both runs open the same deterministic basic page in a tiny app served by the pristine cached Electron 44.5.1 ZIP and in the Snap Chromium private profile. The fixture uses XTest clicks, typing, wheel scrolling and the visible GTK file chooser, then checks the displayed file name, byte count and content marker. A also checks one expected early exit and one bounded timeout with owner-ledger cleanup.

This does not navigate Piggy menus or check save, helper, game, cloud, update or provider behavior. The two runs are a repeatability/cleanup check of the baseline harness.

## Artifacts and dependencies

The existing cached subset is supplied separately under `.work/dsh-piggy/QAENV-PI-01/artifacts/qaenv-toolchain-deps.tar.gz`; its manifest and exact versions are in `toolchain-versions.json`. It contains TypeScript, esbuild and the selected Electron/updater/builder type packages. The shipping Electron 44 binary and Node 24.21.0 runtime come from the M1 AppImage. The GUI fixture uses the separately hash-pinned pristine Electron ZIP so it cannot load Piggy's built-in `app.asar`. No install, package-manager download or global software change is performed.

The host archives the pinned M1 source commit `3585c2f758b108fc1bfdb954ab3543e333cdf06c` and this tool's current files for transfer. All directories, port candidates, the X display, profiles and evidence paths come from one derived run layout. Each guest run selects ports/display once and writes them with owned PID/PGID/SID/start-tick/executable identities to `identity.json`; the run then reads that ledger instead of reselecting resources. The reusable `bin/resource-guard.py` keeps the 16/13/12 GiB policy and 3-second sampling. Root starts it with the current lease values; QAENV only checks that it is actively watching the same lease.

The guard is started separately by root, for example with these required arguments filled from the root lease:

```sh
python3 tools/qa-env/bin/resource-guard.py --lease-file <lease.json> --status-root <guard-output> --expected-task QAENVV01 --expected-actor PI-05 --expected-uuid <guest-uuid> --expected-uri qemu:///system
```

The guard requires 16 GiB available before start, samples every 3 seconds, requests normal shutdown after two consecutive samples below 13 GiB, and uses its emergency path below 12 GiB. It never changes the user's personal display, browser profile or desktop session.
