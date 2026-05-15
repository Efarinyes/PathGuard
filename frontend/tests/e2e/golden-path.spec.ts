import { test, expect, type Page } from '@playwright/test';

/**
 * PathGuard Golden Path E2E Test
 * 
 * This test simulates the full lifecycle of a walk involving both
 * the patient and the caregiver in separate browser contexts.
 */

test.describe('PathGuard Golden Path', () => {
  let patientPage: Page;
  let caregiverPage: Page;

  const TEST_EMAIL = `caregiver_${Date.now()}@example.com`;
  const TEST_PASSWORD = 'Password123!';
  const PATIENT_NAME = 'Josep';


  test.beforeAll(async ({ browser }) => {
    // Create two separate browser contexts to simulate two different users
    const patientContext = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 41.3851, longitude: 2.1734 }
    });
    const caregiverContext = await browser.newContext({
      permissions: ['geolocation']
    });

    patientPage = await patientContext.newPage();
    caregiverPage = await caregiverContext.newPage();

    patientPage.on('console', msg => console.log('PATIENT:', msg.text()));
    caregiverPage.on('console', msg => console.log('CAREGIVER:', msg.text()));
  });

  test('should complete a full walk lifecycle with real-time updates', async () => {
    test.setTimeout(90000);
    // ── STEP 1: Patient Registration ──
    await patientPage.goto('http://localhost:3000/register');

    await patientPage.fill('input#groupName', 'Família Test');
    await patientPage.fill('input#patientName', PATIENT_NAME);
    await patientPage.fill('input#email', TEST_EMAIL);
    await patientPage.fill('input#password', TEST_PASSWORD);

    // patientPage.on('request', req => {
    //   if (req.url().includes('auth')) {
    //     console.log('REQUEST:', req.url());
    //   }
    // });

    await patientPage.click('button[type="submit"]');


    // After registration, patient is redirected to /patient
    await expect(patientPage).toHaveURL('http://localhost:3000/patient');
    // await patientPage.waitForURL('**/patient', { timeout: 15000 });

    await expect(patientPage.locator('h1')).toContainText('Quan vulguis sortir');

    // ── STEP 2: Caregiver Login ──
    await caregiverPage.goto('http://localhost:3000/caregiver');

    await caregiverPage.fill('input#email', TEST_EMAIL);
    await caregiverPage.fill('input#password', TEST_PASSWORD);
    await caregiverPage.click('button[type="submit"]');

    // Caregiver should see the dashboard
    await expect(caregiverPage.locator('h2')).toContainText('Estat del passeig');
    await expect(caregiverPage.getByText('Passeig finalitzat')).toBeVisible();

    // Ensure caregiver is connected to the server (dot is present)
    await expect(caregiverPage.locator('.relative.flex.h-3.w-3')).toBeVisible();

    // ── STEP 3: Start Walk ──
    await patientPage.click('button:has-text("Comença a passejar")');

    // Patient UI update
    await expect(patientPage.locator('h1')).toContainText('Bon passeig!');
    await expect(patientPage.getByText('Passeig en curs')).toBeVisible();

    // Caregiver UI update (Real-time via WebSocket)
    // The status should change to "Passeig actiu - En línia" or "Connectant..."
    await expect(caregiverPage.getByText(/Passeig actiu/)).toBeVisible();

    // ── STEP 4: Simulate GPS Updates ──
    const countLocator = caregiverPage.locator('p:text("Punts de ruta") + p');

    // Wait for the initial auto-sent point to arrive (Count should appear and not be 0)
    await expect(countLocator).toBeVisible({ timeout: 15000 });
    await expect(countLocator).not.toHaveText('0', { timeout: 10000 });
    const initialCountStr = await countLocator.textContent() || '0';
    const initialCount = parseInt(initialCountStr, 10);

    const points = [
      { lat: 41.3874, lng: 2.1686 },
      { lat: 41.3881, lng: 2.1692 },
      { lat: 41.3889, lng: 2.1701 },
    ];

    for (const [index, point] of points.entries()) {
      await patientPage.context().setGeolocation({
        latitude: point.lat,
        longitude: point.lng,
      });

      // Verify count is progressing (at least the number of points sent so far)
      await expect(async () => {
        const currentCount = parseInt(await countLocator.textContent() || '0', 10);
        expect(currentCount).toBeGreaterThanOrEqual(initialCount + index + 1);
      }).toPass({ timeout: 20000 });

      // Check for recent update status
      const timeLocator = caregiverPage.locator('p:text("Última actualització") + p');
      await expect(timeLocator).toHaveText(/Ara mateix|Fa \d+ segons/, { timeout: 20000 });
    }

    // Final count should match expectations (3 test points + 1 initial)
    const finalCount = await countLocator.textContent();
    expect(parseInt(finalCount || '0', 10)).toBeGreaterThanOrEqual(4);

    // ── STEP 5: Stop Walk ──
    await patientPage.click('button:has-text("Parem!")');

    // Patient UI update
    await expect(patientPage.locator('h1')).toContainText('Quan vulguis sortir');

    // Caregiver UI update
    await expect(caregiverPage.getByText('Passeig finalitzat')).toBeVisible();
  });
});
