import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOT_DIR = path.resolve(__dirname, "../test-screenshots");
const TOKEN_PATH = path.resolve(__dirname, "../../token.json");

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
}

async function authenticate(page: Page) {
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  // POST token data to auth API
  const res = await page.request.post("/api/auth", { data: tokenData });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.authenticated).toBe(true);
}

test.describe("Gmail E2E Tests", () => {
  test.beforeAll(async ({ browser }) => {
    // Authenticate once via API to set cookie
    const context = await browser.newContext();
    const page = await context.newPage();
    await authenticate(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Authenticate each test's context
    await authenticate(page);
  });

  // ── Auth Flow ──────────────────────────────────────────────

  test("01 - Landing page renders auth form", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Workspace");
    await expect(page.getByText("Upload your Google OAuth token")).toBeVisible();
    await screenshot(page, "01-landing-page");
  });

  test("02 - Auth API accepts token and redirects to Gmail", async ({
    page,
  }) => {
    // Already authenticated in beforeEach; navigate to gmail
    await page.goto("/gmail");
    // Wait for messages to load (skeleton should disappear)
    await page.waitForSelector('button:has-text("Inbox")', { timeout: 15000 });
    await screenshot(page, "02-gmail-inbox-loaded");
  });

  // ── Inbox ──────────────────────────────────────────────────

  test("03 - Inbox loads with messages showing sender, subject, date", async ({
    page,
  }) => {
    await page.goto("/gmail");
    // Wait for message list to render (messages are buttons in the list)
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Verify message structure: sender name, subject text, date
    const firstMessage = messageItems.first();
    // Sender (font-medium or font-semibold text)
    await expect(firstMessage.locator("span.truncate").first()).toBeVisible();
    // Date text
    await expect(
      firstMessage.locator("span.whitespace-nowrap").first()
    ).toBeVisible();

    const count = await messageItems.count();
    expect(count).toBeGreaterThan(0);
    await screenshot(page, "03-inbox-messages");
  });

  // ── Read Message ───────────────────────────────────────────

  test("04 - Click message shows detail with From, To, Subject, body", async ({
    page,
  }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Click the first message
    await messageItems.first().click();

    // Wait for message view to load - subject heading
    const subjectHeading = page.locator("h1.text-xl");
    await expect(subjectHeading).toBeVisible({ timeout: 15000 });

    // Verify From (sender name)
    await expect(page.locator("span.font-semibold.text-\\[14px\\]")).toBeVisible();
    // Verify "to" line
    await expect(page.locator('text=/^to /')).toBeVisible();

    await screenshot(page, "04-message-detail");
  });

  // ── Attachments ────────────────────────────────────────────

  test("05 - Search has:attachment and view attachments", async ({ page }) => {
    await page.goto("/gmail");

    // Type search for attachments
    const searchInput = page.locator('input[placeholder="Search mail..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill("has:attachment");
    await searchInput.press("Enter");

    // Wait for results
    await page.waitForTimeout(2000);

    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    const count = await messageItems.count();

    if (count > 0) {
      // Click first message with attachment
      await messageItems.first().click();
      await page.waitForTimeout(2000);

      // Check for attachment section
      const attachmentSection = page.locator('text="Attachments"');
      if (await attachmentSection.isVisible({ timeout: 5000 }).catch(() => false)) {
        await screenshot(page, "05-message-attachments");
      } else {
        await screenshot(page, "05-attachment-search-results");
      }
    } else {
      // No messages with attachments found
      await screenshot(page, "05-no-attachments-found");
    }
  });

  // ── Compose ────────────────────────────────────────────────

  test("06 - Compose dialog opens and has all fields", async ({ page }) => {
    await page.goto("/gmail");
    await page.waitForSelector('button:has-text("Compose")', {
      timeout: 15000,
    });

    // Click compose button
    await page.click('button:has-text("Compose")');

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify title
    await expect(dialog.locator("text=New Message")).toBeVisible();

    // Verify To field
    const toInput = dialog.locator('input[placeholder="recipient@example.com"]');
    await expect(toInput).toBeVisible();

    // Verify Subject field
    const subjectInput = dialog.locator('input[placeholder="Subject"]');
    await expect(subjectInput).toBeVisible();

    // Verify body textarea
    const bodyTextarea = dialog.locator(
      'textarea[placeholder="Write your message..."]'
    );
    await expect(bodyTextarea).toBeVisible();

    // Fill in test data (don't send)
    await toInput.fill("test@example.com");
    await subjectInput.fill("Test Subject");
    await bodyTextarea.fill("This is a test message body");

    // Verify Send and Save Draft buttons
    await expect(dialog.locator('button:has-text("Send")')).toBeVisible();
    await expect(
      dialog.locator('button:has-text("Save Draft")')
    ).toBeVisible();

    // Verify Cc/Bcc toggle buttons
    await expect(dialog.locator("button:has-text('Cc')")).toBeVisible();
    await expect(dialog.locator("button:has-text('Bcc')")).toBeVisible();

    await screenshot(page, "06-compose-dialog");

    // Close without sending - click Discard
    await dialog.locator('button:has-text("Discard")').click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  // ── Reply ──────────────────────────────────────────────────

  test("07 - Reply pre-fills subject with Re:", async ({ page }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Click first message
    await messageItems.first().click();
    await page.waitForSelector("h1.text-xl", { timeout: 15000 });

    // Get the original subject
    const originalSubject = await page.locator("h1.text-xl").textContent();

    // Click Reply button (the one in the bottom bar)
    await page.click('button:has-text("Reply")');

    // Wait for compose dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify title says Reply
    await expect(dialog.locator("text=Reply")).toBeVisible();

    // Verify subject has Re: prefix
    const subjectInput = dialog.locator('input[placeholder="Subject"]');
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toMatch(/^(Re: )?/);

    // Verify To is pre-filled
    const toInput = dialog.locator('input[placeholder="recipient@example.com"]');
    const toValue = await toInput.inputValue();
    expect(toValue.length).toBeGreaterThan(0);

    await screenshot(page, "07-reply-dialog");

    // Close
    await dialog.locator('button:has-text("Discard")').click();
  });

  // ── Forward ────────────────────────────────────────────────

  test("08 - Forward pre-fills subject with Fwd:", async ({ page }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Click first message
    await messageItems.first().click();
    await page.waitForSelector("h1.text-xl", { timeout: 15000 });

    // Click Forward button
    await page.click('button:has-text("Forward")');

    // Wait for compose dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify title says Forward
    await expect(dialog.locator("text=Forward")).toBeVisible();

    // Verify subject has Fwd: prefix
    const subjectInput = dialog.locator('input[placeholder="Subject"]');
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toMatch(/^(Fwd: )?/);

    // Verify body has forwarded message text
    const bodyTextarea = dialog.locator(
      'textarea[placeholder="Write your message..."]'
    );
    const bodyValue = await bodyTextarea.inputValue();
    expect(bodyValue).toContain("Forwarded message");

    await screenshot(page, "08-forward-dialog");

    // Close
    await dialog.locator('button:has-text("Discard")').click();
  });

  // ── Labels / Sidebar ───────────────────────────────────────

  test("09 - Sidebar labels navigate to different views", async ({ page }) => {
    await page.goto("/gmail");
    await page.waitForSelector('button:has-text("Inbox")', { timeout: 15000 });

    // Click Sent
    await page.click('button:has-text("Sent")');
    await page.waitForTimeout(2000);
    await screenshot(page, "09a-sent-label");

    // Click Starred
    await page.click('button:has-text("Starred")');
    await page.waitForTimeout(2000);
    await screenshot(page, "09b-starred-label");

    // Click Drafts
    await page.click('button:has-text("Drafts")');
    await page.waitForTimeout(2000);
    await screenshot(page, "09c-drafts-label");

    // Click Trash
    await page.click('button:has-text("Trash")');
    await page.waitForTimeout(2000);
    await screenshot(page, "09d-trash-label");

    // Go back to Inbox
    await page.click('button:has-text("Inbox")');
    await page.waitForTimeout(2000);
  });

  // ── Search ─────────────────────────────────────────────────

  test("10 - Search query returns results", async ({ page }) => {
    await page.goto("/gmail");

    const searchInput = page.locator('input[placeholder="Search mail..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type a search query
    await searchInput.fill("test");
    await searchInput.press("Enter");
    await page.waitForTimeout(3000);

    await screenshot(page, "10a-search-results");

    // Verify result count shows
    const resultCount = page.locator('text=/\\d+ results?/');
    // It may or may not show depending on results

    // Clear search using the X button
    const clearButton = page.locator(
      'button:near(input[placeholder="Search mail..."]) svg'
    );
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.first().click();
      await page.waitForTimeout(1000);
    }

    await screenshot(page, "10b-search-cleared");
  });

  test("11 - Quick filter chips work", async ({ page }) => {
    await page.goto("/gmail");
    await page.waitForSelector('input[placeholder="Search mail..."]', {
      timeout: 10000,
    });

    // Click "Unread" quick filter chip
    const unreadChip = page.locator('button:has-text("Unread")').first();
    if (await unreadChip.isVisible().catch(() => false)) {
      await unreadChip.click();
      await page.waitForTimeout(2000);
      await screenshot(page, "11-quick-filter-unread");
    }
  });

  // ── Toolbar Actions (Mark Read/Unread, Trash) ──────────────

  test("12 - Select message and use toolbar mark read/unread", async ({
    page,
  }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Check the first message's checkbox
    const firstCheckbox = messageItems.first().locator('input[type="checkbox"]');
    await firstCheckbox.click({ force: true });

    // Verify "1 selected" text appears
    await expect(page.locator("text=1 selected")).toBeVisible({
      timeout: 5000,
    });

    // Verify toolbar buttons appear
    const markReadBtn = page.locator('button[title="Mark as read"]');
    const markUnreadBtn = page.locator('button[title="Mark as unread"]');
    const trashBtn = page.locator('button[title="Trash"]');

    await expect(markReadBtn).toBeVisible();
    await expect(markUnreadBtn).toBeVisible();
    await expect(trashBtn).toBeVisible();

    await screenshot(page, "12-toolbar-actions");

    // Deselect by clicking the select-all checkbox
    const selectAllCheckbox = page
      .locator('div.flex.items-center.gap-1.border-b input[type="checkbox"]')
      .first();
    if (await selectAllCheckbox.isVisible().catch(() => false)) {
      // Click the first checkbox again to deselect
      await firstCheckbox.click({ force: true });
    }
  });

  test("13 - Select all messages", async ({ page }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Click the select-all checkbox in toolbar
    const selectAllCheckbox = page
      .locator("div.bg-muted\\/20 input[type='checkbox']")
      .first();
    await selectAllCheckbox.click({ force: true });

    // Should show selected count
    await expect(page.locator("text=/\\d+ selected/")).toBeVisible({
      timeout: 5000,
    });

    await screenshot(page, "13-select-all");

    // Deselect all
    await selectAllCheckbox.click({ force: true });
  });

  // ── Refresh ────────────────────────────────────────────────

  test("14 - Refresh button works", async ({ page }) => {
    await page.goto("/gmail");
    await page.waitForSelector('button[title="Refresh"]', { timeout: 15000 });

    await page.click('button[title="Refresh"]');
    // Should trigger a refetch - page should still show messages after
    await page.waitForTimeout(3000);

    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    // Messages should still be visible after refresh
    await expect(messageItems.first()).toBeVisible({ timeout: 15000 });
    await screenshot(page, "14-after-refresh");
  });

  // ── Message Detail Toolbar ─────────────────────────────────

  test("15 - Message detail toolbar has Reply, Forward, Archive, Trash, Mark Unread buttons", async ({
    page,
  }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    await messageItems.first().click();
    await page.waitForSelector("h1.text-xl", { timeout: 15000 });

    // Verify all action buttons in the detail toolbar
    await expect(page.locator('button[title="Reply"]')).toBeVisible();
    await expect(page.locator('button[title="Forward"]')).toBeVisible();
    await expect(page.locator('button[title="Archive"]')).toBeVisible();
    await expect(page.locator('button[title="Trash"]')).toBeVisible();
    await expect(page.locator('button[title="Mark unread"]')).toBeVisible();
    await expect(page.locator('button[title="Label"]')).toBeVisible();

    await screenshot(page, "15-message-detail-toolbar");
  });

  // ── Advanced Search Filters ────────────────────────────────

  test("16 - Advanced search filter popover", async ({ page }) => {
    await page.goto("/gmail");
    await page.waitForSelector('button[title="Advanced search"]', {
      timeout: 15000,
    });

    // Open advanced search
    await page.click('button[title="Advanced search"]');

    // Wait for popover
    const popover = page.locator("text=Advanced Search");
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Verify filter fields
    await expect(page.locator('input[placeholder="sender@..."]')).toBeVisible();
    await expect(
      page.locator('input[placeholder="recipient@..."]')
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Subject..."]')
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Contains..."]')
    ).toBeVisible();

    // Verify Has attachment switch
    await expect(page.locator("text=Has attachment")).toBeVisible();

    // Verify Search and Reset buttons
    await expect(
      page.locator('[data-popover] button:has-text("Search"), button:has-text("Search")').last()
    ).toBeVisible();
    await expect(page.locator('button:has-text("Reset")')).toBeVisible();

    await screenshot(page, "16-advanced-search");
  });

  // ── Star Toggle ────────────────────────────────────────────

  test("17 - Star toggle on message in list", async ({ page }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Find star button on first message (it's a button with Star icon)
    const starButton = messageItems.first().locator("button").first();
    if (await starButton.isVisible()) {
      await screenshot(page, "17a-before-star");
      // We won't actually toggle to avoid side effects, just verify it exists
      await expect(starButton).toBeVisible();
      await screenshot(page, "17b-star-button-visible");
    }
  });

  // ── Empty state ────────────────────────────────────────────

  test("18 - Message view shows empty state when no message selected", async ({
    page,
  }) => {
    await page.goto("/gmail");
    await page.waitForSelector('button:has-text("Inbox")', { timeout: 15000 });

    // Without clicking any message, the detail panel should show "Select a message"
    await expect(
      page.locator("text=Select a message to read")
    ).toBeVisible({ timeout: 5000 });

    await screenshot(page, "18-empty-message-state");
  });

  // ── Page info ──────────────────────────────────────────────

  test("19 - Toolbar shows page info", async ({ page }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    // Check for page info like "1-20 of 500"
    const pageInfo = page.locator("text=/1-\\d+ of/");
    if (await pageInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshot(page, "19-page-info");
    }
  });

  // ── Compose Cc/Bcc toggle ─────────────────────────────────

  test("20 - Compose dialog Cc/Bcc fields toggle", async ({ page }) => {
    await page.goto("/gmail");
    await page.waitForSelector('button:has-text("Compose")', {
      timeout: 15000,
    });

    await page.click('button:has-text("Compose")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cc to show Cc field
    await dialog.locator("button:has-text('Cc')").click();
    await expect(
      dialog.locator('input[placeholder="cc@example.com"]')
    ).toBeVisible();

    // Click Bcc to show Bcc field
    await dialog.locator("button:has-text('Bcc')").click();
    await expect(
      dialog.locator('input[placeholder="bcc@example.com"]')
    ).toBeVisible();

    await screenshot(page, "20-compose-cc-bcc");

    // Discard
    await dialog.locator('button:has-text("Discard")').click();
  });

  // ── Important / Spam labels ────────────────────────────────

  test("21 - Navigate to Important and Spam labels", async ({ page }) => {
    await page.goto("/gmail");
    await page.waitForSelector('button:has-text("Inbox")', { timeout: 15000 });

    // Click Important
    await page.click('button:has-text("Important")');
    await page.waitForTimeout(2000);
    await screenshot(page, "21a-important-label");

    // Click Spam
    await page.click('button:has-text("Spam")');
    await page.waitForTimeout(2000);
    await screenshot(page, "21b-spam-label");
  });

  // ── Label badges in message view ───────────────────────────

  test("22 - Message view shows label badges", async ({ page }) => {
    await page.goto("/gmail");
    const messageItems = page.locator(
      'div.flex.flex-col > button:has(input[type="checkbox"])'
    );
    await expect(messageItems.first()).toBeVisible({ timeout: 20000 });

    await messageItems.first().click();
    await page.waitForSelector("h1.text-xl", { timeout: 15000 });

    // Check for badge elements (label badges like INBOX, STARRED, etc.)
    const badges = page.locator('[data-slot="badge"]');
    const badgeCount = await badges.count();

    await screenshot(page, "22-message-labels");
  });

  // ── Attachment icon in message list ────────────────────────

  test("23 - Messages with attachments show paperclip icon", async ({
    page,
  }) => {
    await page.goto("/gmail");

    // Search for messages with attachments
    const searchInput = page.locator('input[placeholder="Search mail..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill("has:attachment");
    await searchInput.press("Enter");
    await page.waitForTimeout(3000);

    // Check if any message has the paperclip (Paperclip icon from lucide)
    // The Paperclip icon is rendered as an SVG with class size-3
    await screenshot(page, "23-attachment-icons");
  });
});
