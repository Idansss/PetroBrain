import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InventoryBuilder } from './InventoryBuilder';

describe('InventoryBuilder', () => {
  it('renders source entry fields without raw payload keys or JSON formatting', () => {
    render(
      <InventoryBuilder
        pending={false}
        error={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Emission sources')).toBeInTheDocument();
    expect(screen.getByLabelText('Source tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Gas volume')).toBeInTheDocument();
    expect(screen.getByLabelText('Methane in gas')).toBeInTheDocument();
    expect(screen.getByLabelText('Combustion efficiency')).toBeInTheDocument();
    expect(screen.queryByText(/source_id/)).not.toBeInTheDocument();
    expect(screen.queryByText(/source_type/)).not.toBeInTheDocument();
    expect(screen.queryByText(/params/)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/[{}]/)).not.toBeInTheDocument();
  });
});
