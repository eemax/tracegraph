import { expect, test } from '@playwright/test';

test('loads event feed and inspector', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Tracegraph' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Event Feed' })).toBeVisible();

  const firstEvent = page.locator('[data-testid="event-row"]:visible').first();
  await expect(firstEvent).toBeVisible({ timeout: 15_000 });
  await firstEvent.click();

  await expect(page.getByRole('heading', { name: 'Event Inspector' })).toBeVisible();
  await page.locator('[data-testid="tab-raw"]:visible').first().click();
  await expect(page.locator('[data-testid="tab-content-raw"]:visible').first()).toBeVisible();
});

test('feed renders without filter controls and source status strip', async ({ page }) => {
  await page.goto('/');

  const rows = page.locator('[data-testid="event-row"]:visible');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('[data-testid="filter-form"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="filter-search"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="filter-apply"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="filter-reset"]')).toHaveCount(0);
  await expect(page.getByLabel('Source status')).toHaveCount(0);
});

test('keyboard navigation keeps selected row in viewport', async ({ page }) => {
  await page.goto('/');

  const list = page.locator('[data-testid="event-list"]:visible').first();
  await expect(list).toBeVisible({ timeout: 15_000 });

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');

  const selected = page.locator('[data-testid="event-row"][aria-selected="true"]:visible').first();
  await expect(selected).toBeVisible();

  const listBox = await list.boundingBox();
  const selectedBox = await selected.boundingBox();

  expect(listBox).not.toBeNull();
  expect(selectedBox).not.toBeNull();

  if (listBox && selectedBox) {
    expect(selectedBox.y).toBeGreaterThanOrEqual(listBox.y);
    expect(selectedBox.y + selectedBox.height).toBeLessThanOrEqual(listBox.y + listBox.height);
  }
});

test('mobile inspector opens and closes while retaining selected event', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const firstEvent = page.locator('[data-testid="event-row"]:visible').first();
  await expect(firstEvent).toBeVisible({ timeout: 15_000 });
  await firstEvent.click();

  await expect(page.getByRole('dialog', { name: 'Inspector' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Event Inspector' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Inspector' })).not.toBeVisible();

  await expect(page.locator('[data-testid="event-row"][aria-selected="true"]:visible').first()).toBeVisible();
});
