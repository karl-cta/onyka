# Contributing to Onyka

## Quick Start

```bash
# Fork on GitHub, then:
git clone https://github.com/<your-username>/onyka.git
cd onyka
pnpm install
pnpm dev
```

`pnpm dev` handles everything automatically — generates secrets, runs migrations, starts frontend (`:5173`) and backend (`:3001`). No `.env` to create, no manual setup.

## Workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/) and sign-off:
   ```bash
   git commit -s -m "feat: describe your change"
   ```
   Husky runs **lint-staged** (ESLint + Prettier) automatically on pre-commit.
4. Push and open a Pull Request against `karl-cta/onyka`

## Commit Prefixes

`feat:` new feature · `fix:` bug fix · `docs:` documentation · `refactor:` restructure · `test:` tests · `chore:` maintenance

## Code Style

- **TypeScript** everywhere
- **ESLint + Prettier** enforced via pre-commit hook — or run manually: `pnpm lint && pnpm format`
- **Ionicons** (`react-icons/io5`) for icons
- Follow existing patterns in the codebase

## Useful Commands

```bash
pnpm dev              # Start dev (auto-setup + hot reload)
pnpm build            # Build all packages
pnpm lint             # ESLint
pnpm typecheck        # TypeScript checks
pnpm test             # Run tests
pnpm db:generate      # Generate migrations from schema changes
pnpm db:migrate       # Apply migrations
pnpm db:studio        # Open Drizzle Studio (DB GUI)
```

If you modify `packages/shared/`, rebuild it first: `pnpm --filter @onyka/shared build`

## Project Structure

```
apps/web/        → React frontend (Vite, Zustand, TipTap, Tailwind)
apps/server/     → Express backend (Drizzle ORM, SQLite)
packages/shared/ → Shared TypeScript types
scripts/         → setup, dev server, backup, prod start
```

## DCO (Developer Certificate of Origin)

All commits must include a `Signed-off-by` line (`git commit -s`). This certifies you have the right to submit the code under the [AGPL-3.0](LICENSE) license.

## Reporting Issues

Use [GitHub Issues](https://github.com/karl-cta/onyka/issues). Include steps to reproduce, expected vs actual behavior, and screenshots for UI bugs.
