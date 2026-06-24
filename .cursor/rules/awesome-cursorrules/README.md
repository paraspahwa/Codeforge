# Awesome Cursor Rules (vendored)

Community Cursor project rules from [PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules).

## Contents

- **257** `.mdc` rule files covering frontend, backend, mobile, testing, security, DevOps, and language-specific guidance.
- Rules use scoped `globs` and `alwaysApply: false` by default, so only relevant rules attach when matching files are open.

## Source

| Field | Value |
|-------|-------|
| Repository | https://github.com/PatrickJS/awesome-cursorrules |
| Imported commit | `b044f956f021b6e8877f16781bcfc466a6a120e9` |
| License | See upstream repository |

## Project-specific rules

Top-level rules in `.cursor/rules/` (outside this folder) are project-owned:

- `karpathy-guidelines.mdc` — always-on behavioral guidelines for this repo

## Refresh from upstream

```bash
git clone --depth 1 https://github.com/PatrickJS/awesome-cursorrules.git .tmp-awesome-cursorrules
cp .tmp-awesome-cursorrules/rules/*.mdc .cursor/rules/awesome-cursorrules/
rm -rf .tmp-awesome-cursorrules
```

Then update the commit hash in this README.

## Usage

Cursor auto-discovers `.mdc` files under `.cursor/rules/` (including nested folders). Pick rules in **Cursor Settings → Rules**, or let them auto-attach via `globs` when you edit matching files.
