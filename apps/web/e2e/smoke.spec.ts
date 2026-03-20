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

test('typing unapplied filters does not change visible list until apply', async ({ page }) => {
  await page.goto('/');

  const rows = page.locator('[data-testid="event-row"]:visible');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const beforeCount = await rows.count();

  const filterEvent = page.locator('[data-testid="filter-event"]:visible').first();
  await filterEvent.fill('definitely.no.match.event');

  await expect(page.locator('[data-testid="filter-unapplied"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="filter-apply"]:visible').first()).toBeEnabled();

  const midCount = await page.locator('[data-testid="event-row"]:visible').count();
  expect(midCount).toBe(beforeCount);

  await page.locator('[data-testid="filter-apply"]:visible').first().click();
  await expect(page.getByText('No events yet').first()).toBeVisible();

  await page.locator('[data-testid="filter-reset"]:visible').first().click();
  await expect(filterEvent).toHaveValue('');
  await expect(page.locator('[data-testid="event-row"]:visible').first()).toBeVisible();
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
