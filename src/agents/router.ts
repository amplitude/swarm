import type { AgentType, RouterDecision } from '@/types/agent';

/**
 * Keyword-based agent router (v1).
 * Analyzes the user message to determine which agent should handle it.
 * A future v2 could use the LLM itself to route.
 */
export function routeMessage(userMessage: string): RouterDecision {
  const text = userMessage.toLowerCase();

  // Score each agent based on keyword matches
  const scores: Record<AgentType, number> = {
    manager: 0,
    coder: 0,
    pm: 0,
    designer: 0,
    general: 0,
  };

  // Coder keywords
  const coderKeywords = [
    'code', 'function', 'bug', 'debug', 'error', 'fix', 'implement',
    'javascript', 'typescript', 'python', 'html', 'css', 'react',
    'program', 'script', 'compile', 'run', 'execute', 'variable',
    'class', 'method', 'api', 'algorithm', 'data structure', 'regex',
    'refactor', 'test', 'unit test', 'syntax', 'import', 'export',
  ];

  // PM keywords
  const pmKeywords = [
    'task', 'plan', 'roadmap', 'milestone', 'requirement', 'feature',
    'breakdown', 'epic', 'sprint', 'backlog', 'priority', 'deadline',
    'project', 'schedule', 'scope', 'estimate', 'track', 'manage',
    'stakeholder', 'user story', 'acceptance criteria',
  ];

  // Designer keywords
  const designerKeywords = [
    'design', 'diagram', 'flowchart', 'wireframe', 'mockup', 'ui',
    'ux', 'layout', 'mermaid', 'excalidraw', 'sketch', 'visual',
    'draw', 'chart', 'graph', 'architecture diagram', 'sequence diagram',
    'color', 'font', 'style', 'component', 'prototype',
  ];

  for (const kw of coderKeywords) {
    if (text.includes(kw)) scores.coder += 1;
  }
  for (const kw of pmKeywords) {
    if (text.includes(kw)) scores.pm += 1;
  }
  for (const kw of designerKeywords) {
    if (text.includes(kw)) scores.designer += 1;
  }

  // Find the best match
  let best: AgentType = 'general';
  let bestScore = 0;

  for (const [agent, score] of Object.entries(scores) as Array<[AgentType, number]>) {
    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }

  // Calculate confidence as a rough ratio
  const totalKeywordHits = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalKeywordHits > 0 ? bestScore / totalKeywordHits : 0;

  // Default to general if no strong signal
  if (bestScore === 0) {
    return {
      selectedAgent: 'general',
      confidence: 0.5,
      reasoning: 'No specialized keywords detected; routing to general assistant.',
    };
  }

  return {
    selectedAgent: best,
    confidence: Math.min(confidence, 1),
    reasoning: `Matched ${bestScore} keyword(s) for ${best} agent.`,
  };
}
