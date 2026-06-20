# Publishing Plan: companion-module-nextologies-nextotalk

Module: **Nextologies Meet Controller** (`nextologies-nextotalk`)  
Current version: `0.4.0`  
Target registry: Bitfocus Companion module store

---

## Overview

Bitfocus Companion discovers and installs modules from GitHub. Publishing requires:

1. A public GitHub repository with the module code
2. A correctly tagged release (`v0.4.0`)
3. Passing CI checks (lint + build)
4. Submission to the Bitfocus module list (PR to `bitfocus/companion-bundled-modules`)

The current remote points to an internal dev server (`dev.nextologies.com`). The `manifest.json` already references the target GitHub URL (`github.com/bitfocus/companion-module-nextologies-nextotalk`), which means the repo either needs to be created under the Bitfocus org or under a personal/org GitHub account first.

---

## Step 1 — Write the HELP.md

The file `companion/HELP.md` is shown to users inside Companion. It currently contains placeholder text.

Update it to include:

- What the module does (Mic Controller for Google Meet / NextoTalk)
- Prerequisites (NextoTalk app version, WebSocket port)
- Connection setup (host, port)
- Available actions and what they do
- Known limitations

This is a required step before submitting to Bitfocus.

---

## Step 2 — Verify the manifest

File: `companion/manifest.json`

Check every field before publishing:

| Field        | Current value                                                       | Action needed                                                         |
| ------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `id`         | `nextologies-nextotalk`                                             | OK — must be globally unique in Bitfocus registry                     |
| `version`    | `0.4.0`                                                             | Must match `package.json` version                                     |
| `repository` | `github.com/bitfocus/companion-module-nextologies-nextotalk`        | Update to actual GitHub URL once repo is created                      |
| `bugs`       | `github.com/bitfocus/companion-module-nextologies-nextotalk/issues` | Update to match                                                       |
| `keywords`   | `[]`                                                                | Add relevant terms: `"mic"`, `"mute"`, `"google-meet"`, `"nextotalk"` |
| `products`   | `["NextoTalk"]`                                                     | Consider adding `"Google Meet"`                                       |

---

## Step 3 — Run pre-publish checks locally

```bash
# In the project root
yarn install
yarn build
yarn lint
```

All three must pass with zero errors before pushing.

Also run the Companion module check tool (if not already done):

```bash
yarn package
```

This runs `companion-module-build` and validates the built output. Fix any reported issues.

---

## Step 4 — Create the public GitHub repository

Two options depending on whether Bitfocus grants org access:

### Option A — Under the Bitfocus org (preferred for official listing)

Contact the Bitfocus team via their Discord (`#module-development` channel) or open an issue in `bitfocus/companion` requesting a repo named `companion-module-nextologies-nextotalk` be created in their org. They will add you as a maintainer.

### Option B — Under your own GitHub account/org

Create a new public repo on GitHub (e.g. `github.com/nextologies/companion-module-nextologies-nextotalk`) and update `manifest.json` and `package.json` with that URL.

Either way, once the repo exists:

```bash
# Remove the internal dev remote and add GitHub
git remote set-url origin https://github.com/<org>/companion-module-nextologies-nextotalk.git

# Push main branch
git push -u origin main
```

---

## Step 5 — Create and push the version tag

Companion uses git tags shaped `v<semver>` to identify releases.

```bash
git tag v0.4.0
git push origin v0.4.0
```

This triggers the `companion-module-checks.yaml` CI workflow, which runs the official Bitfocus module validation suite. The workflow must pass (green) before submission.

Check the Actions tab on GitHub after pushing the tag.

---

## Step 6 — Create a GitHub Release

Go to the GitHub repo → **Releases** → **Draft a new release**.

- Tag: `v0.4.0` (select the one you just pushed)
- Title: `v0.4.0`
- Release notes: summarise what the module does and any known requirements (NextoTalk app version, WebSocket URL format, etc.)

Publish the release. GitHub Actions (`companion-module-checks.yaml`) will build and optionally attach a `.pkg` artifact.

---

## Step 7 — Submit to Bitfocus module list

Fork and open a PR against `bitfocus/companion-bundled-modules`:

1. Fork `https://github.com/bitfocus/companion-bundled-modules`
2. In the forked repo, add an entry for this module in the appropriate list file (typically `modules.json` or a similar registry file — check the repo for the exact format)
3. Entry fields usually required:
   - `id`: `nextologies-nextotalk`
   - `repository`: the GitHub URL
   - `manufacturer`: `Nextologies Limited`
4. Open a PR with a clear description: what the module controls, what hardware/software it targets, and a link to the GitHub release

The Bitfocus team reviews PRs periodically. Join their Discord for faster feedback.

---

## Step 8 — Post-publish verification

Once the PR is merged and Companion picks up the new module listing:

1. Download the latest Companion release
2. Open the module store and search for "Nextologies" or "NextoTalk"
3. Install the module and configure a connection (host + port)
4. Confirm actions (mute, unmute, push-to-talk) work end-to-end with a real NextoTalk session

---

## Checklist summary

- [ ] `companion/HELP.md` written with real content
- [ ] `companion/manifest.json` — `keywords`, `products`, and URLs finalised
- [ ] `yarn build && yarn lint` passes locally
- [ ] `yarn package` passes with no validation errors
- [ ] Public GitHub repo created and `origin` remote updated
- [ ] `main` branch pushed to GitHub
- [ ] Tag `v0.4.0` pushed; CI passes on GitHub Actions
- [ ] GitHub Release `v0.4.0` published
- [ ] PR opened against `bitfocus/companion-bundled-modules`
- [ ] Module verified in a live Companion installation

---

## Key links

- Bitfocus Companion module dev docs: https://github.com/bitfocus/companion-module-base
- Bitfocus bundled modules registry: https://github.com/bitfocus/companion-bundled-modules
- Bitfocus Discord (module-development channel): https://discord.gg/bitfocus-companion
- Module checks workflow: `.github/workflows/companion-module-checks.yaml`
