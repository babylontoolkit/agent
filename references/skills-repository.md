# Babylon Toolkit Agent Skills

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL BABYLON TOOLKIT SKILLS INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

## Repo

You can download and install the skills from the repo at: https://github.com/babylontoolkit/skills.git

## Skills

| Skill | Command | What it does |
|-------|---------|--------------|
| [`spec`](skills/spec/SKILL.md) | `/spec` | Turn a short idea into a feature spec file on a new git branch. |
| [`plan`](skills/plan/SKILL.md) | `/plan` | Produce a detailed, task-checklist technical plan from a spec. |
| [`execute`](skills/execute/SKILL.md) | `/execute` | Implement one task (or all remaining tasks) from a plan/spec. |
| [`convert`](skills/convert/SKILL.md) | `/convert` | Convert Unity C# scripts to Babylon Toolkit TypeScript. |

Every tool derives the slash-command from the **folder name** (`spec/` → `/spec`) and reads
the frontmatter `name` + `description` to decide when the skill applies. The `allowed-tools`
line is honored by Claude Code (auto-approves those tools) and safely ignored by Codex and
Copilot.

## Installation

When the user request to `install the agent skills` or `install the babylon toolkit skills` or something like that,
either download and install the skills from the github repo located at https://github.com/babylontoolkit/skills.git into
the appropriate global or local project location, or install the `Native Claude Code Plugin` globally. If the user did **NOT** specify
what type install to do, please prompt the user select the type of installation to perform.

### Local Skills Installation

| Tool | Skills directory |
|------|------------------|
| Claude Code | `.claude/skills/` *(also read by Copilot)* |
| Codex CLI | `.codex/skills/` |
| GitHub Copilot | `.copilot/skills/`, `.claude/skills/`, or `.agents/skills/` |

### Global Skills Installation

| Tool | Skills directory |
|------|------------------|
| Claude Code | `~/.claude/skills/` *(also read by Copilot)* |
| Codex CLI | `~/.codex/skills/` |
| GitHub Copilot | `~/.copilot/skills/`, `~/.claude/skills/`, or `~/.agents/skills/` |

### Native Claude Code Installation

To install from marketplace:
```
/plugin marketplace add babylontoolkit/skills
/plugin install agent-skills@babylon-toolkit
```
