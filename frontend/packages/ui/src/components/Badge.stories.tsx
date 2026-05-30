import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge.js';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { children: 'Tier 3' },
};
export default meta;

type Story = StoryObj<typeof Badge>;
export const Neutral: Story = { args: { tone: 'neutral' } };
export const Safe: Story = { args: { tone: 'safe', children: 'Within MAASP' } };
export const Info: Story = { args: { tone: 'info', children: 'AR6 GWP' } };
export const Warn: Story = { args: { tone: 'warn', children: 'Tier 2' } };
export const Danger: Story = { args: { tone: 'danger', children: 'Exceeds MAASP' } };
