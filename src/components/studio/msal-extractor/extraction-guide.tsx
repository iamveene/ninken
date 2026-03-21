import { SnippetCard } from "./snippet-card"

const MSAL_SNIPPET = `// Extracts all MSAL tokens from browser localStorage
(() => {
  const cache = {};
  const keys = Object.keys(localStorage).filter(k => k.startsWith('msal.'));
  keys.forEach(k => { cache[k] = localStorage.getItem(k); });

  // Find refresh tokens
  const rtKeys = Object.keys(localStorage).filter(k =>
    k.includes('refreshtoken') || k.includes('RefreshToken')
  );

  // Find access tokens
  const atKeys = Object.keys(localStorage).filter(k =>
    k.includes('accesstoken') || k.includes('AccessToken')
  );

  // Find account info
  const accountKeys = Object.keys(localStorage).filter(k =>
    k.includes('account') && k.startsWith('msal.')
  );

  // Build extraction result
  const result = {
    refreshTokens: {},
    accessTokens: {},
    accounts: {},
    raw: cache
  };

  rtKeys.forEach(k => {
    try { result.refreshTokens[k] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
  });
  atKeys.forEach(k => {
    try { result.accessTokens[k] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
  });
  accountKeys.forEach(k => {
    try { result.accounts[k] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
  });

  // Format for Ninken import
  const rts = Object.values(result.refreshTokens);
  const ats = Object.values(result.accessTokens);
  const accts = Object.values(result.accounts);

  if (rts.length === 0) {
    console.error('No MSAL refresh tokens found in localStorage');
    return;
  }

  const rt = rts[0];
  const primaryAt = ats.find(a => a.realm && a.target);
  const acct = accts[0];

  const ninkenCredential = {
    provider: 'microsoft',
    credentialKind: 'spa',
    refresh_token: rt.secret,
    client_id: rt.client_id || rt.clientId,
    tenant_id: rt.realm || rt.environment,
    access_token: primaryAt?.secret,
    expires_at: primaryAt?.expires_on ? parseInt(primaryAt.expires_on) : undefined,
    scope: primaryAt?.target?.split(' '),
    account: acct?.username,
    token_uri: \`https://login.microsoftonline.com/\${rt.realm || rt.environment}/oauth2/v2.0/token\`,
    resource_tokens: {}
  };

  // Build resource_tokens map
  ats.forEach(at => {
    if (at.secret && at.realm) {
      const resource = at.resource || at.realm;
      ninkenCredential.resource_tokens[resource] = {
        access_token: at.secret,
        expires_at: parseInt(at.expires_on || '0'),
        scope: (at.target || '').split(' ')
      };
    }
  });

  console.log('Ninken MSAL Extraction Result:');
  console.log(JSON.stringify(ninkenCredential, null, 2));
  copy(JSON.stringify(ninkenCredential, null, 2));
  console.log('Copied to clipboard!');
})();`

interface ExtractionGuideProps {
  variant: "owa" | "teams"
}

const STEPS: Record<"owa" | "teams", { prereqs: string[]; steps: string[] }> = {
  owa: {
    prereqs: [
      "You must be logged into Outlook Web App (outlook.office.com) in your browser",
      "The session must be active (not expired or locked)",
      "Works best in Chrome or Edge (Firefox may restrict clipboard access)",
    ],
    steps: [
      "Open Outlook Web App at outlook.office.com and ensure you are logged in",
      "Open DevTools with F12 or Ctrl+Shift+I (Cmd+Option+I on macOS)",
      "Switch to the Console tab in DevTools",
      "Copy the extraction snippet below and paste it into the console",
      "Press Enter to execute -- the extracted credential JSON will be copied to your clipboard",
      "Paste the JSON into the Import panel below and click \"Import to Ninken\"",
    ],
  },
  teams: {
    prereqs: [
      "You must be logged into Microsoft Teams Web (teams.microsoft.com) in your browser",
      "The session must be active (not expired or locked)",
      "Teams Web has the broadest scope set -- this is the recommended extraction target",
    ],
    steps: [
      "Open Microsoft Teams Web at teams.microsoft.com and ensure you are logged in",
      "Open DevTools with F12 or Ctrl+Shift+I (Cmd+Option+I on macOS)",
      "Switch to the Console tab in DevTools",
      "Copy the extraction snippet below and paste it into the console",
      "Press Enter to execute -- the extracted credential JSON will be copied to your clipboard",
      "Paste the JSON into the Import panel below and click \"Import to Ninken\"",
    ],
  },
}

export function ExtractionGuide({ variant }: ExtractionGuideProps) {
  const config = STEPS[variant]
  const label = variant === "owa" ? "OWA (Outlook Web)" : "Teams Web"

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Prerequisites
        </h3>
        <ul className="space-y-1.5">
          {config.prereqs.map((prereq, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
              <span className="text-muted-foreground">{prereq}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Steps for {label}
        </h3>
        <ol className="space-y-1.5">
          {config.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="font-mono text-muted-foreground shrink-0 w-4 text-right">
                {i + 1}.
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <SnippetCard
        title="MSAL Extraction Snippet"
        description={`Paste this into the ${label} browser console to extract MSAL tokens`}
        code={MSAL_SNIPPET}
      />
    </div>
  )
}
