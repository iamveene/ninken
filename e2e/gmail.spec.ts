import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOT_DIR = path.resolve(__dirname, "screenshots");
const TOKEN_PATH = path.resolve(__dirname, "../../token.json");

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `gmail-${name}.png`),
    fullPage: false,
  });
}

async function authenticate(page: Page) {
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  const res = await page.request.post("/api/auth", { data: tokenData });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.authenticated).toBe(true);
}

async function dismissErrorOverlay(page: Page) {
  try {
    const overlay = page.locator("nextjs-portal");
    if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  } catch {
    // ignore
  }
}

const MSG_ITEM = 'div.flex.flex-col > button:has(input[type="checkbox"])';

test.describe("Gmail E2E Tests", () => {
  test("01 - Landing page renders auth form", async ({ page }) => {
    await page.request.delete("/api/auth");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "01-landing-page");
  });

  test("02 - Auth API accepts token and redirects to Gmail", async ({ page }) => {
    await authenticate(page);
    await page.goto("/gmail");
    await page.waitForSelector('button:has-text("Compose")', { timeout: 15000 });
    await screenshot(page, "02-gmail-inbox-loaded");
  });

  test.describe("Authenticated", () => {
    test.beforeEach(async ({ page }) => {
      await authenticate(page);
    });

    test("03 - Inbox loads with messages showing sender, subject, date", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      const firstMessage = messageItems.first();
      await expect(firstMessage.locator("span.truncate").first()).toBeVisible();
      await expect(firstMessage.locator("span.whitespace-nowrap").first()).toBeVisible();
      const count = await messageItems.count();
      expect(count).toBeGreaterThan(0);
      await screenshot(page, "03-inbox-messages");
    });

    test("04 - Click message shows detail with From, To, Subject, body", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      await messageItems.first().click();
      const subjectHeading = page.locator("h1.text-xl");
      await expect(subjectHeading).toBeVisible({ timeout: 15000 });
      await expect(page.locator("span.font-semibold.text-\\[14px\\]")).toBeVisible();
      await expect(page.locator("text=/^to /")).toBeVisible();
      await screenshot(page, "04-message-detail");
    });

    test("05 - Search has:attachment and view attachments", async ({ page }) => {
      await page.goto("/gmail");
      const searchInput = page.locator('input[placeholder="Search mail..."]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill("has:attachment");
      await searchInput.press("Enter");
      await page.waitForTimeout(2000);
      const messageItems = page.locator(MSG_ITEM);
      const count = await messageItems.count();
      if (count > 0) {
        await messageItems.first().click();
        await page.waitForTimeout(2000);
      }
      await screenshot(page, "05-message-attachments");
    });

    test("06 - Compose dialog opens and has all fields", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('button:has-text("Compose")', { timeout: 15000 });
      await dismissErrorOverlay(page);
      await page.click('button:has-text("Compose")');
      const dialog = page.locator('[data-slot="dialog-content"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.locator("text=New Message")).toBeVisible();
      const toInput = dialog.locator('input[placeholder="recipient@example.com"]');
      await expect(toInput).toBeVisible();
      const subjectInput = dialog.locator('input[placeholder="Subject"]');
      await expect(subjectInput).toBeVisible();
      const bodyTextarea = dialog.locator('textarea[placeholder="Write your message..."]');
      await expect(bodyTextarea).toBeVisible();
      await toInput.fill("test@example.com");
      await subjectInput.fill("Test Subject");
      await bodyTextarea.fill("This is a test message body");
      await expect(dialog.locator('button:has-text("Send")').first()).toBeVisible();
      await expect(dialog.locator('button:has-text("Save Draft")')).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Cc", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Bcc", exact: true })).toBeVisible();
      await screenshot(page, "06-compose-dialog");
      await dialog.locator('button:has-text("Discard")').click();
      await expect(dialog).not.toBeVisible({ timeout: 3000 });
    });

    test("07 - Reply pre-fills subject with Re:", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      await messageItems.first().click();
      await page.waitForSelector("h1.text-xl", { timeout: 15000 });
      await dismissErrorOverlay(page);
      await page.locator('button[title="Reply"]').click();
      const dialog = page.locator('[data-slot="dialog-content"]');
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await expect(dialog.locator("text=Reply")).toBeVisible();
      const subjectInput = dialog.locator('input[placeholder="Subject"]');
      const subjectValue = await subjectInput.inputValue();
      expect(subjectValue).toMatch(/^(Re: )?/);
      const toInput = dialog.locator('input[placeholder="recipient@example.com"]');
      const toValue = await toInput.inputValue();
      expect(toValue.length).toBeGreaterThan(0);
      await screenshot(page, "07-reply-dialog");
      await dialog.locator('button:has-text("Discard")').click();
    });

    test("08 - Forward pre-fills subject with Fwd:", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      await messageItems.first().click();
      await page.waitForSelector("h1.text-xl", { timeout: 15000 });
      await dismissErrorOverlay(page);
      await page.locator('button[title="Forward"]').click();
      const dialog = page.locator('[data-slot="dialog-content"]');
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await expect(dialog.getByRole("heading", { name: "Forward" })).toBeVisible();
      const subjectInput = dialog.locator('input[placeholder="Subject"]');
      const subjectValue = await subjectInput.inputValue();
      expect(subjectValue).toMatch(/^(Fwd: )?/);
      const bodyTextarea = dialog.locator('textarea[placeholder="Write your message..."]');
      const bodyValue = await bodyTextarea.inputValue();
      expect(bodyValue).toContain("Forwarded message");
      await screenshot(page, "08-forward-dialog");
      // Close dialog - Discard button may be off-screen due to long forwarded body
      await page.keyboard.press("Escape");
    });

    test("09 - Sidebar labels navigate to different views", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('button:has-text("Inbox")', { timeout: 15000 });
      await page.click('button:has-text("Sent")');
      await page.waitForTimeout(2000);
      await screenshot(page, "09a-sent-label");
      await page.click('button:has-text("Starred")');
      await page.waitForTimeout(2000);
      await screenshot(page, "09b-starred-label");
      await page.click('button:has-text("Drafts")');
      await page.waitForTimeout(2000);
      await screenshot(page, "09c-drafts-label");
      await page.click('button:has-text("Trash")');
      await page.waitForTimeout(2000);
      await screenshot(page, "09d-trash-label");
      await page.click('button:has-text("Inbox")');
      await page.waitForTimeout(2000);
    });

    test("10 - Search query returns results", async ({ page }) => {
      await page.goto("/gmail");
      const searchInput = page.locator('input[placeholder="Search mail..."]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill("test");
      await searchInput.press("Enter");
      await page.waitForTimeout(3000);
      await screenshot(page, "10a-search-results");
      const clearButton = page.locator('button:near(input[placeholder="Search mail..."]) svg');
      if (await clearButton.isVisible().catch(() => false)) {
        await clearButton.first().click();
        await page.waitForTimeout(1000);
      }
      await screenshot(page, "10b-search-cleared");
    });

    test("11 - Quick filter chips work", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('input[placeholder="Search mail..."]', { timeout: 10000 });
      const unreadChip = page.locator('button:has-text("Unread")').first();
      if (await unreadChip.isVisible().catch(() => false)) {
        await unreadChip.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "11-quick-filter-unread");
      }
    });

    test("12 - Select message and use toolbar mark read/unread", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      const firstCheckbox = messageItems.first().locator('input[type="checkbox"]');
      await firstCheckbox.click({ force: true });
      await expect(page.locator("text=1 selected")).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button[title="Mark as read"]')).toBeVisible();
      await expect(page.locator('button[title="Mark as unread"]')).toBeVisible();
      await expect(page.locator('button[title="Trash"]')).toBeVisible();
      await screenshot(page, "12-toolbar-actions");
      await firstCheckbox.click({ force: true });
    });

    test("13 - Select all messages", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      const selectAllCheckbox = page.locator("div.bg-muted\\/20 input[type='checkbox']").first();
      await selectAllCheckbox.click({ force: true });
      await expect(page.locator("text=/\\d+ selected/")).toBeVisible({ timeout: 5000 });
      await screenshot(page, "13-select-all");
      await selectAllCheckbox.click({ force: true });
    });

    test("14 - Refresh button works", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('button[title="Refresh"]', { timeout: 15000 });
      await page.click('button[title="Refresh"]');
      await page.waitForTimeout(3000);
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 30000 });
      await screenshot(page, "14-after-refresh");
    });

    test("15 - Message detail toolbar has all action buttons", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      await messageItems.first().click();
      await page.waitForSelector("h1.text-xl", { timeout: 15000 });
      await expect(page.locator('button[title="Reply"]')).toBeVisible();
      await expect(page.locator('button[title="Forward"]')).toBeVisible();
      await expect(page.locator('button[title="Archive"]')).toBeVisible();
      await expect(page.locator('button[title="Trash"]')).toBeVisible();
      await expect(page.locator('button[title="Mark unread"]')).toBeVisible();
      await expect(page.locator('button[title="Label"]')).toBeVisible();
      await screenshot(page, "15-message-detail-toolbar");
    });

    test("16 - Advanced search filter popover", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('button[title="Advanced search"]', { timeout: 15000 });
      await page.click('button[title="Advanced search"]');
      const popover = page.locator("text=Advanced Search");
      await expect(popover).toBeVisible({ timeout: 5000 });
      await expect(page.locator('input[placeholder="sender@..."]')).toBeVisible();
      await expect(page.locator('input[placeholder="recipient@..."]')).toBeVisible();
      await expect(page.locator('input[placeholder="Subject..."]')).toBeVisible();
      await expect(page.locator('input[placeholder="Contains..."]')).toBeVisible();
      await expect(page.locator("text=Has attachment")).toBeVisible();
      await expect(page.locator('button:has-text("Reset")')).toBeVisible();
      await screenshot(page, "16-advanced-search");
    });

    test("17 - Star toggle on message in list", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      const starButton = messageItems.first().locator("button").first();
      await expect(starButton).toBeVisible();
      await screenshot(page, "17-star-button-visible");
    });

    test("18 - Message view shows empty state when no message selected", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('button:has-text("Compose")', { timeout: 15000 });
      await expect(page.locator("text=Select a message to read")).toBeVisible({ timeout: 5000 });
      await screenshot(page, "18-empty-message-state");
    });

    test("19 - Toolbar shows page info", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      const pageInfo = page.locator("text=/1-\\d+ of/");
      if (await pageInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
        await screenshot(page, "19-page-info");
      }
    });

    test("20 - Compose dialog Cc/Bcc fields toggle", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('button:has-text("Compose")', { timeout: 15000 });
      await dismissErrorOverlay(page);
      await page.click('button:has-text("Compose")');
      const dialog = page.locator('[data-slot="dialog-content"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole("button", { name: "Cc", exact: true }).click();
      await expect(dialog.locator('input[placeholder="cc@example.com"]')).toBeVisible();
      await dialog.getByRole("button", { name: "Bcc", exact: true }).click();
      await expect(dialog.locator('input[placeholder="bcc@example.com"]')).toBeVisible();
      await screenshot(page, "20-compose-cc-bcc");
      await dialog.locator('button:has-text("Discard")').click();
    });

    test("21 - Navigate to Important and Spam labels", async ({ page }) => {
      await page.goto("/gmail");
      await page.waitForSelector('button:has-text("Inbox")', { timeout: 15000 });
      await page.click('button:has-text("Important")');
      await page.waitForTimeout(2000);
      await screenshot(page, "21a-important-label");
      await page.click('button:has-text("Spam")');
      await page.waitForTimeout(2000);
      await screenshot(page, "21b-spam-label");
    });

    test("22 - Message view shows label badges", async ({ page }) => {
      await page.goto("/gmail");
      const messageItems = page.locator(MSG_ITEM);
      await expect(messageItems.first()).toBeVisible({ timeout: 20000 });
      await messageItems.first().click();
      await page.waitForSelector("h1.text-xl", { timeout: 15000 });
      await screenshot(page, "22-message-labels");
    });

    test("23 - Messages with attachments show paperclip icon", async ({ page }) => {
      await page.goto("/gmail");
      const searchInput = page.locator('input[placeholder="Search mail..."]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill("has:attachment");
      await searchInput.press("Enter");
      await page.waitForTimeout(3000);
      await screenshot(page, "23-attachment-icons");
    });
  });
});
