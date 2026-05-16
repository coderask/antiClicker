// tests/renderer/Favorites.test.tsx
//
// Phase 7: Favorites component tests using @testing-library/react + happy-dom.
// Verifies: empty state, list render, click-to-select, delete, propagation guard.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Favorites, { type Favorite } from '../../src/renderer/src/Favorites';

const sample: Favorite[] = [
  { id: 'a1', name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, createdAt: 1000 },
  { id: 'b2', name: 'London', latitude: 51.5074, longitude: -0.1278, createdAt: 2000 },
];

describe('Favorites', () => {
  it('renders empty state when no favorites', () => {
    render(<Favorites favorites={[]} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('favorites-empty')).toBeTruthy();
  });

  it('renders all favorite rows', () => {
    render(<Favorites favorites={sample} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByTestId('favorite-row')).toHaveLength(2);
  });

  it('shows favorite names in the rows', () => {
    render(<Favorites favorites={sample} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/Tokyo/)).toBeTruthy();
    expect(screen.getByText(/London/)).toBeTruthy();
  });

  it('calls onSelect with correct coords when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<Favorites favorites={sample} onSelect={onSelect} onDelete={vi.fn()} />);
    fireEvent.click(screen.getAllByTestId('favorite-row')[0]);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith({ latitude: 35.6762, longitude: 139.6503 });
  });

  it('calls onSelect with the correct coords for the second favorite', () => {
    const onSelect = vi.fn();
    render(<Favorites favorites={sample} onSelect={onSelect} onDelete={vi.fn()} />);
    fireEvent.click(screen.getAllByTestId('favorite-row')[1]);
    expect(onSelect).toHaveBeenCalledWith({ latitude: 51.5074, longitude: -0.1278 });
  });

  it('calls onDelete with the correct id when the delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<Favorites favorites={sample} onSelect={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getAllByTestId('favorite-delete')[0]);
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith('a1');
  });

  it('does NOT call onSelect when the delete button is clicked', () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(<Favorites favorites={sample} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getAllByTestId('favorite-delete')[0]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the delete button for each row', () => {
    render(<Favorites favorites={sample} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByTestId('favorite-delete')).toHaveLength(2);
  });

  it('truncates long names at 24 characters', () => {
    const longName = 'A'.repeat(30);
    const favs: Favorite[] = [
      { id: 'x', name: longName, latitude: 0, longitude: 0, createdAt: 0 },
    ];
    render(<Favorites favorites={favs} onSelect={vi.fn()} onDelete={vi.fn()} />);
    // The rendered name should be truncated with ellipsis
    const row = screen.getByTestId('favorite-row');
    expect(row.textContent).toContain('…');
  });

  it('caps display at 100 favorites', () => {
    const many: Favorite[] = Array.from({ length: 150 }, (_, i) => ({
      id: `id${i}`,
      name: `Fav ${i}`,
      latitude: 0,
      longitude: 0,
      createdAt: i,
    }));
    render(<Favorites favorites={many} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByTestId('favorite-row')).toHaveLength(100);
  });
});
