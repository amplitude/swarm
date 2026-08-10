import { describe, it, expect, beforeAll } from 'vitest';
import { toolRegistry } from '@/tools/registry';
import { skillRegistry } from '@/skills/registry';

describe('Registry population on app boot', () => {
  beforeAll(async () => {
    // Simulate what main.tsx does: import the definition index modules
    // which trigger self-registration via side effects.
    await import('@/tools/definitions');
    await import('@/skills/definitions');
  });

  it('tool registry is populated on app boot', () => {
    const allTools = toolRegistry.getAll();
    // main.tsx imports 10 tool definition files (run-javascript, preview-html,
    // render-mermaid, render-excalidraw, create-file, edit-file, search-code,
    // create-task, handoff, web-search)
    expect(allTools.length).toBeGreaterThan(0);
    expect(allTools.length).toBeGreaterThanOrEqual(10);

    // Verify a known tool is present
    expect(toolRegistry.has('handoff_to_agent')).toBe(true);
    expect(toolRegistry.has('run_javascript')).toBe(true);
  });

  it('skill registry is populated on app boot', () => {
    const allSkills = skillRegistry.getAll();
    // main.tsx imports 13 skill definition files (code-generation, code-review,
    // debugging, refactoring, task-breakdown, requirements-analysis, roadmap-planning,
    // diagram-creation, ui-mockup, design-review, summarization, brainstorming, research)
    expect(allSkills.length).toBeGreaterThan(0);
    expect(allSkills.length).toBeGreaterThanOrEqual(13);

    // Verify a known skill is present
    const skillIds = allSkills.map((s) => s.id);
    expect(skillIds).toContain('code_generation');
    expect(skillIds).toContain('debugging');
  });
});
