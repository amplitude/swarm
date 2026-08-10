import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const uiMockup: SkillDefinition = {
  id: 'ui_mockup',
  name: 'UI Mockup',
  description: 'Create UI wireframes and mockups.',
  promptFragment: `When creating UI mockups:
- Use Excalidraw elements for wireframes and layout sketches
- Position elements with realistic spacing (8px grid)
- Include labels for all interactive elements
- Show the main states (default, hover, error, empty, loading) when relevant
- Keep wireframes simple — show structure, not pixel-perfect design`,
  requiredTools: ['render_excalidraw'],
};

skillRegistry.register(uiMockup);
export { uiMockup };
