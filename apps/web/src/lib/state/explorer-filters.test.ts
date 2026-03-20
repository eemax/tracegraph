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
    const typed = setDraftFilter(initial, 'event', 'tool.workflow.progress');

    expect(typed.draftFilters.event).toBe('tool.workflow.progress');
    expect(typed.activeFilters.event).toBe('');
  });

  it('copies draft filters into active filters on apply', () => {
    const initial = createFilterModels();
    const typed = setDraftFilter(initial, 'traceId', 'trace-123');
    const applied = applyDraftFilters(typed);

    expect(applied.activeFilters.traceId).toBe('trace-123');
    expect(applied.activeFilters).toEqual(applied.draftFilters);
  });

  it('resets draft and active filters to defaults', () => {
    const initial = createFilterModels();
    const typed = setDraftFilter(setDraftFilter(initial, 'event', 'custom.event'), 'q', 'needle');
    const applied = applyDraftFilters(typed);

    const reset = resetFilterModels();

    expect(applied.activeFilters.event).toBe('custom.event');
    expect(reset.draftFilters).toEqual({
      from: '',
      to: '',
      event: '',
      stage: '',
      origin: '',
      traceId: '',
      chatId: '',
      q: ''
    });
    expect(reset.activeFilters).toEqual(reset.draftFilters);
  });
});
