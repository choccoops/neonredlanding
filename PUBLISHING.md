# Publishing and updating Neon Hub

Same process as Neon Market: pushing a version tag builds a release with a `module.json` and
`module.zip` that Foundry installs and updates from.

## First-time setup

Create an empty, **public** repository named `cpr-neon-hub` on GitHub or GitLab, then from this folder:

```bash
git remote add origin https://github.com/YOUR-NAME/cpr-neon-hub.git
git push -u origin main --tags
```

The `v1.0.0` tag runs the first release (**Actions** on GitHub, **Build > Pipelines** on GitLab).

**Manifest URL for Foundry's Install Module box:**

- GitHub: `https://github.com/YOUR-NAME/cpr-neon-hub/releases/latest/download/module.json`
- GitLab: `https://gitlab.com/YOUR-NAME/cpr-neon-hub/-/releases/permalink/latest/downloads/module.json`

## Releasing an update

1. Make your changes.
2. Add a `## 1.1.0` section at the top of `CHANGELOG.md` (it becomes the release notes).
3. Set `"version"` in `module.json` to the same number.
4. Commit, tag and push:

```bash
git add -A
git commit -m "Release 1.1.0"
git tag v1.1.0
git push && git push --tags
```

The build syntax-checks every script first and stops the release if one is broken.

## Moving to Foundry v13

When the Cyberpunk RED team publishes their v13 release, install it with MATT's v13 release, test
a hub and an HQ, then set `"compatibility": { "minimum": "12", "verified": "13" }` and release.
The data the module relies on is listed in the README.
