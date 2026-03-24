import type { ProviderId } from "./types"

/**
 * Canonical map of route prefixes to their owning provider.
 * Shared by provider-context (HI-16 auto-switch), app-sidebar (nav rendering),
 * and mode-toggle (storage scoping guard).
 */
export const ROUTE_PROVIDER_MAP: [string, ProviderId][] = [
  // Google
  ["/gmail", "google"], ["/drive", "google"], ["/buckets", "google"],
  ["/calendar", "google"], ["/directory", "google"], ["/chat", "google"],
  ["/dashboard", "google"], ["/audit", "google"],
  // Microsoft
  ["/outlook", "microsoft"], ["/onedrive", "microsoft"], ["/teams", "microsoft"],
  ["/entra", "microsoft"], ["/sharepoint", "microsoft"],
  ["/m365-dashboard", "microsoft"], ["/m365-audit", "microsoft"],
  // GitHub
  ["/github-dashboard", "github"], ["/repos", "github"], ["/orgs", "github"],
  ["/actions", "github"], ["/gists", "github"], ["/github-audit", "github"],
  // GitLab
  ["/gitlab-dashboard", "gitlab"], ["/gitlab-projects", "gitlab"],
  ["/gitlab-groups", "gitlab"], ["/gitlab-pipelines", "gitlab"],
  ["/gitlab-snippets", "gitlab"], ["/gitlab-audit", "gitlab"],
  // Slack
  ["/channels", "slack"], ["/slack-dashboard", "slack"],
  ["/slack-files", "slack"], ["/slack-users", "slack"],
  // AWS
  ["/aws-dashboard", "aws"], ["/aws-s3", "aws"], ["/aws-iam", "aws"],
  ["/aws-lambda", "aws"], ["/aws-ec2", "aws"], ["/aws-cloudtrail", "aws"],
  ["/aws-secrets", "aws"], ["/aws-audit", "aws"],
  // GCP
  ["/gcp-dashboard", "gcp"], ["/gcp-firestore", "gcp"], ["/gcp-rtdb", "gcp"],
  ["/gcp-storage", "gcp"], ["/gcp-compute", "gcp"], ["/gcp-vertexai", "gcp"],
  ["/gcp-audit", "gcp"],
]

/**
 * Detect which provider owns the given pathname.
 * Returns null for provider-agnostic routes (studio, collection, explore, opsec, alerts).
 */
export function getProviderFromPathname(pathname: string): ProviderId | null {
  for (const [prefix, providerId] of ROUTE_PROVIDER_MAP) {
    if (pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")) {
      return providerId
    }
  }
  return null
}
