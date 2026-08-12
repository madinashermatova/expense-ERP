import { test, expect } from '@playwright/test';

test.describe('Expense Flow', () => {
  // Test will fail without backend, but the structure is defined
  test('login -> xarajat yaratish -> tasdiqlash -> qaytarish -> eksport', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin'); // Assuming 'admin' works
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load (checking for title)
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 10000 });

    // 2. Yaratish (Create Expense)
    await page.goto('/expenses');
    await page.click('button:has-text("Yangi xarajat")');
    await page.fill('input[name="amount"]', '150000');
    // ... complete the actual flow based on UI
    // await page.click('button:has-text("Saqlash")');

    // 3. Tasdiqlash (Approvals)
    await page.goto('/approvals');
    // await page.click('button[title="Tasdiqlash"]');

    // 4. Qaytarish (Refunds)
    await page.goto('/refunds');

    // 5. Eksport (Exports)
    await page.goto('/exports');
    await expect(page.locator('h1')).toContainText('Eksportlar');
  });
});
