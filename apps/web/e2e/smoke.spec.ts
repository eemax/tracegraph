import { expect, test } from '@playwright/test';

test('loads event feed and inspector', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Observe Graph' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Event Feed' })).toBeVisible();

  const firstEvent = page.locator('[data-testid="event-row"]:visible').first();
  await expect(firstEvent).toBeVisible({ timeout: 15_000 });
  await firstEvent.click();

  await expect(page.getByRole('heading', { name: 'Event Inspector' })).toBeVisible();
  await page.locator('[data-testid="tab-raw"]:visible').first().click();
  await expect(page.locator('[data-testid="tab-content-raw"]:visible').first()).toBeVisible();
});

test('applies and resets filters, then switches inspector tabs', async ({ page }) => {
  await page.goto('/');

  const firstEvent = page.locator('[data-testid="event-row"]:visible').first();
  await expect(firstEvent).toBeVisible({ timeout: 15_000 });

  const filterEvent = page.locator('[data-testid="filter-event"]:visible').first();
  await filterEvent.fill('tool.workflow.progress');
  await page.locator('[data-testid="filter-apply"]:visible').first().click();

  await expect(page.locator('[data-testid="event-list"]:visible').first()).toBeVisible();
  await page.locator('[data-testid="filter-reset"]:visible').first().click();
  await expect(filterEvent).toHaveValue('');

  await firstEvent.click();
  await page.locator('[data-testid="tab-trace"]:visible').first().click();
  await expect(page.locator('[data-testid="tab-content-trace"]:visible').first()).toBeVisible();
});
