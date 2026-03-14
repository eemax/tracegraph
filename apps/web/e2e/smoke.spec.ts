import { expect, test } from '@playwright/test';

test('loads event feed and inspector', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Observe Graph' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Event Feed' })).toBeVisible();

  const firstEvent = page.locator('.event-row').first();
  await expect(firstEvent).toBeVisible({ timeout: 15_000 });
  await firstEvent.click();

  await expect(page.getByRole('heading', { name: 'Event Inspector' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Raw JSON' })).toBeVisible();
});
