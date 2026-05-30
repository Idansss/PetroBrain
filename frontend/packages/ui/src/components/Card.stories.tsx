import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card.js';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;
export const Basic: Story = {
  args: {
    title: 'Methane intensity',
    description: 'CH₄ tonnes / mscf gas produced.',
    children: '0.18%',
  },
};
