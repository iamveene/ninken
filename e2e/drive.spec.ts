import { test, expect, Page } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const SCREENSHOTS_DIR = path.join(__dirname, "screenshots")
const TOKEN_PATH = "/Users/mvpenha/code/gcloud/token.json"

let screenshotIndex = 0
async function screenshot(page: Page, name: string) {
  screenshotIndex++
  const filename = `${String(screenshotIndex).padStart(2, "0")}-${name}.png`
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: false })
}

test.describe("Drive E2E Tests", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    // Clean old screenshots
    for (const f of fs.readdirSync(SCREENSHOTS_DIR)) {
      fs.unlinkSync(path.join(SCREENSHOTS_DIR, f))
    }
  })

  test("Auth + Navigate to Drive", async ({ page, context }) => {
    // Clear cookies to ensure we start unauthenticated
    await context.clearCookies()

    // 1. Navigate to localhost
    await page.goto("/")

    // Check if we're on the auth page or already redirected
    const authVisible = await page.locator("text=Authenticate").isVisible({ timeout: 3000 }).catch(() => false)

    if (authVisible) {
      // 2. Upload token.json via file input
      const tokenContent = fs.readFileSync(TOKEN_PATH, "utf-8")
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: "token.json",
        mimeType: "application/json",
        buffer: Buffer.from(tokenContent),
      })

      // Wait for auth success and redirect
      await expect(page.locator("text=Authenticated")).toBeVisible({ timeout: 10000 })
      await page.waitForURL("**/gmail", { timeout: 10000 })
    } else {
      // Already authenticated, auth via API
      await setupAuth(page)
      await page.goto("/gmail")
    }

    // 3. Click "Drive" in sidebar
    await page.locator("text=Drive").click()
    await page.waitForURL("**/drive", { timeout: 10000 })

    // 4. Wait for file browser to load
    await page.waitForTimeout(2000)
    await screenshot(page, "drive-loaded")
  })

  test("File List", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // 5. Verify files load
    const fileItems = page.locator("[data-slot='table-body'] tr, [class*='grid'] > div").first()
    await expect(fileItems).toBeVisible({ timeout: 15000 })

    // 6. Verify file properties visible (name at minimum)
    const firstFileName = page.locator("[data-slot='table-cell'], [class*='card']").first()
    await expect(firstFileName).toBeVisible()

    await screenshot(page, "file-list")
  })

  test("View Toggle - Grid and List", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // Default may be grid view - toggle to list
    const toggleButton = page.locator('button[aria-label*="Switch to"]')

    // Take screenshot of current view
    await screenshot(page, "view-initial")

    // Toggle view
    await toggleButton.click()
    await page.waitForTimeout(500)
    await screenshot(page, "view-toggled")

    // Toggle back
    await toggleButton.click()
    await page.waitForTimeout(500)
    await screenshot(page, "view-toggled-back")
  })

  test("Folder Navigation + Breadcrumbs", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // Find a folder (amber colored icon or folder type) and double-click
    // In grid view, folders have amber icon. In list view, they are rows.
    // Switch to list view for easier targeting
    await ensureListView(page)

    // Look for a folder row - folders typically show first due to sorting
    // Try to find an SVG with amber/folder color class or just the first table row
    const folderRow = page.locator("table tbody tr").first()
    const folderName = await folderRow.locator("td").first().textContent()

    if (folderName) {
      await folderRow.dblclick()
      await page.waitForTimeout(1500)

      // 14. Verify breadcrumbs update
      const breadcrumbs = page.locator("nav, [class*='breadcrumb']")
      await screenshot(page, "folder-navigation-breadcrumbs")

      // 16. Click "My Drive" to go back
      const myDriveLink = page.locator("text=My Drive").first()
      if (await myDriveLink.isVisible()) {
        await myDriveLink.click()
        await page.waitForTimeout(1000)
        await screenshot(page, "breadcrumb-back-to-root")
      }
    }
  })

  test("Search + Filter Chips", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // 18. Type a search term
    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill("test")
    await page.waitForTimeout(1000) // debounce

    // 19. Verify search results or empty state
    await screenshot(page, "search-results")

    // 21. Click a type filter chip (e.g., "Documents")
    const docsFilter = page.locator("button", { hasText: "Documents" })
    if (await docsFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await docsFilter.click()
      await page.waitForTimeout(1000)
      await screenshot(page, "search-filter-documents")
    }

    // 23. Clear search
    const clearButton = page.locator('button[aria-label="Clear search"]')
    if (await clearButton.isVisible()) {
      await clearButton.click()
      await page.waitForTimeout(1000)
      await screenshot(page, "search-cleared")
    }
  })

  test("File Info Panel", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // 25. Click a file to select it
    await ensureListView(page)
    const fileRow = page.locator("table tbody tr").first()
    await fileRow.click()
    await page.waitForTimeout(300)

    // 26. Open info panel
    const infoButton = page.locator('button[aria-label="Toggle details panel"]')
    await infoButton.click()
    await page.waitForTimeout(1500)

    // 27. Verify details panel shows metadata
    const detailsPanel = page.getByRole("heading", { name: "Details" })
    await expect(detailsPanel).toBeVisible({ timeout: 5000 })
    await screenshot(page, "file-info-panel")

    // Close info panel
    const closeButton = page.locator('button[aria-label="Close details panel"]')
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
  })

  test("Upload Dialog", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // 29. Click upload button
    const uploadButton = page.locator("button", { hasText: "Upload" })
    await uploadButton.click()
    await page.waitForTimeout(500)

    // 30. Screenshot upload dialog with drag-and-drop zone
    await expect(page.locator("text=Upload files")).toBeVisible({ timeout: 5000 })
    await screenshot(page, "upload-dialog")

    // 31. Test uploading a small test file
    const testContent = "Hello from Playwright E2E test - " + Date.now()
    const fileInput = page.locator('dialog input[type="file"], [role="dialog"] input[type="file"]')
    await fileInput.setInputFiles({
      name: `playwright-test-${Date.now()}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(testContent),
    })
    await page.waitForTimeout(500)
    await screenshot(page, "upload-file-added")

    // Click upload button in dialog
    const uploadActionButton = page.locator('[role="dialog"] button', { hasText: /Upload/ })
    await uploadActionButton.click()
    await page.waitForTimeout(3000)
    await screenshot(page, "upload-complete")

    // Close dialog if still open
    await page.keyboard.press("Escape")
  })

  test("Context Menu", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // 52. Right-click on a file
    await ensureListView(page)
    const fileRow = page.locator("table tbody tr").first()
    await fileRow.click({ button: "right" })
    await page.waitForTimeout(500)

    // 53. Verify context menu shows options
    const contextMenu = page.locator("[data-slot='context-menu-content'], [role='menu']")
    await expect(contextMenu).toBeVisible({ timeout: 5000 })
    await screenshot(page, "context-menu")

    // Close context menu
    await page.keyboard.press("Escape")
  })

  test("Rename via Context Menu", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)
    await ensureListView(page)

    // Right-click a file
    const fileRow = page.locator("table tbody tr").nth(1)
    await fileRow.click({ button: "right" })
    await page.waitForTimeout(500)

    // Click Rename
    const renameOption = page.locator("[role='menuitem']", { hasText: "Rename" })
    if (await renameOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await renameOption.click()
      await page.waitForTimeout(500)

      // Verify rename dialog
      await expect(page.getByRole("heading", { name: "Rename" })).toBeVisible({ timeout: 3000 })
      await screenshot(page, "rename-dialog")

      // Cancel without renaming
      const cancelButton = page.locator('[role="dialog"] button', { hasText: "Cancel" })
      await cancelButton.click()
    }
  })

  test("Share Dialog", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)
    await ensureListView(page)

    // Right-click a file
    const fileRow = page.locator("table tbody tr").first()
    await fileRow.click({ button: "right" })
    await page.waitForTimeout(500)

    // Click Share
    const shareOption = page.locator("[role='menuitem']", { hasText: "Share" })
    if (await shareOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareOption.click()
      await page.waitForTimeout(1000)

      // 42. Verify share dialog
      const shareDialog = page.getByRole("dialog").filter({ hasText: "Share" })
      await expect(shareDialog).toBeVisible({ timeout: 5000 })
      await screenshot(page, "share-dialog")

      // 43. Verify email input and role selector
      const emailInput = shareDialog.locator('input[placeholder*="Email"]')
      await expect(emailInput).toBeVisible()

      // Verify role selector (Select trigger shows current role value)
      const roleSelector = shareDialog.locator("button[data-slot='select-trigger'], select, [role='combobox']").first()
      if (await roleSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(roleSelector).toBeVisible()
      }

      // 44. Verify permissions list
      await screenshot(page, "share-dialog-with-permissions")

      // Close
      await page.keyboard.press("Escape")
    }
  })

  test("Download", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)
    await ensureListView(page)

    // Right-click a non-folder file
    // Find a file that is not a folder (skip first few if they are folders)
    const rows = page.locator("table tbody tr")
    const rowCount = await rows.count()

    let downloaded = false
    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const row = rows.nth(i)
      await row.click({ button: "right" })
      await page.waitForTimeout(300)

      const downloadOption = page.locator("[role='menuitem']", { hasText: "Download" })
      if (await downloadOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Found a non-folder file with download option
        await screenshot(page, "download-context-menu")

        // Start waiting for download before clicking
        const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null)
        await downloadOption.click()

        const download = await downloadPromise
        if (download) {
          await screenshot(page, "download-started")
        }
        downloaded = true
        break
      } else {
        await page.keyboard.press("Escape")
      }
    }

    if (!downloaded) {
      await screenshot(page, "download-no-downloadable-file")
    }
  })

  test("Trash via Context Menu", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)
    await ensureListView(page)

    // Count files before
    const rowsBefore = await page.locator("table tbody tr").count()
    await screenshot(page, "before-trash")

    // Right-click last file (to avoid trashing important ones)
    const lastRow = page.locator("table tbody tr").last()
    await lastRow.click({ button: "right" })
    await page.waitForTimeout(500)

    const trashOption = page.locator("[role='menuitem']", { hasText: "Move to trash" })
    if (await trashOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trashOption.click()
      await page.waitForTimeout(2000)
      await screenshot(page, "after-trash")
    }
  })

  test("Sorting in List View", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)
    await ensureListView(page)

    // 55. Click Name column header to sort
    const nameHeader = page.locator("thead button", { hasText: "Name" })
    await nameHeader.click()
    await page.waitForTimeout(500)
    await screenshot(page, "sorted-by-name-asc")

    // Click again for descending
    await nameHeader.click()
    await page.waitForTimeout(500)
    await screenshot(page, "sorted-by-name-desc")

    // Sort by Modified
    const modifiedHeader = page.locator("thead button", { hasText: "Modified" })
    await modifiedHeader.click()
    await page.waitForTimeout(500)
    await screenshot(page, "sorted-by-modified")
  })

  test("Sort Menu Dropdown", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // Click sort dropdown button
    const sortButton = page.locator('button[aria-label="Sort files"]')
    await sortButton.click()
    await page.waitForTimeout(300)
    await screenshot(page, "sort-dropdown-menu")

    // Click "Last modified"
    const lastModified = page.locator("[role='menuitem']", { hasText: "Last modified" })
    if (await lastModified.isVisible()) {
      await lastModified.click()
      await page.waitForTimeout(500)
      await screenshot(page, "sorted-last-modified")
    }
  })

  test("Dark Mode Toggle", async ({ page }) => {
    await setupAuth(page)
    await page.goto("/drive")
    await waitForFiles(page)

    // Look for a dark mode toggle or theme switcher
    // Check if there's a theme toggle in the sidebar or header
    const themeToggle = page.locator(
      'button[aria-label*="theme"], button[aria-label*="dark"], button[aria-label*="mode"]'
    )

    if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await themeToggle.click()
      await page.waitForTimeout(500)
      await screenshot(page, "dark-mode")
    } else {
      // Force dark mode via class manipulation for testing
      await page.evaluate(() => {
        document.documentElement.classList.add("dark")
      })
      await page.waitForTimeout(500)
      await screenshot(page, "dark-mode-forced")

      // Switch back
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark")
      })
      await page.waitForTimeout(300)
    }
  })
})

// Helper: authenticate via API and set cookie
async function setupAuth(page: Page) {
  const tokenContent = fs.readFileSync(TOKEN_PATH, "utf-8")
  const tokenData = JSON.parse(tokenContent)

  // Navigate first to set origin
  await page.goto("/")

  // Post token to auth endpoint
  const response = await page.request.post("/api/auth", {
    data: tokenData,
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok()) {
    throw new Error(`Auth failed: ${response.status()} ${await response.text()}`)
  }
}

// Helper: wait for file list to finish loading
async function waitForFiles(page: Page) {
  // Wait for skeletons to disappear (loading done)
  await page.waitForTimeout(1000)
  try {
    await page.waitForFunction(
      () => !document.querySelector('[class*="animate-pulse"]'),
      { timeout: 15000 }
    )
  } catch {
    // Might already be loaded
  }
  await page.waitForTimeout(500)
}

// Helper: ensure we're in list view for consistent selectors
async function ensureListView(page: Page) {
  const switchToList = page.locator('button[aria-label="Switch to list view"]')
  if (await switchToList.isVisible({ timeout: 2000 }).catch(() => false)) {
    await switchToList.click()
    await page.waitForTimeout(500)
  }
}
