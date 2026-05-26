import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock auth + toast
const { stableUser } = vi.hoisted(() => ({ stableUser: { id: 'user-1' } }));
const { stableAuth } = vi.hoisted(() => ({ stableAuth: { user: { id: 'user-1' } } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}));
const { stableToast } = vi.hoisted(() => ({ stableToast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: stableToast }),
}));

// Mock budget structure (only needs to filter by section name + row_key)
vi.mock('@/lib/budget-structure', () => ({
  defaultBudgetStructure: { sections: [{ name: 'S1', rows: [{ row_key: 'r1' }] }] },
  iopBudgetStructure: { sections: [{ name: 'S1', rows: [{ row_key: 'r1' }] }] },
  evaluateFormula: () => null,
}));

// ---- supabase mock ----
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
function defer<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const mocks: {
  budgetsResponses: Array<Deferred<{ data: any[]; error: null }>>;
  budgetsCallCount: number;
  yearResponse: { data: any; error: null };
} = {
  budgetsResponses: [],
  budgetsCallCount: 0,
  yearResponse: { data: { id: 'year-1', year: 2025, is_locked: false, locked_at: null, locked_by_user_id: null }, error: null },
};

vi.mock('@/integrations/supabase/client', () => {
  const makeBudgetsQuery = () => {
    const q: any = {};
    q.select = () => q;
    q.eq = () => q;
    q.order = () => q;
    q.range = () => {
      const idx = mocks.budgetsCallCount++;
      const d = mocks.budgetsResponses[idx];
      if (!d) return Promise.resolve({ data: [], error: null });
      return d.promise;
    };
    return q;
  };
  const makeYearsQuery = () => {
    const q: any = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = () => Promise.resolve(mocks.yearResponse);
    q.order = () => Promise.resolve({ data: [mocks.yearResponse.data], error: null });
    q.insert = () => ({ select: () => ({ single: () => Promise.resolve(mocks.yearResponse) }) });
    return q;
  };
  const makeStructureQuery = () => {
    const q: any = {};
    q.select = () => q;
    q.eq = () => q;
    q.order = () => Promise.resolve({ data: [], error: null });
    return q;
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'budgets') return makeBudgetsQuery();
        if (table === 'budget_years') return makeYearsQuery();
        return makeStructureQuery();
      },
    },
  };
});

// Import AFTER mocks
import { useBudgetData } from './useBudgetData';

beforeEach(() => {
  mocks.budgetsResponses = [];
  mocks.budgetsCallCount = 0;
});

describe('useBudgetData race conditions', () => {
  it('ignores stale slow response when a newer load supersedes it', async () => {
    const slow = defer<{ data: any[]; error: null }>();
    const fast = defer<{ data: any[]; error: null }>();
    mocks.budgetsResponses = [slow, fast];

    const { result, rerender } = renderHook(
      ({ year }: { year: number }) => useBudgetData(year, 'fac-1', 'unit-1', 'INPATIENT'),
      { initialProps: { year: 2025 } }
    );

    // Wait for first effect to start and consume the slow deferred
    await waitFor(() => expect(mocks.budgetsCallCount).toBeGreaterThanOrEqual(1));

    // Trigger second load before first resolves
    rerender({ year: 2026 });

    await waitFor(() => expect(mocks.budgetsCallCount).toBeGreaterThanOrEqual(2));

    // Resolve the FAST (newer) one first with 2026 data
    await act(async () => {
      fast.resolve({
        data: [{ id: 'b2', row_id: 'row-2026', month: 1, value: 222, facility_id: 'fac-1', created_at: '', created_by: '', updated_at: '' }],
        error: null,
      });
    });

    await waitFor(() => {
      expect(result.current.values['row-2026']?.[1]).toBe(222);
    });

    // Now resolve the STALE slow one with 2025 data — should be ignored
    await act(async () => {
      slow.resolve({
        data: [{ id: 'b1', row_id: 'row-2025', month: 1, value: 999, facility_id: 'fac-1', created_at: '', created_by: '', updated_at: '' }],
        error: null,
      });
      // give microtasks a tick
      await Promise.resolve();
    });

    expect(result.current.values['row-2025']).toBeUndefined();
    expect(result.current.values['row-2026']?.[1]).toBe(222);
  });

  it('ignores stale response after switching unit mid-flight', async () => {
    const slow = defer<{ data: any[]; error: null }>();
    const fast = defer<{ data: any[]; error: null }>();
    mocks.budgetsResponses = [slow, fast];

    const { result, rerender } = renderHook(
      ({ unit }: { unit: string }) => useBudgetData(2025, 'fac-1', unit, 'INPATIENT'),
      { initialProps: { unit: 'unit-A' } }
    );

    await waitFor(() => expect(mocks.budgetsCallCount).toBeGreaterThanOrEqual(1));
    rerender({ unit: 'unit-B' });
    await waitFor(() => expect(mocks.budgetsCallCount).toBeGreaterThanOrEqual(2));

    await act(async () => {
      fast.resolve({
        data: [{ id: 'b2', row_id: 'row-B', month: 3, value: 50, facility_id: 'fac-1', created_at: '', created_by: '', updated_at: '' }],
        error: null,
      });
    });
    await waitFor(() => expect(result.current.values['row-B']?.[3]).toBe(50));

    await act(async () => {
      slow.resolve({
        data: [{ id: 'b1', row_id: 'row-A', month: 3, value: 9999, facility_id: 'fac-1', created_at: '', created_by: '', updated_at: '' }],
        error: null,
      });
      await Promise.resolve();
    });

    expect(result.current.values['row-A']).toBeUndefined();
    expect(result.current.values['row-B']?.[3]).toBe(50);
  });

  it('does not flip loading=false from a stale late response', async () => {
    const slow = defer<{ data: any[]; error: null }>();
    const fast = defer<{ data: any[]; error: null }>();
    mocks.budgetsResponses = [slow, fast];

    const { result, rerender } = renderHook(
      ({ year }: { year: number }) => useBudgetData(year, 'fac-1', 'unit-1', 'INPATIENT'),
      { initialProps: { year: 2025 } }
    );
    await waitFor(() => expect(mocks.budgetsCallCount).toBeGreaterThanOrEqual(1));
    rerender({ year: 2026 });
    await waitFor(() => expect(mocks.budgetsCallCount).toBeGreaterThanOrEqual(2));

    await act(async () => {
      fast.resolve({ data: [], error: null });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Resolving the stale one must not throw or revert state
    await act(async () => {
      slow.resolve({ data: [], error: null });
      await Promise.resolve();
    });
    expect(result.current.loading).toBe(false);
  });
});
