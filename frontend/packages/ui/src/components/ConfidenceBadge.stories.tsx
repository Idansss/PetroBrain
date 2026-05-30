import type { Meta, StoryObj } from '@storybook/react';
import { ConfidenceBadge } from './ConfidenceBadge.js';

const meta: Meta<typeof ConfidenceBadge> = {
  title: 'Primitives/ConfidenceBadge',
  component: ConfidenceBadge,
};
export default meta;

type Story = StoryObj<typeof ConfidenceBadge>;
export const High: Story = { args: { label: 'high', reason: 'Two SOP clauses cited.' } };
export const Medium: Story = { args: { label: 'medium', reason: 'One clause; no measurement.' } };
export const Low: Story = { args: { label: 'low', reason: 'Inferred from prose; no citation.' } };
export const Unknown: Story = { args: { label: 'unknown' } };
