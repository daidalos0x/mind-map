# Contributing

Thanks for taking the time to help. This document covers how to report a problem and how to get a change merged.

## Reporting a problem

- Use the issue forms. Blank issues are disabled on purpose: the fields in the bug report and feature request templates are the minimum needed to act on a report.
- One problem per issue. If you hit two unrelated bugs, file two issues.
- Fill in the version and the platform. Without them the report cannot be reproduced.
- Do not comment `+1` or `same here` — use the reaction on the issue instead. Comments are for new information.
- Check the [README](README.md) and the [latest release](https://github.com/phaethix/mind-map/releases) before filing: the problem may already be fixed.

Issues that stay incomplete for two weeks may be closed. They can be reopened once the missing details arrive.

## Sending a pull request

1. **Open or find an issue first.** Anything beyond a small fix should have an issue that describes the problem, so the approach can be agreed before code is written.
2. **Fork and branch from `main`.** Keep the branch focused on one concern.
3. **Keep the diff reviewable.** Unrelated refactors, formatting sweeps and dependency bumps belong in their own pull request.
4. **Write conventional commits.** The history uses `feat:`, `fix:`, `perf:`, `docs:`, `style:`, `refactor:`, `test:`, `build:`, `ci:` and `chore:` — lowercase, imperative, no trailing period.
5. **Run the checks before pushing:**

   ```bash
   npx prettier --check .
   cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --check
   cd web && npm run build
   ```

   The same checks run in CI on every pull request.

6. **Update the documentation.** Behaviour changes belong in the README or in a code comment next to the change.
7. **Describe the verification.** State which platform you tested on and what you ran. CI does not cover the desktop shell on macOS or Windows.

## Build notes

- **Node 14+** is required everywhere. `scripts/bootstrap.sh` only installs Node automatically on macOS; on Linux and Windows install it yourself and run `make` again.
- **Line endings.** `.gitattributes` pins the files the shell parses to LF. Windows working trees created before that file existed need one re-checkout or a fresh clone.
- **Desktop builds** are macOS-only today: `make` produces `Mind.app` in `~/Applications`.

## Review

- Expect questions and change requests. Small, focused pull requests get merged faster.
- A pull request that has been waiting on the author for a month may be closed. It can always be reopened.
- By contributing you agree that your work is released under the licence in [LICENSE](LICENSE).
