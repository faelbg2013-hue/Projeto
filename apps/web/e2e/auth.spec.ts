import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test('login page shows an error and stays within the viewport', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.getByLabel('E-mail').fill('nao-existe@example.com');
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Credenciais inválidas');
  await expectNoHorizontalOverflow(page);
});

test('register page stays within the viewport', async ({ page }) => {
  await page.goto('/register');

  await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('registers, protects the account page, and logs out', async ({ page }, testInfo) => {
  const email = `e2e-${testInfo.project.name}-${Date.now()}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Nome').fill('Ana Costa');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { name: 'Ana Costa' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('Cliente')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/conta');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Ana Costa' })).toBeVisible();
});
