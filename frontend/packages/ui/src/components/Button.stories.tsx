import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button.js';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Generate kill sheet' },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary', size: 'md' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Refuse bypass' } };
export const LargeFieldTap: Story = { args: { variant: 'primary', size: 'lg' } };
export const Loading: Story = { args: { loading: true, children: 'Running…' } };
export const Disabled: Story = { args: { disabled: true } };
