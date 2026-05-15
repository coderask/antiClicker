// tests/renderer/CoordInput.test.tsx
//
// Phase 4: CoordInput React component tests using @testing-library/react + happy-dom.
// Verifies: form renders, invalid lat shows error, valid submit fires callback,
// Google Maps URL paste auto-populates inputs, invalid URL shows error.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CoordInput from '../../src/renderer/src/CoordInput';

describe('CoordInput', () => {
  it('renders lat-input, lng-input, coord-submit, and maps-url-input', () => {
    render(<CoordInput onSubmit={vi.fn()} />);
    expect(screen.getByTestId('lat-input')).toBeInTheDocument();
    expect(screen.getByTestId('lng-input')).toBeInTheDocument();
    expect(screen.getByTestId('coord-submit')).toBeInTheDocument();
    expect(screen.getByTestId('maps-url-input')).toBeInTheDocument();
  });

  it('shows validation error when latitude is out of range', async () => {
    render(<CoordInput onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByTestId('lat-input'), { target: { value: '999' } });
    fireEvent.change(screen.getByTestId('lng-input'), { target: { value: '0' } });
    fireEvent.submit(screen.getByTestId('coord-input-form'));

    await waitFor(() => {
      expect(screen.getByTestId('coord-error')).toBeInTheDocument();
    });

    const errorText = screen.getByTestId('coord-error').textContent ?? '';
    expect(errorText.length).toBeGreaterThan(0);
  });

  it('shows error when non-numeric latitude is submitted', async () => {
    render(<CoordInput onSubmit={vi.fn()} />);

    // Leave lat-input empty (NaN after parseFloat)
    fireEvent.change(screen.getByTestId('lat-input'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('lng-input'), { target: { value: '0' } });
    fireEvent.submit(screen.getByTestId('coord-input-form'));

    await waitFor(() => {
      expect(screen.getByTestId('coord-error')).toBeInTheDocument();
    });
  });

  it('calls onSubmit with correct coords for valid lat/lng', async () => {
    const onSubmit = vi.fn();
    render(<CoordInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('lat-input'), { target: { value: '35.6762' } });
    fireEvent.change(screen.getByTestId('lng-input'), { target: { value: '139.6503' } });
    fireEvent.submit(screen.getByTestId('coord-input-form'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    const [coords] = onSubmit.mock.calls[0] as [{ latitude: number; longitude: number }];
    expect(coords.latitude).toBeCloseTo(35.6762, 4);
    expect(coords.longitude).toBeCloseTo(139.6503, 4);
  });

  it('does not call onSubmit and hides no error when valid coords submitted without prior error', async () => {
    const onSubmit = vi.fn();
    render(<CoordInput onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('lat-input'), { target: { value: '-33.8688' } });
    fireEvent.change(screen.getByTestId('lng-input'), { target: { value: '151.2093' } });
    fireEvent.submit(screen.getByTestId('coord-input-form'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

    // No error should be visible
    expect(screen.queryByTestId('coord-error')).not.toBeInTheDocument();
  });

  it('populates lat/lng inputs from a valid Google Maps URL', async () => {
    render(<CoordInput onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByTestId('maps-url-input'), {
      target: { value: 'https://www.google.com/maps/@35.6762,139.6503,15z' },
    });

    await waitFor(() => {
      const latInput = screen.getByTestId('lat-input') as HTMLInputElement;
      const lngInput = screen.getByTestId('lng-input') as HTMLInputElement;
      expect(parseFloat(latInput.value)).toBeCloseTo(35.6762, 4);
      expect(parseFloat(lngInput.value)).toBeCloseTo(139.6503, 4);
    });
  });

  it('shows coord-error when an invalid URL is typed into the URL input', async () => {
    render(<CoordInput onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByTestId('maps-url-input'), {
      target: { value: 'https://www.example.com/notamaps' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('coord-error')).toBeInTheDocument();
    });
  });
});
