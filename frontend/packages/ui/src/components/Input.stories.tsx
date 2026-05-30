import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input.js';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  args: { label: 'Original mud weight' },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Basic: Story = {};
export const WithUnit: Story = { args: { unit: 'ppg', placeholder: '9.6' } };
export const WithHint: Story = { args: { hint: 'Active circulating system at shut-in.' } };
export const WithError: Story = {
  args: { error: 'TVD must be greater than zero.', value: '0', readOnly: true },
};
