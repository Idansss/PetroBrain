import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CarbonCalculator } from './CarbonCalculator';

describe('CarbonCalculator', () => {
  it('renders a worksheet-style emissions calculator with live totals', async () => {
    const user = userEvent.setup();
    render(<CarbonCalculator />);

    expect(screen.getByText('Carbon calculator')).toBeInTheDocument();
    expect(screen.getAllByText('Diesel generator fuel').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Monthly operating breakdowns')).toBeInTheDocument();
    expect(screen.getAllByText('Quarter total').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('Grid electricity').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Natural gas').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('1,758.61')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Diesel generator fuel activity data'), '100');
    await user.type(screen.getByLabelText('Grid electricity January activity data'), '200');

    expect(screen.getByText('268 kgCO2')).toBeInTheDocument();
    expect(screen.getByText('100 kgCO2')).toBeInTheDocument();
  });
});
