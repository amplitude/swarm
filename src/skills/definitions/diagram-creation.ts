import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const diagramCreation: SkillDefinition = {
  id: 'diagram_creation',
  name: 'Diagram Creation',
  description: 'Create clear, well-structured diagrams using Mermaid or Excalidraw.',
  promptFragment: `When creating diagrams:
- Choose Mermaid for flowcharts, sequence diagrams, class diagrams, Gantt charts, and ER diagrams
- Choose Excalidraw for freeform wireframes, architecture sketches, and UI mockups
- Keep diagrams focused — show the key relationships, not every detail
- Use clear, short labels on nodes and edges
- For Mermaid: use the correct diagram type prefix (graph, sequenceDiagram, classDiagram, gantt, erDiagram)
- For Excalidraw: provide well-positioned elements with proper x, y, width, height`,
  examples: [
    {
      userMessage: 'Draw a flowchart for user authentication',
      assistantResponse: 'Here is an authentication flowchart.',
      toolCalls: [
        {
          toolId: 'render_mermaid',
          parameters: {
            definition: 'graph TD\n  A[User visits login] --> B{Has account?}\n  B -->|Yes| C[Enter credentials]\n  B -->|No| D[Sign up]\n  C --> E{Valid?}\n  E -->|Yes| F[Dashboard]\n  E -->|No| G[Show error]',
          },
        },
      ],
    },
  ],
  requiredTools: ['render_mermaid', 'render_excalidraw'],
};

skillRegistry.register(diagramCreation);
export { diagramCreation };
