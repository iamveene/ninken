/**
 * Token extraction techniques database.
 * Documents methods for extracting tokens from various OS and application sources.
 */

export type OperatingSystem = "windows" | "macos" | "linux" | "browser" | "mobile"
export type DifficultyLevel = "easy" | "medium" | "hard" | "expert"

export interface ExtractionTechnique {
  id: string
  name: string
  os: OperatingSystem
  platform: "google" | "microsoft" | "both"
  /** What type of token can be extracted */
  tokenType: string
  /** Source application or location */
  source: string
  difficulty: DifficultyLevel
  /** Whether admin/root privileges are required */
  requiresPrivilege: boolean
  /** Step-by-step extraction method */
  steps: string[]
  /** Tools commonly used */
  tools: string[]
  /** File paths or registry keys involved */
  paths: string[]
  /** Detection considerations */
  detection: string[]
  /** Additional notes */
  notes?: string
}

export const EXTRACTION_TECHNIQUES: ExtractionTechnique[] = [
  // --- Windows / Microsoft ---
  {
    id: "win-chrome-cookies",
    name: "Chrome Cookie Extraction",
    os: "windows",
    platform: "both",
    tokenType: "Session Cookie / OAuth Token",
    source: "Google Chrome",
    difficulty: "medium",
    requiresPrivilege: false,
    steps: [
      "Locate Chrome profile: %LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default",
      "Copy 'Cookies' SQLite database and 'Local State' JSON",
      "Extract DPAPI-encrypted cookie values from the database",
      "Decrypt master key from Local State using DPAPI (CryptUnprotectData)",
      "Decrypt individual cookie values using AES-256-GCM with the master key",
    ],
    tools: ["SharpChromium", "Mimikatz (dpapi::chrome)", "CookieMonster", "HackBrowserData"],
    paths: [
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cookies",
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Local State",
    ],
    detection: [
      "File access events on Chrome profile directory",
      "DPAPI CryptUnprotectData calls (ETW: Microsoft-Windows-Crypto-DPAPI)",
      "Process access to Chrome cookie database files",
    ],
  },
  {
    id: "win-prt-extraction",
    name: "Primary Refresh Token Extraction",
    os: "windows",
    platform: "microsoft",
    tokenType: "Primary Refresh Token (PRT)",
    source: "Azure AD / Windows Hello",
    difficulty: "expert",
    requiresPrivilege: true,
    steps: [
      "Obtain SYSTEM or kernel-level access",
      "Use ROADtoken or AADInternals to request PRT from CloudAP plugin",
      "Extract the PRT cookie (x-ms-RefreshTokenCredential) and session key",
      "Alternatively, use Mimikatz sekurlsa::cloudap to dump PRT from LSASS",
      "Use extracted PRT to request access tokens for any Azure AD app",
    ],
    tools: ["ROADtoken", "AADInternals", "Mimikatz", "RequestAADRefreshToken"],
    paths: [
      "HKLM\\SOFTWARE\\Microsoft\\IdentityStore",
      "LSASS process memory (CloudAP plugin)",
    ],
    detection: [
      "LSASS memory access (Sysmon Event ID 10)",
      "Anomalous PRT usage from unexpected device/IP",
      "Azure AD Sign-in logs: PRT auth method from new location",
    ],
    notes: "TPM-bound PRTs require additional steps to extract the session key. Non-TPM devices are easier targets.",
  },
  {
    id: "win-teams-tokens",
    name: "Teams Token Extraction",
    os: "windows",
    platform: "microsoft",
    tokenType: "Access Token / Refresh Token",
    source: "Microsoft Teams (old Electron app)",
    difficulty: "easy",
    requiresPrivilege: false,
    steps: [
      "Locate Teams LevelDB or Cookies file in AppData",
      "Search for access_token and refresh_token strings in the database",
      "Tokens are stored in cleartext in the LevelDB databases",
    ],
    tools: ["TokenTactics", "TeamsTokenExtractor", "Manual SQLite/LevelDB inspection"],
    paths: [
      "%APPDATA%\\Microsoft\\Teams\\Cookies",
      "%APPDATA%\\Microsoft\\Teams\\Local Storage\\leveldb",
    ],
    detection: [
      "File access to Teams data directory",
      "Old Teams desktop app is being deprecated -- new Teams uses different storage",
    ],
    notes: "The new Teams app stores tokens differently. This applies to the legacy Electron-based Teams client.",
  },
  {
    id: "win-msal-cache",
    name: "MSAL Token Cache Extraction",
    os: "windows",
    platform: "microsoft",
    tokenType: "Access Token / Refresh Token",
    source: "MSAL Token Cache (various apps)",
    difficulty: "medium",
    requiresPrivilege: false,
    steps: [
      "Locate MSAL token cache files in user's AppData",
      "Common locations: Office apps, Azure CLI, PowerShell modules",
      "Cache is typically a JSON file with tokens encrypted via DPAPI",
      "Decrypt using DPAPI or extract from process memory",
    ],
    tools: ["TokenTactics", "AADInternals", "Manual JSON parsing"],
    paths: [
      "%LOCALAPPDATA%\\.IdentityService\\msal.cache",
      "%USERPROFILE%\\.azure\\msal_token_cache.json",
      "%LOCALAPPDATA%\\Microsoft\\TokenBroker\\Cache",
    ],
    detection: [
      "File access to MSAL cache locations",
      "DPAPI decryption events",
    ],
  },
  {
    id: "win-azure-cli",
    name: "Azure CLI Token Extraction",
    os: "windows",
    platform: "microsoft",
    tokenType: "Access Token / Refresh Token",
    source: "Azure CLI",
    difficulty: "easy",
    requiresPrivilege: false,
    steps: [
      "Read %USERPROFILE%\\.azure\\azureProfile.json for subscription info",
      "Read %USERPROFILE%\\.azure\\msal_token_cache.json for cached tokens",
      "Alternatively, run: az account get-access-token",
      "Tokens are stored in plaintext JSON (MSAL cache since Azure CLI 2.30+)",
    ],
    tools: ["az CLI", "Manual file read", "AADInternals"],
    paths: [
      "%USERPROFILE%\\.azure\\azureProfile.json",
      "%USERPROFILE%\\.azure\\msal_token_cache.json",
      "%USERPROFILE%\\.azure\\accessTokens.json (legacy)",
    ],
    detection: [
      "Azure CLI process execution",
      "File read on .azure directory",
    ],
  },

  // --- macOS ---
  {
    id: "mac-keychain-google",
    name: "macOS Keychain - Google Tokens",
    os: "macos",
    platform: "google",
    tokenType: "OAuth2 Refresh Token",
    source: "macOS Keychain",
    difficulty: "medium",
    requiresPrivilege: false,
    steps: [
      "Use security find-generic-password to query Chrome-related entries",
      "Look for entries with service names containing 'google' or 'chrome'",
      "Chrome Safe Storage key is needed to decrypt Chrome cookies",
      "Extract with: security find-generic-password -w -s 'Chrome Safe Storage'",
    ],
    tools: ["security (macOS CLI)", "keychainaccess", "chainbreaker"],
    paths: [
      "~/Library/Keychains/login.keychain-db",
      "~/Library/Application Support/Google/Chrome/Default/Cookies",
    ],
    detection: [
      "Keychain access prompts (unless programmatic access is granted)",
      "TCC database access events",
      "Process accessing Chrome Keychain entries",
    ],
  },
  {
    id: "mac-azure-cli",
    name: "macOS Azure CLI Tokens",
    os: "macos",
    platform: "microsoft",
    tokenType: "Access Token / Refresh Token",
    source: "Azure CLI",
    difficulty: "easy",
    requiresPrivilege: false,
    steps: [
      "Read ~/.azure/msal_token_cache.json for cached tokens",
      "On macOS with Keychain integration, tokens may be in Keychain",
      "Run: az account get-access-token --resource https://graph.microsoft.com",
    ],
    tools: ["az CLI", "security (macOS)", "jq"],
    paths: [
      "~/.azure/msal_token_cache.json",
      "~/.azure/azureProfile.json",
    ],
    detection: [
      "Azure CLI process execution",
      "Keychain access events",
    ],
  },

  // --- Linux ---
  {
    id: "linux-gcloud-tokens",
    name: "gcloud CLI Token Extraction",
    os: "linux",
    platform: "google",
    tokenType: "OAuth2 Refresh Token / Access Token",
    source: "Google Cloud SDK",
    difficulty: "easy",
    requiresPrivilege: false,
    steps: [
      "Read ~/.config/gcloud/credentials.db (SQLite) for refresh tokens",
      "Read ~/.config/gcloud/access_tokens.db for cached access tokens",
      "Or run: gcloud auth print-access-token",
      "Application Default Credentials: ~/.config/gcloud/application_default_credentials.json",
    ],
    tools: ["gcloud CLI", "sqlite3", "jq"],
    paths: [
      "~/.config/gcloud/credentials.db",
      "~/.config/gcloud/access_tokens.db",
      "~/.config/gcloud/application_default_credentials.json",
      "~/.config/gcloud/properties",
    ],
    detection: [
      "File access to gcloud config directory",
      "SQLite queries against credential databases",
    ],
  },
  {
    id: "linux-azure-cli",
    name: "Linux Azure CLI Tokens",
    os: "linux",
    platform: "microsoft",
    tokenType: "Access Token / Refresh Token",
    source: "Azure CLI",
    difficulty: "easy",
    requiresPrivilege: false,
    steps: [
      "Read ~/.azure/msal_token_cache.json (plaintext JSON on Linux)",
      "No DPAPI or Keychain protection on Linux",
      "Run: az account get-access-token",
    ],
    tools: ["az CLI", "cat", "jq"],
    paths: [
      "~/.azure/msal_token_cache.json",
      "~/.azure/azureProfile.json",
    ],
    detection: [
      "File access to .azure directory",
      "az CLI process execution",
    ],
    notes: "Linux is the weakest platform for MSAL token cache protection -- no encryption at rest.",
  },

  // --- Browser ---
  {
    id: "browser-devtools",
    name: "Browser DevTools Token Extraction",
    os: "browser",
    platform: "both",
    tokenType: "Access Token / Session Cookie",
    source: "Browser Developer Tools",
    difficulty: "easy",
    requiresPrivilege: false,
    steps: [
      "Open browser DevTools (F12)",
      "Go to Application > Cookies to find session cookies",
      "Go to Application > Local Storage / Session Storage for tokens",
      "Go to Network tab and filter for Authorization headers",
      "Look for 'Bearer' tokens in request headers",
    ],
    tools: ["Browser DevTools", "EditThisCookie extension"],
    paths: [
      "localStorage['access_token']",
      "sessionStorage['msal.*']",
      "document.cookie",
    ],
    detection: [
      "No server-side detection for client-side extraction",
      "Browser extensions may log token access",
    ],
  },
  {
    id: "browser-localstorage-msal",
    name: "MSAL.js Token Extraction (Browser)",
    os: "browser",
    platform: "microsoft",
    tokenType: "Access Token / ID Token / Refresh Token",
    source: "MSAL.js in-browser cache",
    difficulty: "easy",
    requiresPrivilege: false,
    steps: [
      "Open DevTools > Application > Local Storage",
      "Look for keys starting with 'msal.' or containing 'accesstoken'",
      "MSAL.js stores tokens in localStorage by default",
      "Extract the 'secret' field from token cache entries",
    ],
    tools: ["Browser DevTools", "JavaScript console"],
    paths: [
      "localStorage (keys matching msal.*)",
      "sessionStorage (if sessionStorage cache is configured)",
    ],
    detection: [
      "No server-side detection",
      "XSS can extract these tokens if CSP is weak",
    ],
  },

  // --- Mobile ---
  {
    id: "mobile-android-accounts",
    name: "Android Account Manager Tokens",
    os: "mobile",
    platform: "google",
    tokenType: "OAuth2 Token",
    source: "Android AccountManager",
    difficulty: "hard",
    requiresPrivilege: true,
    steps: [
      "Root access required to access AccountManager database",
      "Database location: /data/system/users/0/accounts.db (or accounts_ce.db)",
      "Query for Google account tokens in the authtoken column",
      "Alternatively, use Android Debug Bridge (ADB) with root",
    ],
    tools: ["ADB", "Frida", "Objection", "sqlite3"],
    paths: [
      "/data/system/users/0/accounts.db",
      "/data/system_ce/0/accounts_ce.db",
    ],
    detection: [
      "Root detection by security apps",
      "MDM solutions may detect rooted devices",
    ],
  },
]

/**
 * Get extraction techniques filtered by OS.
 */
export function getExtractionsByOS(os: OperatingSystem): ExtractionTechnique[] {
  return EXTRACTION_TECHNIQUES.filter((t) => t.os === os)
}

/**
 * Get extraction techniques filtered by platform.
 */
export function getExtractionsByPlatform(platform: "google" | "microsoft" | "both"): ExtractionTechnique[] {
  return EXTRACTION_TECHNIQUES.filter((t) => t.platform === platform || t.platform === "both")
}

/**
 * Get extraction techniques filtered by difficulty.
 */
export function getExtractionsByDifficulty(difficulty: DifficultyLevel): ExtractionTechnique[] {
  return EXTRACTION_TECHNIQUES.filter((t) => t.difficulty === difficulty)
}
