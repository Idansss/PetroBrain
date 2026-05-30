import type { Meta, StoryObj } from '@storybook/react';
import { Banner } from './Banner.js';

const meta: Meta<typeof Banner> = {
  title: 'Primitives/Banner',
  component: Banner,
};
export default meta;

type Story = StoryObj<typeof Banner>;

export const Verification: Story = {
  args: {
    tone: 'info',
    title: 'DECISION SUPPORT ONLY',
    children:
      'Verify all kill-sheet numbers with the competent person before acting. Confirm TVD vs MD and unit system.',
  },
};

export const LiveEvent: Story = {
  args: {
    tone: 'danger',
    title: 'IMMEDIATE ACTION FIRST',
    children:
      'Alert the driller and Well Site Leader. Follow your rig’s shut-in procedure. Record SIDPP, SICP, and pit gain once shut in.',
  },
};

export const ToolWarning: Story = {
  args: {
    tone: 'warn',
    title: 'Tier 2 source on inventory',
    children:
      'This source is still factor-based. Move to measurement-based Tier 3 before the Jan-2027 deadline.',
  },
};
