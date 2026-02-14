import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadSkills, formatSkillsForPrompt } from './index.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('agent-skills-loader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should load a simple skill from a markdown file', () => {
    const skillPath = path.join(tmpDir, 'test-skill.md');
    fs.writeFileSync(skillPath, '---\nname: test-skill\ndescription: A test skill\n---\nBody');

    const result = loadSkills({ skillPaths: [skillPath] });
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe('test-skill');
    expect(result.skills[0].description).toBe('A test skill');
  });

  it('should load a skill from a subdirectory with SKILL.md', () => {
    const skillDir = path.join(tmpDir, 'complex-skill');
    fs.mkdirSync(skillDir);
    const skillPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, '---\ndescription: Complex skill\n---\nBody');

    const result = loadSkills({ skillPaths: [tmpDir] });
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe('complex-skill');
  });

  it('should generate correct XML for prompt', () => {
    const skills = [{
      name: 'foo',
      description: 'bar',
      filePath: '/path/to/foo.md',
      baseDir: '/path/to',
      source: 'test',
      disableModelInvocation: false
    }];

    const xml = formatSkillsForPrompt(skills);
    expect(xml).toContain('<available_skills>');
    expect(xml).toContain('<name>foo</name>');
    expect(xml).toContain('<description>bar</description>');
  });
});
