# Agent Skills Loader

A standalone, reusable module for loading and managing AI Agent Skills from Markdown files, following the [agentskills.io](https://agentskills.io) standard.

Extracted from the [pi-coding-agent](https://github.com/badlogic/pi-mono) core.

## Features

- **Recursive Discovery**: Automatically finds skills in multi-level directory structures.
- **YAML Frontmatter**: Supports metadata like `name`, `description`, and `disable-model-invocation`.
- **Validation**: Strict naming and description length checks following the spec.
- **XML Formatting**: One-click generation of the `<available_skills>` block for LLM system prompts.
- **Context Aware**: Respects `.gitignore`, `.ignore`, and `.fdignore` files during discovery.

## Installation

```bash
npm install agent-skills-loader
```

## Usage

```typescript
import { loadSkills, formatSkillsForPrompt } from 'agent-skills-loader';

// Load skills from specific paths
const result = loadSkills({
  skillPaths: ['./my-skills', './shared/global-skills.md']
});

console.log(`Loaded ${result.skills.length} skills.`);

// Generate the XML block for your LLM system prompt
const xmlBlock = formatSkillsForPrompt(result.skills);
console.log(xmlBlock);
```

## Skill File Format (SKILL.md)

```markdown
---
name: my-skill
description: Useful for performing complex data analysis
---

## Instructions
When the user asks for analysis...
```

## License

MIT
