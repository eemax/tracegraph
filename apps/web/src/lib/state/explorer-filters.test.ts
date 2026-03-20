import { describe, expect, it } from 'vitest';
import {
  applyDraftFilters,
  createFilterModels,
  resetFilterModels,
  setDraftFilter
} from './explorer-filters';

describe('explorer filter models', () => {
  it('keeps active filters unchanged while draft inputs change', () => {
    const initial = createFilterModels();
    const typed = setDraftFilter(initial, 'eventTypes', ['tool.workflow.progress']);

    expect(typed.draftFilters.eventTypes).toEqual(['tool.workflow.progress']);
    expect(typed.activeFilters.eventTypes).toEqual([]);
  });

  it('copies draft filters into active filters on apply', () => {
    const initial = createFilterModels();
    const typed = setDraftFilter(initial, 'eventTypes', ['trace-123']);
    const applied = applyDraftFilters(typed);

    expect(applied.activeFilters.eventTypes).toEqual(['trace-123']);
    expect(applied.activeFilters).toEqual(applied.draftFilters);
  });

  it('resets draft and active filters to defaults', () => {
    const initial = createFilterModels();
    const typed = setDraftFilter(setDraftFilter(initial, 'eventTypes', ['custom.event']), 'q', 'needle');
    const applied = applyDraftFilters(typed);

    const reset = resetFilterModels();

    expect(applied.activeFilters.eventTypes).toEqual(['custom.event']);
    expect(reset.draftFilters).toEqual({
      eventTypes: [],
      q: ''
    });
    expect(reset.activeFilters).toEqual(reset.draftFilters);
  });
});
