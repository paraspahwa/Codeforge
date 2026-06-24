# Cursor rules index

CodeForge uses layered rules. **Always-on:** `karpathy-guidelines.mdc`, `codeforge-project.mdc`.

Vendored rules live in [`awesome-cursorrules/`](awesome-cursorrules/) (~257 files). They activate by **glob** — only edit matching files trigger them.

## Recommended rules by stack

| Stack | Example rule files (search in `awesome-cursorrules/`) |
|-------|--------------------------------------------------------|
| Next.js / React | `nextjs*.mdc`, `react.mdc`, `typescript*.mdc` |
| FastAPI / Python API | `fastapi.mdc`, `python.mdc` |
| Testing | `playwright*.mdc`, `pytest` / `testing` rules |
| Accessibility | `a11y`, `accessibility` rules |
| Tailwind / CSS | `tailwind.mdc` |

## Stacks to ignore for this repo

Angular, Flutter, Solidity, Vue-only, and mobile-native rules do not apply unless you are editing those paths.

## Adding rules

1. Drop new `.mdc` files under `.cursor/rules/` or `awesome-cursorrules/`.
2. Set accurate `globs` and `description` in frontmatter.
3. Prefer narrow globs (e.g. `apps/web/**/*.jsx`) over broad `**/*`.

## Verification

```bash
# List rule files
ls .cursor/rules/awesome-cursorrules | wc -l
```

When unsure which rule applies, follow `codeforge-project.mdc` and the file’s own glob patterns.
