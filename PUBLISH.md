# Publishing: companion-module-nextologies-nextotalk

Module: **Nextologies Meet Controller** (`nextologies-nextotalk`)
Public repository: https://github.com/bitfocus/companion-module-nextologies-nextotalk (remote `bitfocus`)
Mirror: https://github.com/nxto-tv/companion-module-nextologies-nextotalk (push URL on `origin`)
Registry: Bitfocus Developer Portal, listed since v1.0.0 (July 2026)

Releases so far: v1.0.0, v1.0.1 (review fixes), v1.0.2 (room names drawn into the key image),
v1.0.3 (fixes for the v1.0.2 review, pending).

---

## How a release flows

1. Code lands on `main` in the Bitfocus repository.
2. The maintainer tags it `v<semver>` and publishes a GitHub Release.
3. The maintainer submits that tag on the Bitfocus Developer Portal. The submission sits in the
   **Pending** queue.
4. A volunteer reviewer runs the review tooling against the tag and sends the report back
   through the portal (the reports are also kept at
   https://github.com/digitaldrummerj/companion-module-review/tree/main/reviews/nextologies-nextotalk).
5. **Changes Required** means: fix, bump, tag, release and submit the new tag. There is no
   reply box on the report itself; the resubmission is the reply.
6. **Approved** means the version is live in Companion's module store within minutes.

---

## Step 1 — Pre-release checks

```bash
yarn install --immutable
yarn build        # also regenerates src/generated/render-assets.ts
yarn lint
yarn test         # runs the asset generator first, so it works on a fresh clone
yarn package      # writes nextologies-nextotalk-<version>.tgz and pkg/
```

All four must be clean. `yarn package` runs `companion-module-build`, the same validation the
reviewer's pipeline runs. The two "No license file found" lines it prints for
`@companion-module/base` and `@resvg/resvg-wasm` are informational.

Load the `.tgz` into a local Companion (Connections → Manage → Import module package) and check:

- a Meet room maps to a button and follows mute/unmute;
- a long or renamed room name wraps and fits inside the key;
- a room mapped before its first mic update shows the neutral (black) look;
- the connection status reads `v<version> · 127.0.0.1:7006`.

---

## Step 2 — Bump the version

The version lives in two files and must match:

- `package.json` → `"version"`
- `companion/manifest.json` → `"version"`

`companion/HELP.md` has no version string. The status line, `module_version` variable and
welcome payload all read `package.json` at runtime.

Commit the bump together with the change it ships.

---

## Step 3 — Push `main` to GitHub

```bash
git push bitfocus main
git push https://github.com/nxto-tv/companion-module-nextologies-nextotalk.git main
```

The `origin` remote's first push URL (`dev.nextologies.com`) needs the internal credential and
is pushed separately. Dependabot opens dependency PRs on the Bitfocus repo; rebase onto
`bitfocus/main` before pushing if any were merged since the last release.

CI (`.github/workflows`): `node.yaml` (build), `lint.yaml`, and `companion-module-checks.yaml`
(the Bitfocus validation suite, triggered by version tags). All must be green on the tag.

---

## Step 4 — Tag and release

```bash
git tag v1.0.3
git push bitfocus v1.0.3
```

Then on GitHub (bitfocus repo) → **Releases** → **Draft a new release** → pick the tag, title
`v1.0.3`, and paste the user-facing notes (what changed for operators, not the review IDs).
Publish it.

---

## Step 5 — Submit on the Developer Portal

1. Sign in to the Bitfocus Developer Portal with the GitHub account that owns the repo.
2. **My Connections** → `nextologies-nextotalk` → **Submit Version**.
3. Choose the Git tag (`v1.0.3`). Leave **Is Prerelease** off for a normal release.
4. The status shows **Pending** until a reviewer picks it up. Review time depends on volunteer
   availability; the v1.0.2 review arrived two days after submission.

---

## Step 6 — Answering a review

The reviewer's report lists Blocking, Non-blocking and Notes items plus "Assumptions to confirm".

- Fix every Blocking item. Non-blocking items are expected to be fixed too unless there is a
  reason not to; say so in the release notes if one is skipped.
- Bump the patch version, go through Steps 1 to 5 again with the new tag.
- When submitting, or in a message on the `#module-development` channel of the Bitfocus
  Slack/Discord, state the tag and commit that addresses the review and answer the assumptions
  in one line each. Keep the review's IDs (H1, M1, ...) so the reviewer can tick them off.
  The v1.0.0 round was also acknowledged on PR #11 of the Bitfocus repo, mentioning the
  reviewer; that worked but the portal submission is what moves the queue.

Example for v1.0.3:

> v1.0.3 (commit b0bc3eb, tag v1.0.3) addresses the v1.0.2 review: H1 resvg objects freed
> (flat memory over 6000 renders), H2 `yarn test` generates assets first, M1 names wrap and
> shrink to fit inside the renderer, L1 HELP.md says 7006, L2 mapped rooms without a mic
> state render neutral. Assumptions A1 to A4 are all correct.

---

## Checklist

- [ ] `yarn build && yarn lint && yarn test && yarn package` clean
- [ ] Package loaded into a local Companion and the four checks above pass
- [ ] `package.json` and `companion/manifest.json` carry the same new version
- [ ] `main` pushed to `bitfocus` and `nxto-tv`
- [ ] Tag `v<version>` pushed to `bitfocus`; CI green
- [ ] GitHub Release published with user-facing notes
- [ ] Version submitted on the Developer Portal; status Pending
- [ ] Review answered (new tag submitted, assumptions confirmed)

---

## Key links

- Module repo: https://github.com/bitfocus/companion-module-nextologies-nextotalk
- Review reports: https://github.com/digitaldrummerj/companion-module-review/tree/main/reviews/nextologies-nextotalk
- Releasing a module (Companion docs): https://companion.free/for-developers/module-development/module-lifecycle/releasing-your-module
- Module versioning rules: https://companion.free/for-developers/git-workflows/versioning
- Module base API: https://github.com/bitfocus/companion-module-base
