import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('presents the product name and the barbershop description', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Ravion Barber' })).toBeInTheDocument();
    expect(screen.getByText('Sistema de gestão para barbearia.')).toBeInTheDocument();
  });
});
