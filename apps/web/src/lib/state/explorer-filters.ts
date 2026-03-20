import type { UiFilters } from '../ui';
import { createDefaultFilters } from './explorer-helpers';
import { filtersEqual } from './explorer-selectors';

export interface FilterModels {
  draftFilters: UiFilters;
  activeFilters: UiFilters;
}

function cloneFilters(filters: UiFilters): UiFilters {
  return {
    eventTypes: [...filters.eventTypes],
    q: filters.q
  };
}

export function createFilterModels(): FilterModels {
  return {
    draftFilters: createDefaultFilters(),
    activeFilters: createDefaultFilters()
  };
}

export function setDraftFilter(
  models: FilterModels,
  key: keyof UiFilters,
  value: string | string[]
): FilterModels {
  return {
    ...models,
    draftFilters: {
      ...models.draftFilters,
      [key]: value
    }
  };
}

export function applyDraftFilters(models: FilterModels): FilterModels {
  if (filtersEqual(models.draftFilters, models.activeFilters)) {
    return models;
  }

  return {
    ...models,
    activeFilters: cloneFilters(models.draftFilters)
  };
}

export function resetFilterModels(): FilterModels {
  return createFilterModels();
}
