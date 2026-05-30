import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select.js';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
  args: {
    label: 'Module',
    options: [
      { value: 'general', label: 'General' },
      { value: 'well_control', label: 'Well Control' },
      { value: 'emissions_mrv', label: 'Emissions / MRV' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Select>;
export const Basic: Story = {};
export const WithError: Story = { args: { error: 'Module is required.' } };
