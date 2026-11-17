# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Claude-specific notes

- `AGENTS.md` (imported above) is the shared source of truth for all agents. Put repo-wide guidance there, not here; use this file only for Claude Code–specific details.
- Use the workspace commands documented in `AGENTS.md`; run them from the repository root.
- The `pick-ui-library` skill sets `disable-model-invocation: true`, so Claude cannot invoke it automatically. For library-selection questions, read `.agents/skills/pick-ui-library/SKILL.md` directly and follow its curated list. The user can also run `/pick-ui-library`.
- `.claude/skills/pick-ui-library` is a symlink. Edit `.agents/skills/pick-ui-library/SKILL.md` instead. The skill was installed from `emilkowalski/skills`, and `skills-lock.json` holds its computed hash, so local edits will no longer match the lock.
- `.claude/settings.local.json` holds personal, machine-local permissions. Don't add project-wide settings to it.
