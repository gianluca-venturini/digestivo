# Agent instructions

## Version number

The version has the form `MAJOR.MINOR.PATCH`, for example `0.4.0`.
`manifest.json` (`"version"`) is the source. `build.sh` reads it to name the
zip `dist/hn-summary-v<version>.zip`.

Rules:

- **New feature:** increase MINOR by 1 and set PATCH to 0. Example: `0.4.0` → `0.5.0`.
- **Fix only (no new feature):** increase PATCH by 1. Example: `0.4.0` → `0.4.1`.
- Change the version one time per branch or pull request, not one time per commit.
- Do not change MAJOR unless the user asks.

When you change the version, also update these files:

1. `manifest.json`: `"version"`.
2. `README.md`: the zip name `dist/hn-summary-v<version>.zip` (two places).
3. `PRIVACY.md`: the version on the "Last updated" line, if the change affects privacy.
4. The plan in `plans/` for the change: "Version target".
5. Run `./build.sh` to make the new zip.
