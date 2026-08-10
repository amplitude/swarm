import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const designReview: SkillDefinition = {
  id: 'design_review',
  name: 'Design Review',
  description: 'Review designs for usability and visual consistency.',
  promptFragment: `When reviewing designs:
- Check for visual hierarchy and clarity
- Verify consistent spacing, colors, and typography
- Consider accessibility (contrast, touch targets, screen readers)
- Suggest improvements with specific rationale
- Reference the existing design system when applicable`,
};

skillRegistry.register(designReview);
export { designReview };
