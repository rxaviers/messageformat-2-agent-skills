# MessageFormat 2 Agent Skills

Reusable agent skills for working with [Unicode MessageFormat 2](https://unicode.org/reports/tr35/tr35-messageFormat.html) messages, related resource proposals, and tooling.

> `.mfr` files use the proposed [W3C Message Resources](https://github.com/w3c/i18n-discuss/tree/gh-pages/explainers) container format. Message Resources are not currently part of the Unicode MF2 standard.

## Quick Start

Use the open [`skills` CLI](https://github.com/vercel-labs/skills) to install skills into Codex, Claude Code, Cursor, OpenCode, Pi, and other supported agents.

Install all skills from this repository:

```sh
npx skills add rxaviers/messageformat-2-agent-skills
```

Browse the available skills before installing:

```sh
npx skills add rxaviers/messageformat-2-agent-skills --list
```

Use a skill without installing it. The first command prints a generated prompt; the second starts Codex with it:

```sh
npx skills use rxaviers/messageformat-2-agent-skills@messageformat-2-resource-syntax
npx skills use rxaviers/messageformat-2-agent-skills --skill messageformat-2-resource-syntax --agent codex
```

Remove the installed skill:

```sh
npx skills remove messageformat-2-resource-syntax
```

## Available Skills

| Skill | What it does |
| --- | --- |
| [`messageformat-2-syntax`](skills/messageformat-2-syntax/) | Authors, edits, and validates Unicode MessageFormat 2 message syntax. |
| [`messageformat-2-resource-syntax`](skills/messageformat-2-resource-syntax/) | Authors, edits, and validates proposed W3C Message Resource (`.mfr`) syntax. |

Each skill is self-contained in `skills/<skill-name>/` and follows the shared [Agent Skills specification](https://agentskills.io/).
