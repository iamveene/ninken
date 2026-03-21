# WU-4: SharePoint UI Pages + Nav — Implementation Plan

## Hook: `src/hooks/use-sharepoint.ts`
- `useSharePointSites(search?)` — GET `/api/microsoft/sharepoint/sites?search=`
- `useSharePointDrives(siteId)` — GET `/api/microsoft/sharepoint/sites/{siteId}/drives`
- `useSharePointDriveItems(siteId, driveId, folderId?)` — GET `/api/microsoft/sharepoint/sites/{siteId}/drives/{driveId}/items?folderId=`
- `useSharePointLists(siteId)` — GET `/api/microsoft/sharepoint/sites/{siteId}/lists`
- `useSharePointListItems(siteId, listId)` — GET `/api/microsoft/sharepoint/sites/{siteId}/lists/{listId}/items`
- All use `useCachedQuery()` + `useProvider()` pattern from use-github.ts

## Pages (all under `src/app/(microsoft)/sharepoint/`)
1. **`page.tsx`** — Sites browser: search bar + table (displayName, webUrl, lastModified), click → `/sharepoint/{siteId}`
2. **`[siteId]/page.tsx`** — Site detail: Document Libraries section + Lists section
3. **`[siteId]/drive/[driveId]/page.tsx`** — Document library file browser with breadcrumbs, table view, CollectButton
4. **`[siteId]/list/[listId]/page.tsx`** — List items viewer with dynamic columns + pagination

## Nav modification
- Add `{ id: "sharepoint", title: "SharePoint", href: "/sharepoint", iconName: "Globe" }` to `operateNavItems` in `src/lib/providers/microsoft.ts`
- Add `sharepoint` sub-nav entries to `serviceSubNav`
- Add `sharepoint` scopes to `scopeAppMap`
