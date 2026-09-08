/**
 * Backyard app Playwright driver.
 * Usage: node driver.mjs [--screenshot-dir /tmp/screenshots] [--headed]
 *
 * Launches a headless Chromium against the running dev server at
 * http://localhost:5173. Servers must already be up (npm run dev:all).
 */

import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ARGS = process.argv.slice(2);
const HEADED = ARGS.includes('--headed');
const SS_DIR = (() => {
  const i = ARGS.indexOf('--screenshot-dir');
  return i !== -1 ? ARGS[i + 1] : '/tmp/backyard-screenshots';
})();

if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

let ssCount = 0;

async function run() {
  const browser = await chromium.launch({ headless: !HEADED, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  async function ss(label) {
    const path = join(SS_DIR, `${String(ssCount++).padStart(3, '0')}-${label}.png`);
    await page.screenshot({ path, fullPage: false });
    console.log(`📸 ${path}`);
    return path;
  }

  async function waitAndSS(selector, label, timeout = 10000) {
    try {
      await page.waitForSelector(selector, { timeout });
    } catch {
      console.warn(`⚠️  Selector not found: ${selector}`);
    }
    return ss(label);
  }

  try {
    console.log('\n=== PHASE 1: Unauthenticated Browse ===');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    await ss('01-homepage');

    // Wait for clubs to load
    await page.waitForTimeout(2000);
    await ss('02-clubs-loaded');

    // Search for a club
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"], input[placeholder*="search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('music');
      await page.waitForTimeout(800);
      await ss('03-search-music');
      await searchInput.fill('');
      await page.waitForTimeout(500);
    } else {
      console.warn('⚠️  Search input not found');
    }

    // Click first club card to expand
    const clubCards = page.locator('[class*="club"], [class*="grid"] > div, [class*="card"]').first();
    if (await clubCards.count() > 0) {
      await clubCards.click();
      await page.waitForTimeout(1500);
      await ss('04-club-expanded');
    }

    // Try to close the modal / go back
    const closeBtn = page.locator('button[aria-label*="close"], button[aria-label*="Close"], button:has-text("×"), button:has-text("✕")').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Try to favorite a club (should prompt login)
    const heartBtn = page.locator('[class*="heart"], button[aria-label*="favorite"], button[aria-label*="Favorite"]').first();
    if (await heartBtn.count() > 0) {
      await heartBtn.click();
      await page.waitForTimeout(1000);
      await ss('05-favorite-prompt-login');
    }

    // Navigate to calendar view
    const calBtn = page.locator('button[aria-label*="calendar"], button[aria-label*="Calendar"], [class*="calendar-btn"]').first();
    if (await calBtn.count() > 0) {
      await calBtn.click();
      await page.waitForTimeout(1500);
      await ss('06-calendar-view');
    }

    console.log('\n=== PHASE 2: Login Modal ===');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click profile/login button in navbar
    const profileBtn = page.locator('[class*="profile"], [class*="avatar"], nav button, [class*="nav"] button').last();
    if (await profileBtn.count() > 0) {
      await profileBtn.click();
      await page.waitForTimeout(1000);
      await ss('07-login-modal');
    }

    // Try signing up with a bad username (spaces)
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.count() > 0) {
      // Switch to signup if needed
      const signupLink = page.locator('text=Sign up, text=Create account, button:has-text("Sign up")').first();
      if (await signupLink.count() > 0) {
        await signupLink.click();
        await page.waitForTimeout(500);
      }

      await emailInput.fill('testuser@test.com');
      await passwordInput.fill('short');
      await ss('08-signup-short-password');

      // Try submitting
      const submitBtn = page.locator('button[type="submit"], button:has-text("Sign up"), button:has-text("Create")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(1000);
        await ss('09-signup-validation-error');
      }
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('\n=== PHASE 3: Calendar Module (Bug Hunt) ===');
    // Try to navigate into a club's calendar to trigger the CalendarModule bug
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    const firstCard = page.locator('[class*="club-card"], [class*="ClubGrid"], [class*="club_grid"]').first();
    if (await firstCard.count() > 0) {
      await firstCard.click();
      await page.waitForTimeout(1500);
      await ss('10-club-detail-modal');

      // Scroll down to find the calendar/events section
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(800);
      await ss('11-club-detail-scrolled');

      // Look for calendar/events tab or section
      const eventsSection = page.locator('text=Events, text=Calendar, [class*="calendar"], [class*="CalendarModule"]').first();
      if (await eventsSection.count() > 0) {
        await eventsSection.click();
        await page.waitForTimeout(1500);
        await ss('12-calendar-module');
      }
    }

    console.log('\n=== PHASE 4: Settings Page ===');
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await ss('13-settings-page');

    console.log('\n=== PHASE 5: Profile Page (Logged Out) ===');
    await page.goto('http://localhost:5173/profile', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await ss('14-profile-logged-out');

    console.log('\n=== PHASE 6: Admin Page (Logged Out) ===');
    await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await ss('15-admin-logged-out');

    console.log('\n=== PHASE 7: Join Page with Bad Token ===');
    await page.goto('http://localhost:5173/join/fake-token-xyz', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await ss('16-join-bad-token');

    console.log('\n=== PHASE 8: Support Modal ===');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    const supportBtn = page.locator('button:has-text("?"), [class*="support"], [aria-label*="support"]').first();
    if (await supportBtn.count() > 0) {
      await supportBtn.click();
      await page.waitForTimeout(800);
      await ss('17-support-modal');
    }

    console.log('\n=== PHASE 9: Auth Callback (Malformed) ===');
    await page.goto('http://localhost:5173/auth/callback?error=access_denied', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);
    await ss('18-auth-callback-error');

    console.log('\n=== Console Errors ===');
    if (errors.length === 0) {
      console.log('✅ No console errors detected');
    } else {
      console.log(`❌ ${errors.length} console error(s):`);
      errors.forEach((e, i) => console.log(`  [${i + 1}] ${e}`));
    }

    console.log(`\n✅ Done. Screenshots in: ${SS_DIR}`);
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Driver error:', err);
  process.exit(1);
});
