import { expect, test } from '@playwright/test';

test('shows Ravion Barber without horizontal overflow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Ravion Barber' })).toBeVisible();
  await expect(page.getByText('Sistema de gestão para barbearia.')).toBeVisible();

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
});
