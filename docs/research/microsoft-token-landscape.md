# Microsoft Token & API Access Landscape for Red Team Operations

## Research Document — Ninken Platform Expansion

**Date:** 2026-03-19
**Scope:** Comprehensive analysis of Microsoft token types, API surfaces, and authentication
mechanisms relevant to red team / security audit tooling.

**Current Ninken state:** Microsoft 365 integration uses FOCI public client refresh tokens
(Teams client ID `1fec8e78-bce4-4aaf-ab1b-5451cc387264`), delegated Graph API access to
Outlook, OneDrive, Teams, and Entra ID directory. Token refresh via
`login.microsoftonline.com/{tenant}/oauth2/v2.0/token` with `graph.microsoft.com/.default`
scope. No client_secret required (public client). Credential stored as
`MicrosoftCredential` in encrypted IndexedDB.

---

## Table of Contents

1. [Microsoft Graph API — Unexplored Scope Families](#1-microsoft-graph-api--unexplored-scope-families)
2. [Azure AD / Entra ID Token Types](#2-azure-ad--entra-id-token-types)
3. [Azure Resource Manager (ARM) Tokens](#3-azure-resource-manager-arm-tokens)
4. [Azure CLI / PowerShell Cached Tokens](#4-azure-cli--powershell-cached-tokens)
5. [Service Principal Credentials](#5-service-principal-credentials)
6. [Managed Identity Tokens](#6-managed-identity-tokens)
7. [Azure DevOps Personal Access Tokens](#7-azure-devops-personal-access-tokens)
8. [App-Only vs Delegated Tokens](#8-app-only-vs-delegated-tokens)
9. [On-Behalf-Of (OBO) Flow Tokens](#9-on-behalf-of-obo-flow-tokens)
10. [Stolen / Harvested Token Patterns from Real-World Red Team Operations](#10-stolen--harvested-token-patterns)
11. [Implementation Priority Matrix](#11-implementation-priority-matrix)
12. [Architecture Recommendations](#12-architecture-recommendations)

---

## 1. Microsoft Graph API — Unexplored Scope Families

Ninken currently uses: `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `Files.Read.All`,
`Files.ReadWrite.All`, `Team.ReadBasic.All`, `Channel.ReadBasic.All`,
`ChannelMessage.Read.All`, `User.Read.All`, `Directory.Read.All`, `GroupMember.Read.All`.

Below are all major Graph API scope families NOT yet implemented, with red team value assessment.

### 1.1 SharePoint Sites & Lists API

**What it is:** Full programmatic access to SharePoint Online sites, document libraries,
lists, subsites, and site permissions. Separate from OneDrive (which is the user's personal
drive), SharePoint exposes organizational document repositories, wikis, and structured data.

**Key scopes:**
- `Sites.Read.All` — Read all site collections and their contents
- `Sites.ReadWrite.All` — Full read/write to all sites
- `Sites.Manage.All` — Create/delete sites, manage permissions
- `Sites.FullControl.All` — App-only, godmode on SharePoint
- `Sites.Selected` — Scoped to specific sites (newer, granular)

**Key Graph endpoints:**
- `GET /sites` — Enumerate all sites
- `GET /sites/{site-id}/lists` — List all lists/libraries in a site
- `GET /sites/{site-id}/drive` — Access the document library as a drive
- `GET /sites/{site-id}/permissions` — Who has access
- `GET /sites/{site-id}/pages` — SharePoint pages (wiki content)
- `POST /sites/{hostname}:/path` — Resolve site by URL path
- `GET /search/query` — SharePoint search across all content

**Red team value:** **HIGH** — SharePoint is where organizations store policies, architecture
diagrams, credentials files, internal wikis, HR documents, financial data, and project plans.
Often the single richest source of sensitive documents in an M365 tenant. Many orgs have
overly permissive site-level sharing.

**Implementation complexity:** Medium. The API is well-documented and follows the same Graph
patterns as OneDrive (drives, driveItems). The existing `graphFetch`/`graphJson`/`graphPaginated`
helpers work directly. UI can reuse the file browser component with a site picker layer on top.

**Caveats:**
- `Sites.Read.All` is broad and may trigger DLP alerts in mature environments
- Some SharePoint content (InfoPath forms, legacy lists) doesn't render cleanly via API
- Large document libraries may require search rather than enumeration
- SharePoint search requires `ExternalItem.Read.All` for connectors content

---

### 1.2 Planner / To Do

**What it is:** Microsoft Planner (team task management, Kanban boards) and Microsoft To Do
(personal tasks). Planner boards are attached to M365 Groups and often contain project
details, assignments, and deadlines.

**Key scopes:**
- `Tasks.Read` — Read user's Planner tasks
- `Tasks.Read.All` — Read all Planner tasks (app-only)
- `Tasks.ReadWrite` — Full access to Planner
- `Group.Read.All` — Required to discover which groups have Planner boards

**Key Graph endpoints:**
- `GET /me/planner/tasks` — Current user's assigned tasks
- `GET /planner/plans/{plan-id}/tasks` — All tasks in a plan
- `GET /planner/plans/{plan-id}/buckets` — Kanban columns
- `GET /planner/tasks/{task-id}/details` — Task description, checklist, references
- `GET /me/todo/lists` — Personal To Do lists
- `GET /groups/{group-id}/planner/plans` — Plans for a group

**Red team value:** **MEDIUM** — Planner boards reveal project timelines, who is working on
what, and sometimes contain sensitive details in task descriptions (server names, passwords
in checklists, deployment schedules). To Do is less interesting (personal grocery lists) but
occasionally contains notes with credentials.

**Implementation complexity:** Low. Standard Graph REST. Could be a simple list/detail UI.

**Caveats:**
- Planner has a legacy data model (tasks reference plans via IDs, not nested URLs)
- Planner API has historically had rate limiting issues
- No single "list all plans in tenant" endpoint — must enumerate via groups

---

### 1.3 Intune / Device Management (Endpoint Manager)

**What it is:** Microsoft Intune manages mobile devices, desktops, compliance policies, and
app deployments. Access reveals the organization's entire device fleet, their compliance
status, installed applications, and configuration policies.

**Key scopes:**
- `DeviceManagementManagedDevices.Read.All` — Read all managed devices
- `DeviceManagementConfiguration.Read.All` — Read device configurations/policies
- `DeviceManagementApps.Read.All` — Read deployed applications
- `DeviceManagementRBAC.Read.All` — Read Intune RBAC assignments
- `DeviceManagementServiceConfig.Read.All` — Read Intune service configuration

**Key Graph endpoints:**
- `GET /deviceManagement/managedDevices` — All enrolled devices with OS, model, compliance
- `GET /deviceManagement/deviceConfigurations` — Configuration profiles (Wi-Fi, VPN, certs)
- `GET /deviceManagement/deviceCompliancePolicies` — What compliance rules exist
- `GET /deviceManagement/mobileApps` — Deployed apps (including LOB apps)
- `GET /deviceManagement/windowsAutopilotDeviceIdentities` — Autopilot registered devices
- `GET /deviceManagement/deviceEnrollmentConfigurations` — Enrollment restrictions
- `GET /deviceManagement/managedDevices/{id}/deviceCategory` — Device categorization

**Red team value:** **HIGH** — Device inventory reveals attack surface (OS versions, patch
levels, non-compliant devices). Configuration policies may expose VPN endpoints, Wi-Fi
PSKs, certificate authorities. App inventory shows what security tools are deployed
(EDR, DLP agents). Autopilot data can be used for device impersonation.

**Implementation complexity:** Medium. Many endpoints, complex object model. Would need a
dedicated "Devices" module with device list, detail views, and policy viewers.

**Caveats:**
- Requires admin-consented scopes in most tenants
- Device management scopes are often flagged by CASB/SIEM
- Some data (BitLocker keys, LAPS passwords) requires additional privileged scopes
- Beta API has significantly more endpoints than v1.0

---

### 1.4 Security API (Alerts, Incidents, Secure Score)

**What it is:** Microsoft Graph Security API aggregates security signals from Defender for
Endpoint, Defender for Identity, Defender for Cloud Apps, Sentinel, and more. It exposes
alerts, incidents, secure score, threat intelligence, and hunting queries.

**Key scopes:**
- `SecurityEvents.Read.All` — Read security alerts (legacy)
- `SecurityEvents.ReadWrite.All` — Read and update alerts
- `SecurityAlert.Read.All` — Read Defender alerts (v2)
- `SecurityIncident.Read.All` — Read security incidents
- `ThreatHunting.Read.All` — Run advanced hunting queries (KQL)
- `SecurityActions.Read.All` — Read response actions

**Key Graph endpoints:**
- `GET /security/alerts_v2` — All security alerts across products
- `GET /security/incidents` — Correlated incidents
- `GET /security/secureScores` — Tenant secure score over time
- `GET /security/secureScoreControlProfiles` — What controls are enabled/disabled
- `POST /security/runHuntingQuery` — Execute KQL queries against security data
- `GET /security/threatIntelligence/hosts/{hostId}` — Threat intel on a host
- `GET /security/attackSimulation/simulations` — Attack simulation training results

**Red team value:** **CRITICAL** — Reading the defender's security alerts tells you exactly
what they have detected (and what they haven't). Secure score reveals which security controls
are disabled. Advanced hunting lets you query the same telemetry the blue team uses — you can
see if your own activity has been flagged. This is the ultimate "see what the SOC sees"
capability.

**Implementation complexity:** Medium-High. The data model is complex (many alert providers,
each with different schemas). Advanced hunting requires a KQL query editor. Worth it.

**Caveats:**
- These scopes almost always require admin consent
- Accessing security APIs may itself generate a security alert (ironic but real)
- Advanced hunting (KQL) has a 10-minute timeout and row limits
- Not all Defender products are in every tenant

---

### 1.5 Compliance API (eDiscovery, Data Classification)

**What it is:** Microsoft Purview compliance APIs for eDiscovery (legal hold, content search),
data classification (sensitivity labels, data loss prevention), and information governance.

**Key scopes:**
- `eDiscovery.Read.All` — Read eDiscovery cases and content
- `eDiscovery.ReadWrite.All` — Create searches, export results
- `InformationProtectionPolicy.Read` — Read sensitivity labels
- `RecordsManagement.Read.All` — Read retention policies

**Key Graph endpoints:**
- `GET /security/cases/ediscoveryCases` — List eDiscovery cases
- `GET /security/cases/ediscoveryCases/{id}/searches` — Searches within a case
- `POST /security/cases/ediscoveryCases/{id}/searches/{searchId}/estimate` — Run a search
- `GET /informationProtection/policy/labels` — Sensitivity labels defined in tenant
- `GET /security/labels/retentionLabels` — Retention labels

**Red team value:** **HIGH** — eDiscovery is literally a built-in search-everything tool.
If you can create an eDiscovery search, you can search across all mailboxes, SharePoint,
OneDrive, and Teams simultaneously. Data classification labels tell you which documents
the org considers most sensitive (which is a targeting guide). Existing eDiscovery cases
may contain already-curated collections of sensitive data.

**Implementation complexity:** High. eDiscovery has an async workflow (create case, create
search, estimate, review, export). Would need a multi-step UI. But extremely powerful.

**Caveats:**
- eDiscovery.ReadWrite.All is one of the most privileged scopes in M365
- Creating eDiscovery searches leaves audit trails
- Results are paginated and may take minutes to process
- Requires E5 or compliance add-on license in the target tenant

---

### 1.6 Identity Protection (Risky Users, Risky Sign-Ins)

**What it is:** Azure AD Identity Protection monitors sign-in behavior and user risk.
Exposes which users are flagged as risky, which sign-ins are suspicious, and risk
detection details.

**Key scopes:**
- `IdentityRiskEvent.Read.All` — Read risk detections
- `IdentityRiskyUser.Read.All` — Read risky user profiles
- `IdentityRiskyServicePrincipal.Read.All` — Risky service principals

**Key Graph endpoints:**
- `GET /identityProtection/riskyUsers` — Users flagged as at risk
- `GET /identityProtection/riskyServicePrincipals` — Risky service principals
- `GET /identityProtection/riskDetections` — Individual risk events
- `GET /identityProtection/riskyUsers/{id}/history` — Risk state changes over time

**Red team value:** **HIGH** — Tells you if YOUR activity has been flagged. If the
compromised user shows up as "risky," the SOC may be investigating. Also reveals which
other users are risky (potential additional targets already partially compromised). Risk
detections include impossible travel, malware-linked IPs, anomalous tokens — all things
a red teamer needs to monitor about their own OPSEC.

**Implementation complexity:** Low. Simple list/detail views. Data model is straightforward.

**Caveats:**
- Requires Azure AD P2 license in target tenant
- Admin consent required
- Accessing these APIs may generate its own risk detection

---

### 1.7 Privileged Identity Management (PIM)

**What it is:** PIM manages just-in-time privileged access. Shows who has eligible roles
(not yet activated), active role assignments, assignment schedules, and approval workflows.

**Key scopes:**
- `RoleManagement.Read.All` — Read all role definitions and assignments
- `RoleManagement.Read.Directory` — Read directory role assignments
- `RoleAssignmentSchedule.Read.Directory` — Read PIM assignment schedules
- `RoleEligibilitySchedule.Read.Directory` — Read PIM eligibility schedules
- `PrivilegedAccess.Read.AzureAD` — Read PIM for Azure AD roles
- `PrivilegedAccess.Read.AzureResources` — Read PIM for Azure resources

**Key Graph endpoints:**
- `GET /roleManagement/directory/roleAssignments` — Active role assignments
- `GET /roleManagement/directory/roleDefinitions` — All role definitions
- `GET /roleManagement/directory/roleAssignmentScheduleInstances` — Currently active PIM activations
- `GET /roleManagement/directory/roleEligibilityScheduleInstances` — Eligible (not yet activated) roles
- `GET /roleManagement/directory/roleAssignmentScheduleRequests` — PIM activation history

**Red team value:** **CRITICAL** — PIM data reveals who CAN become a Global Admin (eligible
roles), even if they aren't currently one. This is the escalation map. If you compromise a
user with an eligible Global Admin role, you can activate it. PIM activation history also
shows the org's admin activity patterns (when admins activate, for how long, what they do).

**Implementation complexity:** Medium. Several related endpoints to stitch together.
Would pair well with the existing Entra ID roles view.

**Caveats:**
- Requires Azure AD P2
- `RoleManagement.Read.All` is admin-consent-only
- PIM for Azure resources uses a different API surface than PIM for Azure AD
- The Graph v1.0 PIM endpoints are relatively new (formerly only in beta)

---

### 1.8 Conditional Access Policies

**What it is:** Conditional Access policies define when, where, and how users can access
resources. They enforce MFA, block legacy auth, restrict by location/device, etc.

**Key scopes:**
- `Policy.Read.All` — Read all policies (CA, token lifetime, auth methods, etc.)
- `Policy.Read.ConditionalAccess` — Specifically read CA policies

**Key Graph endpoints:**
- `GET /identity/conditionalAccess/policies` — All CA policies with conditions and controls
- `GET /identity/conditionalAccess/namedLocations` — Trusted/blocked IP ranges and countries
- `GET /identity/conditionalAccess/authenticationStrength/policies` — Auth strength definitions
- `GET /identity/conditionalAccess/templates` — CA policy templates in use

**Red team value:** **CRITICAL** — CA policies ARE the security perimeter for M365. Reading
them tells you exactly:
- Which IPs/countries are trusted (move your C2 there)
- Which apps require MFA (and which don't — attack those)
- Which legacy auth protocols are allowed (password spray targets)
- Which devices are trusted (device compliance requirements)
- Session controls (how long tokens last before re-auth)
- What exceptions exist (break-glass accounts, excluded groups)

This is the single most valuable reconnaissance data for planning an M365 attack.

**Implementation complexity:** Low-Medium. Policies are well-structured JSON. A table view
with expandable details would work. Named locations could be visualized on a map.

**Caveats:**
- `Policy.Read.All` requires admin consent
- CA policies can reference GUIDs for groups/apps that need resolution
- Some advanced CA features (token protection, authentication context) are newer
- Reading CA policies is a high-value action that sophisticated tenants may monitor

---

### 1.9 App Registrations & Service Principals

**What it is:** Enumerating all application registrations (apps created in this tenant),
service principals (apps installed from other tenants or the gallery), their permissions,
secrets, and certificates.

**Key scopes:**
- `Application.Read.All` — Read all app registrations and service principals
- `Application.ReadWrite.All` — Modify apps (add secrets, change redirect URIs)
- `DelegatedPermissionGrant.Read.All` — Read OAuth2 permission grants

**Key Graph endpoints:**
- `GET /applications` — App registrations in this tenant
- `GET /applications/{id}/owners` — Who owns each app
- `GET /servicePrincipals` — Service principals (installed apps)
- `GET /servicePrincipals/{id}/appRoleAssignments` — App role assignments
- `GET /servicePrincipals/{id}/oauth2PermissionGrants` — Delegated permission grants
- `GET /servicePrincipals/{id}/credentials` — Certificate/secret metadata (NOT the values)
- `GET /oauth2PermissionGrants` — All OAuth2 consent grants in the tenant

**Red team value:** **CRITICAL** — This is the ROADtools-equivalent for Microsoft. App
registrations with secrets are service accounts. OAuth2 permission grants show which apps
have been consented to read mail, files, etc. Finding an app with `Application.ReadWrite.All`
or a service principal with `RoleManagement.ReadWrite.Directory` is a privilege escalation
path. Apps with expiring secrets may be targets for credential rotation attacks.

**Implementation complexity:** Medium. Lots of cross-referencing (app -> owners, app ->
permissions, app -> consent grants). The current M365 audit "Apps" page likely touches this
but could be expanded significantly.

**Caveats:**
- Secret/certificate VALUES are never returned by the API (only metadata like expiry)
- The number of service principals in a large tenant can be thousands
- Gallery apps vs custom apps have different properties
- `Application.ReadWrite.All` is extremely dangerous and should be highlighted in UI

---

### 1.10 Administrative Units

**What it is:** Administrative units are containers in Azure AD that restrict administrative
scope. They define which admins can manage which subset of users/groups.

**Key scopes:**
- `AdministrativeUnit.Read.All` — Read all admin units and their members
- `Directory.Read.All` — Also grants read access to admin units

**Key Graph endpoints:**
- `GET /administrativeUnits` — List all admin units
- `GET /administrativeUnits/{id}/members` — Members of an admin unit
- `GET /administrativeUnits/{id}/scopedRoleMembers` — Admins scoped to this unit

**Red team value:** **MEDIUM** — Admin units reveal organizational structure and delegation
boundaries. A scoped admin may have full user management within their unit. If you compromise
a scoped admin, you know exactly what they can touch.

**Implementation complexity:** Low. Simple list/member views.

**Caveats:**
- Many tenants don't use admin units at all
- Restricted management admin units (newer feature) add complexity

---

### 1.11 Cross-Tenant Access Settings

**What it is:** B2B collaboration and cross-tenant access policies. Defines which external
tenants are trusted, what access they get, and whether cross-tenant sync is configured.

**Key scopes:**
- `Policy.Read.All` — Read cross-tenant access policies
- `CrossTenantInformation.ReadBasic.All` — Read basic tenant info

**Key Graph endpoints:**
- `GET /policies/crossTenantAccessPolicy` — Default cross-tenant policy
- `GET /policies/crossTenantAccessPolicy/partners` — Per-partner trust settings
- `GET /tenantRelationships/multiTenantOrganization` — Multi-tenant org configuration
- `GET /directory/federationConfigurations` — Federation settings

**Red team value:** **HIGH** — Cross-tenant trust is a lateral movement path. If Tenant A
trusts Tenant B with inbound B2B access, compromising a user in Tenant B may give access
to Tenant A's resources. Multi-tenant organization settings can reveal an entire corporate
group structure.

**Implementation complexity:** Low. Policy documents are simple JSON.

**Caveats:**
- Requires admin consent
- Cross-tenant access policies are relatively new and may not exist in all tenants
- Multi-tenant org features are still evolving

---

### 1.12 Authentication Methods

**What it is:** Enumerate and manage authentication methods for users — what MFA methods
they have registered, their FIDO2 keys, phone numbers, etc.

**Key scopes:**
- `UserAuthenticationMethod.Read.All` — Read all users' auth methods
- `UserAuthenticationMethod.ReadWrite.All` — Modify auth methods (add MFA, reset passwords)

**Key Graph endpoints:**
- `GET /users/{id}/authentication/methods` — All auth methods for a user
- `GET /users/{id}/authentication/fido2Methods` — FIDO2 security keys
- `GET /users/{id}/authentication/phoneMethods` — Phone numbers for MFA
- `GET /users/{id}/authentication/microsoftAuthenticatorMethods` — Authenticator app registrations
- `GET /users/{id}/authentication/temporaryAccessPassMethods` — Active TAPs
- `GET /reports/authenticationMethods/userRegistrationDetails` — Registration summary

**Red team value:** **CRITICAL** — Knowing which users have MFA and what type directly
informs attack strategy. Users with only SMS MFA are SIM-swap targets. Users with no MFA
are password-spray targets. Users with Temporary Access Passes may have active TAPs you
can use. The auth methods registration report gives a tenant-wide view of MFA coverage gaps.

**Implementation complexity:** Low-Medium. Per-user detail views. Could integrate with the
Entra ID user detail page.

**Caveats:**
- Reading auth methods requires admin consent
- Phone numbers are PII and may trigger compliance alerts
- `UserAuthenticationMethod.ReadWrite.All` can reset passwords and add auth methods —
  extremely dangerous scope

---

### 1.13 Additional Noteworthy Graph Scopes

| Scope Family | Key Scopes | Red Team Value | Notes |
|---|---|---|---|
| **Calendar** | `Calendars.Read`, `Calendars.Read.Shared` | Medium | Meeting details, attendees, locations, Teams links |
| **Contacts** | `Contacts.Read` | Low-Medium | Org chart, personal contacts, external contacts |
| **People** | `People.Read.All` | Low | Relevance-ranked people (reveals org relationships) |
| **Presence** | `Presence.Read.All` | Low | Who is online/away (useful for timing operations) |
| **Chat** | `Chat.Read`, `Chat.ReadWrite` | High | 1:1 and group chats in Teams (separate from channels) |
| **Bookings** | `Bookings.Read.All` | Low | Booking pages, customer data |
| **Reports** | `Reports.Read.All` | Medium | Usage reports (who uses what, activity patterns) |
| **ExternalConnections** | `ExternalConnection.Read.All` | Medium | Graph connectors to external data |
| **Notifications** | `Notifications.ReadWrite.CreatedByApp` | Low | Push notifications |
| **BitLocker** | `BitlockerKey.Read.All` | Critical | BitLocker recovery keys (!!) |
| **Print** | `PrintJob.Read.All` | Low-Medium | Print jobs (occasionally contain sensitive docs) |
| **Entitlement Management** | `EntitlementManagement.Read.All` | Medium | Access packages, catalog, assignments |
| **Lifecycle Workflows** | `LifecycleWorkflows.Read.All` | Low | Joiner/mover/leaver workflows |
| **Cloud PC** | `CloudPC.Read.All` | Medium | Windows 365 Cloud PCs (virtual desktops) |
| **Threat Assessment** | `ThreatAssessment.Read.All` | Medium | Submitted threat assessments |
| **Access Reviews** | `AccessReview.Read.All` | Medium | Active access reviews and their decisions |

---

## 2. Azure AD / Entra ID Token Types

### 2.1 Access Tokens (v1.0 vs v2.0 endpoints)

**What it is:** JWT tokens issued by Azure AD that grant access to a specific resource (audience).
The v1.0 endpoint (`/oauth2/token`) and v2.0 endpoint (`/oauth2/v2.0/token`) issue tokens with
different claim structures.

**How obtained:**
- Authorization code flow (interactive)
- Client credentials flow (app-only)
- Refresh token exchange (what Ninken currently does)
- Device code flow
- ROPC (Resource Owner Password Credentials) — legacy
- Implicit flow — deprecated but still works

**Key differences:**
- v1.0 tokens: `resource` parameter (e.g., `https://graph.microsoft.com`), `aud` is the resource
- v2.0 tokens: `scope` parameter (e.g., `https://graph.microsoft.com/.default`), supports OIDC
- v1.0 tokens can still be obtained from v2.0 endpoint when targeting v1.0 resources
- Token lifetime: typically 60-90 minutes (configurable via Token Lifetime Policy)

**Red team value:** **HIGH** — Understanding token versions matters because some resources
(older Azure services, on-prem AD FS relying parties) only accept v1.0 tokens. The v2.0
endpoint is more flexible but v1.0 is still needed for legacy access.

**Implementation for Ninken:**
Ninken currently uses v2.0 exclusively. To support v1.0 resources, add an option to refresh
with `resource=` instead of `scope=`.

```
# v2.0 (current)
grant_type=refresh_token&scope=https://graph.microsoft.com/.default offline_access

# v1.0 (needed for ARM, legacy)
grant_type=refresh_token&resource=https://management.azure.com/
```

**Complexity:** Low. Same refresh token, different parameter in the refresh call.

---

### 2.2 Refresh Tokens

**What it is:** Long-lived tokens (up to 90 days, or until revoked) that can be exchanged
for new access tokens. This is what Ninken stores and operates on.

**Key properties:**
- Single-use in theory (rotating refresh tokens), but FOCI clients get shared RTs
- Bound to a client_id + tenant_id
- Can be used to get access tokens for DIFFERENT resources (key for pivoting)
- Revoked by: password change, admin revocation, token lifetime policy, 90 days of inactivity

**Red team value:** **CRITICAL** — This is the crown jewel. A single refresh token provides
persistent access across all resources the user has access to. Ninken's core value proposition.

**Ninken status:** Already implemented as the primary credential type.

**Caveats:**
- Continuous Access Evaluation (CAE) can invalidate tokens mid-session
- Token protection (proof-of-possession) is being rolled out and will bind tokens to devices
- Some tenants enforce shorter refresh token lifetimes

---

### 2.3 Primary Refresh Token (PRT)

**What it is:** A special token issued to a device during Azure AD join or registration.
The PRT provides SSO across all Azure AD-integrated applications on that device. It is
stored in the device's TPM (or software equivalent) and is used by the CloudAP and
Web Account Manager (WAM) plugins.

**How obtained (in red team scenarios):**
- `mimikatz` on a domain-joined/Azure AD-joined device (`sekurlsa::cloudap`)
- `ROADtoken` tool — requests a PRT-derived token via the device's WAM broker
- `RequestSecurityToken` — SOAP request to Azure AD using PRT cookie
- Abusing Chrome/Edge browser SSO extension (device-bound HTTPS cookies)
- PRT cookie extraction from browser processes

**What it grants:**
- SSO to all Azure AD-integrated applications (Graph, ARM, SharePoint, etc.)
- Can be converted to access tokens for ANY resource
- Often has device compliance claims (bypasses CA policies requiring compliant devices)
- Can include MFA claim if the user authenticated with MFA when getting the PRT

**Red team value:** **CRITICAL** — A PRT is effectively a master key. It inherits the device's
compliance state and the user's MFA status. Many CA policies say "require MFA OR compliant
device" — a PRT from a compliant device satisfies both.

**Implementation for Ninken:**
- Accept PRT cookies as an input credential type
- Convert PRT to access tokens via the nonce/cookie flow:
  1. Request a nonce from `login.microsoftonline.com`
  2. Build a PRT cookie with the nonce
  3. Use the PRT cookie to obtain an access token
- This requires the actual PRT key material OR a PRT cookie

**Complexity:** High. PRT handling requires understanding the cookie format, nonce exchange,
and device-specific crypto. But tools like ROADtoken have paved the way. A Ninken "Import
PRT" flow could accept the Base64 PRT cookie and convert it.

**Caveats:**
- PRT theft leaves forensic traces on the source device
- Microsoft is actively hardening PRT storage (TPM-bound PRTs)
- Token protection initiative aims to make PRTs non-exportable
- PRT cookies have a nonce that expires quickly (5 minutes)

---

### 2.4 ID Tokens

**What it is:** OIDC identity tokens that contain claims about the authenticated user.
Not used for API access, but contain valuable identity information.

**Key claims:** `sub`, `oid` (object ID), `tid` (tenant ID), `upn`, `name`, `email`,
`groups`, `roles`, `amr` (authentication methods used), `device_id`, `tenant_region_scope`

**Red team value:** **MEDIUM** — Primarily informational. The `amr` claim reveals whether
MFA was used (`mfa`, `ngcmfa`). The `groups` claim (if enabled) reveals group memberships.
The `device_id` claim reveals the device used.

**Implementation for Ninken:** Already partially implemented (Ninken decodes the access token
JWT for user info). Could add explicit ID token handling.

**Complexity:** Trivial. Just decode the JWT.

---

### 2.5 SAML Tokens

**What it is:** SAML 1.1/2.0 assertion tokens issued by Azure AD (acting as an IdP) to
SAML-based relying parties. Common for on-premises and legacy enterprise applications.

**How obtained:**
- Azure AD issues SAML tokens when redirecting to a SAML SP
- Can be obtained via the WS-Federation endpoint
- Golden SAML attack: forge tokens using the AD FS signing certificate
- Silver SAML attack: forge tokens using Azure AD's SAML signing certificate

**Red team value:** **HIGH** — If the target uses SAML-based apps (Salesforce, AWS, custom
line-of-business apps), SAML tokens provide access to those. Golden SAML is a persistence
technique that survives password resets and MFA.

**Implementation for Ninken:** Limited applicability for a web app. Ninken could accept
SAML assertions and decode them (show claims, audience, validity) but replaying them
requires browser-based POST flows.

**Complexity:** Medium. Accepting and decoding SAML XML is straightforward. Replaying them
to SPs is harder (need the SP's ACS URL and proper HTTP POST binding).

---

### 2.6 Continuous Access Evaluation (CAE) Tokens

**What it is:** CAE-capable tokens are access tokens with extended lifetimes (up to 28 hours)
that can be revoked mid-session by critical events (password change, user disabled, IP change
outside trusted network, admin revocation).

**How to identify:** CAE tokens contain an `xms_cc` claim with value `cp1` (claims challenge
protocol 1). They are longer-lived but subject to instant revocation.

**Red team value:** **MEDIUM** — CAE is primarily a defensive mechanism. Understanding it
matters because:
- CAE tokens last longer (good for persistence) but can be instantly revoked (bad for persistence)
- If you trigger a CAE revocation event (e.g., user changes password), your token dies immediately
- Network-location-based CAE means your C2 IP matters
- Ninken should detect CAE tokens and warn operators about revocation risks

**Implementation for Ninken:** Detect `xms_cc` claim in access tokens. Display CAE status
in the token info panel. Warn when performing actions that might trigger CAE revocation.

**Complexity:** Low. Just claim detection and UI.

---

## 3. Azure Resource Manager (ARM) Tokens

### 3.1 Overview

**What it is:** Access tokens scoped to `https://management.azure.com/` that provide access
to Azure infrastructure — subscriptions, resource groups, VMs, storage accounts, Key Vault,
networking, databases, and all other Azure resources.

**How obtained:** Same OAuth flows as Graph tokens, but with a different resource/scope:
- Scope: `https://management.azure.com/.default`
- Resource (v1.0): `https://management.azure.com/`
- A single refresh token can be exchanged for BOTH Graph and ARM access tokens

**What it grants:**
- `GET /subscriptions` — List all subscriptions the user has access to
- `GET /subscriptions/{id}/resourceGroups` — List resource groups
- VM management (start, stop, run commands, capture screenshots)
- Storage account access (list keys, read blobs directly)
- Key Vault access (if the user has Key Vault access policies)
- Network enumeration (VNets, NSGs, public IPs, firewalls)
- SQL database access
- App Service configuration (connection strings, app settings)
- AKS cluster access

**Red team value:** **CRITICAL** — Azure resources are often the actual crown jewels.
Key Vault contains secrets, certificates, and encryption keys. Storage accounts contain
data. VMs can be accessed via Run Command. App Service configuration often contains
database connection strings and API keys in plain text.

**Implementation for Ninken:**

This is a major new module. The key insight is that Ninken's existing refresh token can be
used to get ARM tokens WITHOUT any additional credential — just change the scope in the
token refresh call.

```typescript
// New function in microsoft.ts
export async function refreshArmAccessToken(credential: MicrosoftCredential) {
  const res = await fetch(tokenUri, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refresh_token,
      client_id: credential.client_id,
      scope: "https://management.azure.com/.default offline_access",
    }),
  })
  // ... same pattern as current Graph refresh
}
```

**Priority modules:**
1. Subscription & resource group enumeration
2. Key Vault secrets listing (names + metadata, values require vault-specific access)
3. Storage account enumeration + blob listing
4. VM inventory (OS, IPs, status)
5. App Service / Function App configuration
6. Network topology (VNets, NSGs, public IPs)
7. SQL database enumeration

**Complexity:** Medium-High. ARM API is huge. Start with subscription enumeration and
Key Vault. Each resource type has its own API version and schema.

**Caveats:**
- ARM requires Azure RBAC roles (Reader, Contributor, Owner), not just Graph permissions
- Many users with M365 access have NO Azure subscription access
- Key Vault access requires separate Key Vault access policies or RBAC
- ARM API versions must be specified per resource type (`?api-version=2023-01-01`)
- ARM tokens hit `management.azure.com`, not `graph.microsoft.com`

---

### 3.2 Key Vault Tokens

**What it is:** Tokens specifically scoped to Azure Key Vault
(`https://vault.azure.net/.default`). Separate from both Graph and ARM tokens.

**Red team value:** **CRITICAL** — Key Vault stores secrets (passwords, connection strings),
certificates (TLS certs, code signing), and cryptographic keys. Direct access to Key Vault
bypasses the need to enumerate through ARM.

**Implementation:** Same refresh token, different scope:
```
scope=https://vault.azure.net/.default offline_access
```

**Complexity:** Low (token acquisition). Medium (UI for browsing vault contents).

---

### 3.3 Azure Storage Tokens

**What it is:** Tokens scoped to Azure Storage (`https://storage.azure.com/.default`).
Provides direct blob/file/queue/table access without going through ARM.

**Red team value:** **HIGH** — Direct access to storage accounts, bypassing ARM. Can read
blobs, file shares, table data.

**Implementation:** Same refresh token, different scope:
```
scope=https://storage.azure.com/.default offline_access
```

**Complexity:** Low-Medium.

---

## 4. Azure CLI / PowerShell Cached Tokens

### 4.1 Azure CLI (`az login`) Tokens

**What it is:** When users run `az login`, the Azure CLI stores tokens in:
- **Linux/macOS:** `~/.azure/msal_token_cache.json` (plaintext JSON since Azure CLI 2.30+)
- **Windows:** `%USERPROFILE%\.azure\msal_token_cache.json` or DPAPI-protected
- **Legacy:** `~/.azure/accessTokens.json` (deprecated but still present in older installs)

**Token format (msal_token_cache.json):**
```json
{
  "AccessToken": {
    "key": {
      "secret": "eyJ0eXAi...",
      "credential_type": "AccessToken",
      "client_id": "04b07795-ee44-4dc3-a537-67c46da089de",
      "target": "https://management.azure.com//.default",
      "realm": "tenant-id",
      "environment": "login.microsoftonline.com"
    }
  },
  "RefreshToken": {
    "key": {
      "secret": "0.ARwA...",
      "credential_type": "RefreshToken",
      "client_id": "04b07795-ee44-4dc3-a537-67c46da089de"
    }
  }
}
```

**Red team value:** **CRITICAL** — Azure CLI tokens are among the most commonly harvested
credentials in real engagements. The CLI client ID `04b07795-ee44-4dc3-a537-67c46da089de` is
a FOCI client, meaning its refresh token can be used to access Graph, ARM, Key Vault, and
more. Many developers leave these cached on their workstations.

**Implementation for Ninken:**
- Auto-detect the MSAL token cache format on credential paste
- Extract refresh tokens from the cache structure
- Use the Azure CLI client ID for token refresh
- Map cached tokens to their target resources

**Complexity:** Low. The format is well-known JSON. Just add detection in the Microsoft
provider's `detectCredential`/`validateCredential` methods.

---

### 4.2 Azure PowerShell (`Connect-AzAccount`) Tokens

**What it is:** Azure PowerShell stores tokens in:
- `~/.Azure/AzureRmContext.json` — Contains access tokens and refresh tokens
- `~/.Azure/TokenCache.dat` — DPAPI-protected binary cache (Windows)
- Environment variable: `$env:AZURE_ACCESS_TOKEN` (if set)

**Client ID:** `1950a258-227b-4e31-a9cf-717495945fc2` (Azure PowerShell — also FOCI)

**Red team value:** **HIGH** — Same value as Azure CLI tokens. Different client ID but
same FOCI behavior.

**Implementation:** Same as Azure CLI — detect the format, extract refresh token, use the
PowerShell client ID.

**Complexity:** Low.

---

### 4.3 Visual Studio / VS Code Tokens

**What it is:** Visual Studio and VS Code store Azure authentication tokens for the Azure
extensions:
- VS Code: `~/.vscode/extensions/ms-vscode.azure-account-*/` and OS keychain
- Visual Studio: Windows Credential Manager

**Client IDs:**
- VS Code: `aebc6443-996d-45c2-90f0-388ff96faa56`
- Visual Studio: `872cd9fa-d31f-45e0-9eab-6e460a02d1f1`

**Red team value:** **MEDIUM** — Developers often have elevated Azure access. VS Code
tokens may have access to Azure DevOps, Azure resources, and Graph.

**Implementation:** Extract from known paths, use appropriate client IDs.

**Complexity:** Medium (VS Code uses OS keychain on some platforms).

---

## 5. Service Principal Credentials

### 5.1 Client Secret Authentication

**What it is:** A service principal (app registration) with a client_secret. This is the
most common form of non-interactive authentication in Azure.

**How obtained:**
- Harvested from source code, config files, CI/CD pipelines, environment variables
- Azure Portal (if you have access to the app registration)
- `az ad app credential list` (shows metadata, not values)

**Token acquisition:**
```
POST /{tenant_id}/oauth2/v2.0/token
grant_type=client_credentials
client_id={app_id}
client_secret={secret}
scope=https://graph.microsoft.com/.default
```

**Red team value:** **CRITICAL** — Service principals often have higher privileges than
users (because they're created for automation). They bypass MFA and CA policies (unless
CA explicitly targets service principals). They can have application-level permissions
(Mail.Read for ALL mailboxes, not just one user).

**Implementation for Ninken:**
- New credential type: `{ client_id, client_secret, tenant_id }`
- Token refresh is stateless (no refresh token needed — just re-request with client_credentials)
- Different from delegated tokens: app-only tokens have different claims structure

**Complexity:** Low. Simpler than refresh token flow (no refresh token management needed).

**Caveats:**
- App-only tokens cannot access user-specific endpoints (`/me/...`)
- Must use `/users/{user-id}/...` instead
- Some Graph endpoints only work with delegated permissions (not app-only)
- Service principal sign-ins appear in the "Service principal sign-ins" log (separate from user sign-ins)

---

### 5.2 Certificate-Based Authentication

**What it is:** Service principal authenticating with an X.509 certificate instead of a
client secret. The private key signs a JWT assertion that replaces the client_secret.

**How obtained:**
- Certificate (.pfx/.pem) harvested from servers, Key Vault, CI/CD
- `az ad app credential list` shows certificate thumbprints

**Token acquisition:**
```
POST /{tenant_id}/oauth2/v2.0/token
grant_type=client_credentials
client_id={app_id}
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
client_assertion={signed_jwt}
scope=https://graph.microsoft.com/.default
```

**Red team value:** **HIGH** — Certificate-based auth is considered more secure than
client secrets, so orgs that use it may have a false sense of security. If you obtain
the certificate, access is identical to client secret auth.

**Implementation for Ninken:**
- Accept PFX/PEM certificate upload
- Build and sign the JWT assertion client-side (Web Crypto API)
- Use the assertion in the client_credentials flow

**Complexity:** Medium-High. Need to parse certificates and sign JWTs. The Web Crypto API
can do it but the code is non-trivial.

---

### 5.3 Federated Credentials (Workload Identity Federation)

**What it is:** Service principal that trusts tokens from an external identity provider
(GitHub Actions, Kubernetes, other Azure AD tenants). No secret or certificate — the
external system presents its own token, and Azure AD validates it against the federation
configuration.

**How obtained:**
- Compromise a GitHub Actions workflow that uses Azure federated identity
- Access a Kubernetes pod with a projected service account token
- Any workload with a federated identity provider

**Red team value:** **HIGH** — Federated credentials don't have secrets to rotate. If
you compromise the federated source (e.g., a GitHub repo), you get persistent Azure access
that won't be caught by secret scanning tools.

**Implementation for Ninken:** Would need to accept external IdP tokens and perform the
token exchange. Complex but feasible for GitHub Actions tokens.

**Complexity:** High.

---

## 6. Managed Identity Tokens

### 6.1 System-Assigned Managed Identity

**What it is:** An Azure resource (VM, App Service, Function App, AKS pod) gets an
automatically managed identity in Azure AD. Tokens are obtained from the Instance Metadata
Service (IMDS) at `http://169.254.169.254/metadata/identity/oauth2/token`.

**How obtained (red team):**
- SSRF from a web app running on Azure to the IMDS endpoint
- Code execution on an Azure VM
- Access to a Kubernetes pod in AKS with managed identity enabled

**Token acquisition:**
```
GET http://169.254.169.254/metadata/identity/oauth2/token
    ?api-version=2018-02-01
    &resource=https://management.azure.com/
Headers: Metadata: true
```

**Red team value:** **CRITICAL** — Managed identity tokens are often over-provisioned
(Contributor on the subscription for a web app that only needs Storage Blob Reader).
SSRF-to-managed-identity is a top-tier cloud attack path.

**Implementation for Ninken:**
- Accept raw access tokens (no refresh token available for managed identities)
- Probe multiple resource audiences to determine what the token can access
- Display token lifetime prominently (managed identity tokens expire and can't be refreshed
  outside the Azure environment)

**Complexity:** Low (just accept the access token). The limitation is that managed identity
tokens cannot be refreshed from outside Azure — they have a fixed lifetime (typically 24 hours
but varies).

**Caveats:**
- No refresh token — once the access token expires, you need to hit IMDS again
- Only available from within the Azure environment (not remotely refreshable)
- System-assigned identity is deleted when the resource is deleted

---

### 6.2 User-Assigned Managed Identity

**What it is:** A standalone Azure AD identity resource that can be attached to multiple
Azure resources. Same IMDS endpoint, but you specify which identity to use via `client_id`
or `object_id` parameter.

**Red team value:** Same as system-assigned, but can be shared across resources (compromise
one, access them all).

---

## 7. Azure DevOps Personal Access Tokens (PATs)

**What it is:** Personal Access Tokens for Azure DevOps (dev.azure.com). These are
long-lived tokens that provide access to repos, pipelines, work items, feeds, and more.

**How obtained:**
- Harvested from developer machines, CI/CD configs, `.npmrc` files, git credential stores
- Azure DevOps UI (Settings > Personal Access Tokens)

**Usage:**
```
Authorization: Basic base64(:pat_token)
```
Note: The username is empty, just `:token` base64-encoded.

**What it grants:** Depending on scopes:
- `Code (Read/Write)` — Git repos (source code, secrets in code)
- `Build (Read/Execute)` — CI/CD pipelines (can trigger builds)
- `Release (Read/Write/Execute)` — Release pipelines (deploy to production)
- `Packaging (Read)` — Package feeds (internal packages, potential supply chain attacks)
- `Work Items (Read)` — User stories, bugs (internal project details)
- `Variable Groups` — Often contain secrets for deployments
- `Service Connections` — Credentials for external services
- `Agent Pools` — Build agents (potential code execution)

**Red team value:** **CRITICAL** — Azure DevOps contains source code, CI/CD pipelines
(which often have secrets), and deployment infrastructure. Pipeline compromise enables
supply chain attacks. Variable groups and service connections often contain cloud
credentials, database passwords, and API keys.

**Implementation for Ninken:**
- New provider: `azure-devops`
- Credential type: `{ pat: string, organization: string }`
- Use Azure DevOps REST API (`https://dev.azure.com/{org}/_apis/...`)
- Key modules: Repos browser, Pipeline viewer, Variable groups (secrets), Service connections

**Complexity:** Medium. Azure DevOps API is separate from Graph (different base URL, auth
scheme, API structure). Would be a new provider, not an extension of the Microsoft provider.

**Caveats:**
- PATs are scoped to an organization, not a tenant
- PATs expire (max 1 year, configurable by org policy)
- Some orgs require PATs to be linked to specific scopes
- PAT usage appears in Azure DevOps audit logs

---

## 8. App-Only Tokens (Client Credentials Flow) vs Delegated Tokens

### 8.1 Delegated Tokens (Current Ninken Model)

**What it is:** Tokens obtained on behalf of a user. The token carries both the app's
permissions AND the user's permissions (intersection). Used with interactive flows
(auth code, device code) and refresh tokens.

**Key characteristics:**
- Access is limited to what the USER can access (even if the app has broader permissions)
- Can access `/me/` endpoints
- Subject to user-level CA policies
- Token has both `scp` (delegated scopes) and user claims

**Current Ninken implementation:** All Microsoft access is delegated via refresh tokens.

---

### 8.2 App-Only Tokens (Client Credentials Flow)

**What it is:** Tokens obtained by the application itself, without a user context. The app
authenticates with its own credentials (secret/certificate) and gets permissions defined
by APPLICATION permissions (not delegated permissions).

**Key characteristics:**
- NO user context — the app acts as itself
- Cannot use `/me/` endpoints (must use `/users/{id}/` or `/users/{upn}/`)
- Permissions are typically ALL-or-nothing (e.g., `Mail.Read` means ALL mailboxes)
- Not subject to user-level CA policies (but can be targeted by workload identity CA)
- Token has `roles` claim instead of `scp` claim

**Red team value:** **CRITICAL** — An app-only token with `Mail.Read` can read EVERY
mailbox in the tenant. With `User.ReadWrite.All`, it can modify any user. App-only
permissions are the highest-value tokens in M365.

**Implementation for Ninken:**
- Accept service principal credentials (client_id + client_secret or certificate)
- Add a "user selector" to the UI (since there's no `/me/`, operator chooses which user
  to impersonate)
- Display APPLICATION permissions (roles) instead of delegated scopes
- Highlight the "all mailboxes" / "all files" nature of app-only access

**Complexity:** Medium. The Graph API calls are the same, but need to replace `/me/` with
`/users/{id}/` throughout. Need a user picker in the UI.

---

## 9. On-Behalf-Of (OBO) Flow Tokens

**What it is:** A middle-tier service exchanges a user's access token for a new access
token to a downstream service, maintaining the user's identity. Used in multi-tier
architectures (e.g., frontend -> API -> Graph).

**How obtained (red team):**
- Intercept an access token from a web app and use it to OBO into other resources
- Compromise a middle-tier service that performs OBO exchanges
- Abuse misconfigured OBO permissions

**Token exchange:**
```
POST /{tenant_id}/oauth2/v2.0/token
grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
client_id={middle_tier_app_id}
client_secret={middle_tier_secret}
assertion={user_access_token}
scope=https://graph.microsoft.com/.default
requested_token_use=on_behalf_of
```

**Red team value:** **MEDIUM** — OBO is interesting when you capture an access token
(not a refresh token) and want to pivot to other resources. However, OBO requires the
middle-tier app's client_secret, which limits its use.

**Implementation for Ninken:**
- Accept an access token + middle-tier app credentials
- Perform OBO exchange to get tokens for other resources
- This is a niche scenario but valuable for API-to-API lateral movement

**Complexity:** Medium.

**Caveats:**
- Requires both the user's access token AND the middle-tier app's credentials
- OBO tokens inherit the user's permissions (not the app's)
- OBO chains (A -> B -> C) have depth limits

---

## 10. Stolen / Harvested Token Patterns from Real-World Red Team Operations

### 10.1 FOCI (Family of Client IDs) Token Abuse

**What it is:** Microsoft FOCI is a feature where certain "family" applications share
refresh tokens. If you have a refresh token from one FOCI app, you can exchange it for
access tokens using a DIFFERENT FOCI app's client_id.

**Known FOCI client IDs:**
| Client ID | Application |
|---|---|
| `1fec8e78-bce4-4aaf-ab1b-5451cc387264` | Microsoft Teams |
| `04b07795-ee44-4dc3-a537-67c46da089de` | Azure CLI |
| `1950a258-227b-4e31-a9cf-717495945fc2` | Azure PowerShell |
| `d3590ed6-52b3-4102-aeff-aad2292ab01c` | Microsoft Office |
| `00b41c95-dab0-4487-9791-b9d2c32c80f2` | Office 365 Management API |
| `26a7ee05-5602-4d76-a7ba-eae8b7b67941` | Windows Search |
| `27922004-5251-4030-b22d-91ecd9a37ea4` | Outlook Mobile |
| `4813382a-8fa7-425e-ab75-3b753aab3abb` | Microsoft Authenticator |
| `ab9b8c07-8f02-4f72-87fa-80105867a763` | OneDrive SyncEngine |
| `0ec893e0-5785-4de6-99da-4ed124e5296c` | Office UWP PWA |
| `d326c1ce-6cc6-4de2-bebc-4591e5e13ef0` | SharePoint |
| `872cd9fa-d31f-45e0-9eab-6e460a02d1f1` | Visual Studio |
| `af124e86-4e96-495a-b70a-90f90ab96707` | OneDrive iOS |

**Red team technique:** Capture a refresh token from Teams (via FOCI ID), then use the
Azure CLI FOCI ID to get ARM access tokens. Same refresh token, different client_id,
different resource access.

**Red team value:** **CRITICAL** — FOCI is why a single stolen Teams refresh token can
pivot to Azure infrastructure access. Ninken already uses the Teams FOCI client ID. The
platform should support automatic FOCI pivoting — try all FOCI client IDs with the
stolen refresh token to discover maximum access.

**Implementation for Ninken:**
- Add a "FOCI Pivot" feature: given a refresh token, automatically try all FOCI client IDs
- For each successful pivot, test multiple resource scopes (Graph, ARM, Key Vault, Storage)
- Display a matrix of what access each FOCI client ID grants
- Store the working FOCI client_id per resource for future use

**Complexity:** Low-Medium. Just iterate over FOCI client IDs in the refresh call.

---

### 10.2 Refresh Token Resource Pivoting

**What it is:** A single refresh token can be exchanged for access tokens to DIFFERENT
resources by changing the `scope` parameter. This is how you move from Graph access to
ARM access to Key Vault access without any additional credentials.

**Resource pivot map:**
```
refresh_token ──► scope=https://graph.microsoft.com/.default     → Graph API (Mail, Files, Directory)
              ──► scope=https://management.azure.com/.default    → ARM API (Azure infrastructure)
              ──► scope=https://vault.azure.net/.default          → Key Vault (secrets, certs, keys)
              ──► scope=https://storage.azure.com/.default        → Azure Storage (blobs, files)
              ──► scope=https://database.windows.net/.default     → Azure SQL Database
              ──► scope=https://ossrdbms-aad.database.windows.net → Azure MySQL/PostgreSQL
              ──► scope=https://analysis.windows.net/powerbi/api  → Power BI
              ──► scope=https://api.loganalytics.io/.default      → Log Analytics
              ──► scope=https://dev.azure.com/.default            → Azure DevOps
              ──► scope=https://outlook.office365.com/.default    → Outlook (direct, not via Graph)
              ──► scope=https://manage.office.com/.default        → Office Management API
              ──► scope=https://substrate.office.com/.default     → Office Substrate (internal)
              ──► scope=https://api.spaces.skype.com/.default     → Skype/Teams backend
              ──► scope=https://service.powerapps.com/.default    → Power Apps
              ──► scope=https://api.flow.microsoft.com/.default   → Power Automate
              ──► scope=https://graph.windows.net/.default        → Azure AD Graph (legacy)
              ──► scope=https://atmenabled.microsoft.com/.default → ATM (internal)
```

**Red team value:** **CRITICAL** — This is the fundamental technique that makes a single
refresh token into a skeleton key. Ninken should implement automatic resource enumeration:
try every known resource scope and report which ones grant access.

**Implementation for Ninken:**
- Add a "Resource Probe" feature on credential import
- Try each resource scope with the refresh token
- Display a dashboard showing accessible resources
- Allow one-click navigation to each accessible resource's module

**Complexity:** Low. Just a loop of token refresh calls with different scopes.

---

### 10.3 PRT Cookie Theft

**What it is:** Extracting the Primary Refresh Token cookie (`x-ms-RefreshTokenCredential`)
from a compromised device and replaying it from an attacker-controlled machine.

**Tools:**
- `ROADtoken` — Obtains a PRT-derived token from the local device via WAM
- `AADInternals` — PowerShell toolkit for PRT operations
- `RequestSecurityToken` — Direct PRT-to-access-token exchange
- Browser DevTools — Extract PRT cookies from browser SSO flows

**The flow:**
1. Extract PRT (or PRT cookie) from compromised device
2. Request a nonce from `login.microsoftonline.com/{tenant}/oauth2/token`
3. Create a signed JWT with the PRT and nonce
4. Send the JWT cookie to get an access token
5. Alternatively, use the PRT cookie to authenticate to web-based services

**Red team value:** **CRITICAL** — PRT theft is one of the most powerful Azure AD attacks.
A PRT inherits the device's compliance state and the user's MFA claim. It can be used to
access any Azure AD-integrated resource.

**Implementation for Ninken:**
- Accept PRT cookie (Base64 `x-ms-RefreshTokenCredential` value) as input
- Accept raw PRT + session key for direct token exchange
- Convert to access/refresh tokens
- Flag the inherited MFA/device compliance claims in the UI

**Complexity:** High. PRT crypto involves session keys, signed JWTs, and nonce management.
But existing tooling (AADInternals, ROADtoken) provides reference implementations.

---

### 10.4 Azure AD Connect Sync Account

**What it is:** Azure AD Connect uses a service account to synchronize on-premises AD with
Azure AD. This account has `Directory.ReadWrite.All` equivalent permissions and can read/write
all user attributes, including password hashes.

**How obtained:**
- Compromise the Azure AD Connect server
- Extract credentials from the AD Connect database (`C:\Program Files\Microsoft Azure AD Sync\Data\ADSync.mdf`)
- `AADInternals`: `Get-AADIntSyncCredentials`
- DPAPI decryption of stored credentials

**What it grants:**
- Read/write all Azure AD user attributes
- Password hash sync: can set user password hashes
- Pass-through auth: can intercept/forge authentication
- Can create/modify any user, group, or device object

**Red team value:** **CRITICAL** — This is domain admin equivalent for Azure AD. Full
directory control.

**Implementation for Ninken:**
- Accept sync account credentials (username + password, or token)
- Use Azure AD Graph API or Graph API with the sync account's permissions
- Highlight the extreme privilege level

**Complexity:** Medium. The sync account uses standard OAuth (ROPC flow with username/password).

---

### 10.5 Token Replay & Extraction Locations

**Common token harvest locations on compromised machines:**

| Location | Token Type | Tool |
|---|---|---|
| `~/.azure/msal_token_cache.json` | Azure CLI refresh token | File read |
| `~/.Azure/AzureRmContext.json` | Azure PowerShell tokens | File read |
| `%LOCALAPPDATA%\Microsoft\TokenBroker\Cache\` | WAM tokens (Windows) | DPAPI decrypt |
| `%LOCALAPPDATA%\Microsoft\Credentials\` | Windows credentials | DPAPI decrypt |
| Browser local storage / cookies | SSO cookies, PRT cookies | Browser dump |
| `%APPDATA%\Microsoft\Teams\Cookies` | Teams access tokens | File read |
| `%APPDATA%\Microsoft\Teams\Local Storage\` | Teams tokens | File read |
| Chrome/Edge cookies (login.microsoftonline.com) | Session cookies | Cookie dump |
| VS Code settings / keychain | Azure extension tokens | Keychain/file |
| `~/.config/gcloud/` (cross-cloud) | GCP tokens (for context) | File read |
| Environment variables | `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` | Process env |
| `.env` files in repos | Service principal creds | File read |
| Terraform state files | Azure credentials in state | File read |
| `~/.kube/config` | AKS cluster tokens | File read |
| Process memory | In-flight access tokens | Memory dump |

**Implementation for Ninken:**
- Add a "Smart Import" feature that accepts raw file contents from any of these locations
- Auto-detect the format and extract usable credentials
- Priority: Azure CLI cache, Azure PowerShell cache, Teams local storage, .env files,
  Terraform state

**Complexity:** Low-Medium per format. The detection logic in `detectCredential` /
`normalizeRaw` just needs new format handlers.

---

### 10.6 Device Code Flow Phishing

**What it is:** Attacker initiates a device code flow, sends the user code to the target
(via phishing email), and waits for them to authenticate. Once they do, the attacker
receives a refresh token.

**The flow:**
1. Attacker: `POST /{tenant}/oauth2/v2.0/devicecode` with desired scopes
2. Azure AD returns `device_code`, `user_code`, and `verification_uri`
3. Attacker sends the `user_code` and `verification_uri` to the target via phishing
4. Target enters the code at `https://microsoft.com/devicelogin` and authenticates
5. Attacker polls with `device_code` and receives `access_token` + `refresh_token`

**Red team value:** **HIGH** — This is a common initial access technique. The resulting
token is legitimate and carries the user's full permissions.

**Implementation for Ninken:**
- Ninken could include a device code flow initiator
- Generate the code, display it, and poll for completion
- Once authenticated, import the resulting refresh token as a new profile
- This crosses from "using stolen tokens" to "generating tokens" — consider the ethical
  and legal implications

**Complexity:** Low. Simple REST API calls. The polling loop is trivial.

**Caveats:**
- Device code flow is being restricted by many organizations
- Microsoft now shows the application name to the user during approval
- Some CA policies block the device code flow
- Leaves a clear audit trail (sign-in log shows device code grant type)

---

## 11. Implementation Priority Matrix

### Tier 1 — High Value, Low-Medium Effort (Implement Next)

| Feature | Value | Effort | Dependencies |
|---|---|---|---|
| **Resource Pivot Probing** | Critical | Low | None — just extend token refresh with different scopes |
| **FOCI Client ID Pivoting** | Critical | Low | None — iterate FOCI IDs on import |
| **SharePoint Sites/Lists** | High | Medium | Existing Graph helpers work directly |
| **Conditional Access Policies** | Critical | Low | `Policy.Read.All` scope, simple JSON display |
| **App Registrations & SPs** | Critical | Medium | Extend current M365 Audit module |
| **Authentication Methods** | Critical | Low | Extend Entra ID user detail view |
| **Identity Protection** | High | Low | Simple list/detail views |
| **Azure CLI Cache Import** | Critical | Low | New format in detectCredential |

### Tier 2 — High Value, Medium-High Effort

| Feature | Value | Effort | Dependencies |
|---|---|---|---|
| **ARM API Module** | Critical | High | New resource type, new UI module |
| **Key Vault Access** | Critical | Medium | ARM or direct vault scope |
| **Security API (Alerts)** | Critical | Medium | Complex data model |
| **PIM (Eligible Roles)** | Critical | Medium | Multiple related endpoints |
| **Intune Device Inventory** | High | Medium | Many endpoints, complex model |
| **Service Principal Creds** | Critical | Medium | New credential type, client_credentials flow |
| **Azure DevOps PATs** | Critical | Medium | New provider entirely |

### Tier 3 — Specialized / High Effort

| Feature | Value | Effort | Dependencies |
|---|---|---|---|
| **eDiscovery** | High | High | Async workflow, multi-step UI |
| **PRT Cookie Import** | Critical | High | Complex crypto, nonce management |
| **Certificate Auth** | High | Medium-High | JWT signing, certificate parsing |
| **Device Code Flow** | High | Low | Ethical/legal considerations |
| **Advanced Hunting (KQL)** | High | Medium | Need a query editor UI |
| **OBO Flow** | Medium | Medium | Niche use case |
| **Federated Credentials** | High | High | External IdP token exchange |

---

## 12. Architecture Recommendations

### 12.1 Multi-Resource Token Manager

The current `MicrosoftCredential` type stores a single refresh token targeting Graph.
To support resource pivoting, extend the architecture:

```
MicrosoftCredential (current)
  ├── refresh_token        (the master token)
  ├── client_id            (FOCI client ID)
  └── tenant_id

MicrosoftCredential (proposed)
  ├── refresh_token        (the master token)
  ├── client_id            (primary FOCI client ID)
  ├── tenant_id
  ├── foci_clients[]       (additional FOCI client IDs that work)
  └── accessible_resources (map of resource → boolean)
      ├── graph.microsoft.com       → true
      ├── management.azure.com      → true/false
      ├── vault.azure.net           → true/false
      ├── storage.azure.com         → true/false
      ├── dev.azure.com             → true/false
      └── ...
```

The in-memory token cache in `microsoft.ts` should be extended to cache tokens per
resource (not just one Graph token):

```typescript
// Current: credentialKey → { token, expiresAt }
// Proposed: credentialKey:resource → { token, expiresAt }
function resourceTokenKey(cred: MicrosoftCredential, resource: string): string {
  return `${cred.tenant_id}:${cred.client_id}:${cred.refresh_token.slice(0, 16)}:${resource}`
}
```

### 12.2 New Provider Types

Beyond extending the Microsoft provider, consider new top-level providers:

| Provider ID | Credential Type | Auth Mechanism |
|---|---|---|
| `microsoft` (existing) | Refresh token (delegated) | FOCI public client |
| `microsoft-sp` (new) | client_id + client_secret | Client credentials flow |
| `microsoft-cert` (new) | client_id + certificate | Client assertion flow |
| `microsoft-managed` (new) | Raw access token | No refresh (display-only) |
| `azure-devops` (new) | PAT | Basic auth header |
| `microsoft-prt` (new) | PRT cookie | Nonce exchange flow |

Alternatively, make these sub-types of the `microsoft` provider with a `credential_type`
discriminator.

### 12.3 Scope/Permission Discovery on Import

When a credential is imported, Ninken should automatically:

1. **Decode the access token JWT** — Extract `scp` (delegated) or `roles` (app-only),
   `aud` (audience/resource), `tid`, `oid`, `upn`, `amr`, `xms_cc` (CAE), `device_id`
2. **Try resource pivoting** — Refresh with different scopes to map accessible resources
3. **Try FOCI pivoting** — If the client_id is a known FOCI member, try other FOCI clients
4. **Probe Graph scopes** — Call key endpoints (`/me`, `/users`, `/security/alerts`, etc.)
   and record which succeed
5. **Display a capability matrix** — Show the operator exactly what this credential can do

This should happen asynchronously after import and populate the profile's metadata.

### 12.4 Token Lifetime & OPSEC Awareness

Add token intelligence to the UI:
- **Token expiry countdown** — When does the current access token expire?
- **Refresh token health** — When was it last used? Is it at risk of 90-day inactivity expiry?
- **CAE status** — Is this a CAE-capable token? What events could revoke it?
- **Risk detection monitor** — If we have `IdentityRiskEvent.Read.All`, show our own risk status
- **Scope warnings** — Highlight dangerous scopes (Application.ReadWrite.All, etc.)
- **Last API call timestamp** — Rate limiting awareness for OPSEC

### 12.5 Credential Format Auto-Detection Priority

Extend `detectCredential` and `normalizeRaw` in the Microsoft provider to handle:

1. Current: Direct refresh_token JSON (Ninken format)
2. Current: Richter/camelCase format (ROADtoken output)
3. **New:** Azure CLI MSAL cache (`msal_token_cache.json`)
4. **New:** Azure PowerShell context (`AzureRmContext.json`)
5. **New:** Service principal with secret (`{ client_id, client_secret, tenant_id }`)
6. **New:** Raw access token (JWT string, no wrapping JSON)
7. **New:** PRT cookie (Base64 blob)
8. **New:** Terraform state file (extract azurerm provider credentials)
9. **New:** .env file format (`AZURE_CLIENT_ID=...`)
10. **New:** kubeconfig with Azure auth provider

---

## Appendix A: Complete Microsoft Resource Audience URIs

| Resource | Audience URI | Purpose |
|---|---|---|
| Microsoft Graph | `https://graph.microsoft.com` | Primary M365 API |
| Azure Resource Manager | `https://management.azure.com` | Azure infrastructure |
| Azure Key Vault | `https://vault.azure.net` | Secrets, certs, keys |
| Azure Storage | `https://storage.azure.com` | Blobs, files, queues, tables |
| Azure SQL Database | `https://database.windows.net` | SQL database access |
| Azure MySQL/PostgreSQL | `https://ossrdbms-aad.database.windows.net` | OSS database access |
| Azure Data Lake | `https://datalake.azure.net` | Data Lake Storage Gen1 |
| Azure Service Bus | `https://servicebus.azure.net` | Messaging |
| Azure Event Hubs | `https://eventhubs.azure.net` | Event streaming |
| Power BI | `https://analysis.windows.net/powerbi/api` | BI reports and data |
| Log Analytics | `https://api.loganalytics.io` | Query log data |
| Azure DevOps | `https://app.vssps.visualstudio.com` | DevOps APIs |
| Office Management | `https://manage.office.com` | Activity, DLP, service health |
| Outlook (direct) | `https://outlook.office365.com` | Outlook REST API (legacy) |
| SharePoint (direct) | `https://{tenant}.sharepoint.com` | SharePoint REST API |
| Azure AD Graph (legacy) | `https://graph.windows.net` | Legacy directory API |
| Azure Cosmos DB | `https://cosmos.azure.com` | NoSQL database |
| Azure Synapse | `https://dev.azuresynapse.net` | Analytics |
| Azure Purview | `https://purview.azure.net` | Data governance |
| Azure Digital Twins | `https://digitaltwins.azure.net` | IoT modeling |
| Microsoft Teams | `https://api.spaces.skype.com` | Teams backend API |
| Power Apps | `https://service.powerapps.com` | Power Apps API |
| Power Automate | `https://service.flow.microsoft.com` | Flow/Logic Apps |
| Dynamics 365 | `https://{org}.crm.dynamics.com` | CRM API |
| Intune | `https://api.manage.microsoft.com` | Direct Intune API |
| Windows Notification | `https://wns.windows.com` | Push notifications |
| Microsoft Information Protection | `https://aadrm.com` | RMS/AIP |
| Azure Communication Services | `https://communication.azure.com` | Comms API |

## Appendix B: FOCI-Aware Token Refresh Implementation Sketch

```
For each FOCI client_id in KNOWN_FOCI_CLIENTS:
  For each resource_scope in KNOWN_RESOURCE_SCOPES:
    try:
      POST /{tenant_id}/oauth2/v2.0/token
        grant_type=refresh_token
        refresh_token={stolen_rt}
        client_id={foci_client_id}
        scope={resource_scope} offline_access

      if success:
        record: foci_client_id + resource_scope = access_token
        decode access_token JWT for actual granted scopes
    catch:
      record: foci_client_id + resource_scope = denied (note error reason)

Display results as a matrix:
              | Graph | ARM | KeyVault | Storage | DevOps | PowerBI | ...
Teams ID      |  OK   | OK  |   OK     |   OK    | DENIED | DENIED  |
Azure CLI ID  |  OK   | OK  |   OK     |   OK    |   OK   |   OK    |
Office ID     |  OK   | --  |   --     |   --    | DENIED | DENIED  |
```

## Appendix C: Token Claim Cheat Sheet

**Delegated (user) access token claims:**
- `aud` — Resource URI (audience)
- `iss` — `https://sts.windows.net/{tenant_id}/`
- `sub` — User's subject (opaque, app-specific)
- `oid` — User's object ID in Azure AD
- `tid` — Tenant ID
- `upn` — User Principal Name (email-like)
- `scp` — Space-separated delegated scopes
- `amr` — Authentication methods (`pwd`, `mfa`, `ngcmfa`, `rsa`, `wia`)
- `device_id` — Device ID (if device-bound)
- `xms_cc` — Client capabilities (`cp1` = CAE capable)
- `acrs` — Authentication context class references
- `idtyp` — `user` for delegated tokens

**App-only (service principal) access token claims:**
- `aud` — Resource URI
- `iss` — Same as above
- `sub` — Service principal's object ID
- `oid` — Service principal's object ID
- `tid` — Tenant ID
- `roles` — Application permissions (array)
- `idtyp` — `app` for app-only tokens
- No `upn`, no `scp`, no `amr`

**PRT-derived token additional claims:**
- `deviceid` — Device ID
- `auth_time` — When the user last authenticated
- `amr` includes `ngcmfa` for NGC (Windows Hello) MFA
- Device compliance claims propagated from PRT

---

*This document serves as a research foundation for expanding Ninken's Microsoft token
support. Implementation should follow the priority matrix in Section 11, starting with
low-effort, high-value features (resource pivoting, FOCI enumeration, CA policy reading)
before tackling the larger modules (ARM, Key Vault, Azure DevOps).*
