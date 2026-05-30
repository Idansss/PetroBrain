import type { Meta, StoryObj } from '@storybook/react';
import { CitationChip } from './CitationChip.js';

const meta: Meta<typeof CitationChip> = {
  title: 'Primitives/CitationChip',
  component: CitationChip,
};
export default meta;

type Story = StoryObj<typeof CitationChip>;

export const FullCitation: Story = {
  args: {
    citation: { title: 'NUPRC Guideline', revision: 'Rev 3', clause: '4.2.1' },
  },
};

export const ClauseOnly: Story = {
  args: { citation: { title: null, revision: null, clause: '2.1' } },
};

export const TitleOnly: Story = {
  args: { citation: { title: 'API RP 53', revision: null, clause: null } },
};
