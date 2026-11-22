# Third-party agent skills

## Committed in this repo (license allows redistribution)

| Skill | Source | Version | License |
|---|---|---|---|
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | copy taken from the team's `settleup-clone` install | MIT (`design-taste-frontend/LICENSE`) |
| `tdd`, `code-review`, `domain-modeling`, `pr`, `grilling` | [mattpocock-skills](https://github.com/mattpocock/skills) (Claude plugin `mattpocock-skills@claude-plugins-official`) | 1.3.1, commit `49dd158` | MIT (`LICENSE` in each folder) |

These copies are unmodified. Project rules live in `CODING_STANDARDS.md`,
`AGENTS.md`, `docs/agents/` and the project skills, not in edits to these
folders, so they can be refreshed by copying a newer version over them.

## Installed on demand, not committed

Listed in `skills-lock.json`, ignored by git, restored with:

```bash
yarn skills:install
```

| Skill | Source | Why not committed |
|---|---|---|
| `transitions-dev`, `transitions-polish` | [Jakubantalik/transitions.dev](https://transitions.dev) | Its license allows use in products but forbids republishing the collection; a public repo would republish it. |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Installed copy ships without a license file; kept out until verified. |
| `svg-logo-designer` | [rknall/claude-skills](https://github.com/rknall/claude-skills) | No open-source license ("provided as-is for use with Claude Code"). Instructions only, no scripts; skillspector static scan: 0/100, SAFE. |

`yarn skills:update` updates them to the latest upstream commit.

## Project skills (written for this repo)

`nestjs-module`, `raw-sql-migration`, `nextjs-page`, `vankinh-ui`,
`video-access`, `payment-integration`, `e2e-playwright`.
