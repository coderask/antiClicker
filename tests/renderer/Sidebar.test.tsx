// tests/renderer/Sidebar.test.tsx
//
// Phase 5: Sidebar component tests using @testing-library/react + happy-dom.
// Verifies: empty state, instance rows rendered, active row testid, click-to-focus,
// close button stops propagation and doesn't trigger focus.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar, { type SidebarInstance } from '../../src/renderer/src/Sidebar';

// Helper: create a test instances Map
function makeInstances(ids: string[]): Map<string, SidebarInstance> {
  const colors = ['#e74c3c', '#3498db', '#2ecc71'];
  return new Map(
    ids.map((id, i) => [
      id,
      {
        id,
        coords: { latitude: 35 + i, longitude: 139 + i },
        color: colors[i % colors.length],
      },
    ]),
  );
}

describe('Sidebar', () => {
  it('renders empty state when no instances', () => {
    render(
      <Sidebar
        instances={new Map()}
        activeId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/no active instances/i)).toBeInTheDocument();
    expect(screen.queryByTestId('instance-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('instance-row-active')).not.toBeInTheDocument();
  });

  it('renders one row per instance', () => {
    const instances = makeInstances(['abc-111', 'abc-222', 'abc-333']);
    render(
      <Sidebar
        instances={instances}
        activeId={null}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // All 3 are non-active
    const rows = screen.getAllByTestId('instance-row');
    expect(rows).toHaveLength(3);
    expect(screen.queryByTestId('instance-row-active')).not.toBeInTheDocument();
  });

  it('active row has data-testid="instance-row-active"', () => {
    const instances = makeInstances(['id1', 'id2', 'id3']);
    render(
      <Sidebar
        instances={instances}
        activeId="id2"
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('instance-row-active')).toBeInTheDocument();
    const inactiveRows = screen.getAllByTestId('instance-row');
    expect(inactiveRows).toHaveLength(2);
  });

  it('clicking a row fires onFocus with the correct id', () => {
    const onFocus = vi.fn();
    const instances = makeInstances(['id-alpha', 'id-beta']);
    render(
      <Sidebar
        instances={instances}
        activeId={null}
        onFocus={onFocus}
        onClose={vi.fn()}
      />,
    );

    const rows = screen.getAllByTestId('instance-row');
    fireEvent.click(rows[1]); // click second row (id-beta)

    expect(onFocus).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalledWith('id-beta');
  });

  it('clicking close button fires onClose with the correct id', () => {
    const onClose = vi.fn();
    const instances = makeInstances(['inst-x', 'inst-y']);
    render(
      <Sidebar
        instances={instances}
        activeId={null}
        onFocus={vi.fn()}
        onClose={onClose}
      />,
    );

    const closeBtn = screen.getByTestId('close-inst-x');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith('inst-x');
  });

  it('clicking close button does NOT fire onFocus (stops propagation)', () => {
    const onFocus = vi.fn();
    const onClose = vi.fn();
    const instances = makeInstances(['inst-a']);
    render(
      <Sidebar
        instances={instances}
        activeId={null}
        onFocus={onFocus}
        onClose={onClose}
      />,
    );

    const closeBtn = screen.getByTestId('close-inst-a');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
    expect(onFocus).not.toHaveBeenCalled();
  });
});
