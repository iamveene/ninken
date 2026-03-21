# WU-12: App Switcher (Waffle Menu) — Implementation Plan

## Goal
Google-style 9-dot waffle menu in every layout header for quick provider switching.

## Component: `src/components/layout/app-switcher.tsx`
- "use client" Popover (shadcn/ui) triggered by LayoutGrid icon button (ghost variant, icon size)
- 3-column grid inside popover showing all 6 providers + Studio (7 tiles)
- Each tile: provider icon (via `resolveIcon`) + provider name
- Connected providers (have stored profile): full opacity + small green "Connected" badge
- Unconnected: 40% opacity
- Click navigates to provider's `defaultRoute` (or `/studio` for Studio)
- Uses `useProvider()` for `profiles` array, `getAllProviders()` for provider list
- Studio is hardcoded as a special entry (not a registered provider)

## Layout Changes (7 files)
Add `<AppSwitcher />` as FIRST child of the `ml-auto flex` div (before ServiceIndicator).

Files:
1. `src/app/(google)/layout.tsx`
2. `src/app/(microsoft)/layout.tsx`
3. `src/app/(github)/layout.tsx`
4. `src/app/(gitlab)/layout.tsx`
5. `src/app/(slack)/layout.tsx`
6. `src/app/(aws)/layout.tsx`
7. `src/app/(studio)/studio/layout.tsx`

## Patterns to Follow
- Popover from `@/components/ui/popover` (base-ui backed)
- Badge from `@/components/ui/badge` (variant="secondary" for "Connected")
- Button ghost variant, icon size for trigger
- `cn()` from `@/lib/utils` for conditional classes
- `import "@/lib/providers"` to ensure registration
- Link from `next/link` for navigation
