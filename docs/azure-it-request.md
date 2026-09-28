# Azure storage request for PlanCatalyst IT

Written 2026-09-24 in response to IT's reply that no `dashboard-public`
container exists in the storage account. It does not exist in the account they
looked at. This document states which account the dashboard actually reads,
what has to be created, and what to do if IT will not allow anonymous read.

Related: `docs/runbook-refresh.md` (publish procedure),
`src/upload/publish_dashboard.py` (the publisher and its env vars).

## The mismatch

IT's screenshot shows storage account **`tsidatadashboard98a4`** with two
containers, `app-package-tsi-function-78a9cef` and `azure-webjobs-hosts`. Both
are Azure Functions runtime infrastructure. Neither has anything to do with the
dashboard.

The deployed dashboard reads a **different storage account**:

```
https://tsidashboardblobstorage.blob.core.windows.net/dashboard-public/v1/
```

That endpoint is live and anonymous-readable right now. Verified 2026-09-24:

```
$ curl -s https://tsidashboardblobstorage.blob.core.windows.net/dashboard-public/v1/meta.json
{"schemaVersion":"1.0.0","generatedAt":"2026-07-01T17:43:05...","pipelineRunId":"fresh-20260701",...}
```

The same URL is compiled into the frontend at build time in two places:

- `.github/workflows/deploy-dashboard.yml:73` (`VITE_CONTRACT_BASE_URL`)
- `dashboard/public/staticwebapp.config.json:7` (CSP `connect-src`)

So `tsidashboardblobstorage` is the account that matters. IT was looking in the
right subscription at the wrong account, or `tsidashboardblobstorage` is not in
PlanCatalyst's subscription at all. That distinction decides everything below.

## Second finding: the other account blocks anonymous read at the account level

A probe of `tsidatadashboard98a4` returns:

```
HTTP/1.1 409 Public access is not permitted on this storage account.
<Error><Code>PublicAccessNotPermitted</Code></Error>
```

That is `allowBlobPublicAccess = false` on the storage account. It is a
**tenant policy or account setting, not a container setting**. Creating a
`dashboard-public` container there and setting its access level to Blob will
still fail until the account-level flag is flipped. Worth knowing before IT
does the work twice.

This is a reasonable default for them to have set, and it may be enforced by an
Azure Policy assignment they cannot override per-account. If so, use the
fallback in the last section rather than asking them to weaken a tenant control.

## Step 1: have IT answer one question first

> Does the storage account `tsidashboardblobstorage` exist in PlanCatalyst's
> Azure subscription? If yes, which resource group and subscription?

### Case A: `tsidashboardblobstorage` is PlanCatalyst's

Nothing moves. The container already exists and already serves the dashboard.
IT only issues credentials so the pipeline can write a refresh to it. Skip to
step 2, pointing every instruction at `tsidashboardblobstorage`.

### Case B: it is not PlanCatalyst's (it is on a personal subscription)

Then it has to migrate before handoff, and that is a larger change than a role
assignment. IT creates the container on an account they own, we copy the three
payload files across, and the frontend is **rebuilt and redeployed** because the
Blob URL is baked in at build time. Sequence:

1. IT creates the container and the service principal on their account
   (step 2 below), using their account name in place of
   `tsidashboardblobstorage`.
2. We republish `meta.json`, `countries.json`, `timeseries.json` to the new
   account.
3. We update `VITE_CONTRACT_BASE_URL` and the CSP `connect-src` origin, then
   redeploy the Static Web App.
4. The old account is decommissioned only after the new one serves traffic.

Note that `tsidatadashboard98a4` is a Functions storage account. Mixing public
dashboard payloads into it is not ideal. A dedicated storage account for the
dashboard is cleaner, and this is the right moment to ask for one.

## Step 2: the actual asks for IT

Substitute the correct account name per the case above.

1. **Create a container** named exactly `dashboard-public` in that storage
   account.
2. **Set its anonymous access level to `Blob`.** Not `Container`. `Blob` allows
   reading a file by its exact name; `Container` additionally allows listing
   every file in it. The dashboard only ever fetches three known filenames, so
   `Blob` is the least-privilege setting that works.
   - If the portal greys this out, the account-level `allowBlobPublicAccess`
     flag is off. It has to be enabled on the storage account for the setting
     to be selectable.
3. **Create one app registration** (service principal) for the data pipeline.
4. **Assign it `Storage Blob Data Contributor` scoped to the `dashboard-public`
   container only.** Not the storage account, not the resource group, not the
   subscription. No Owner or Contributor grant to anyone, including us.
5. **Return four values**, with the secret sent through something other than
   email (Teams message, password manager share, or a phone call):
   - Directory (tenant) ID
   - Application (client) ID
   - Client secret value
   - The storage account URL, `https://<account>.blob.core.windows.net`

These map one to one onto `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
`AZURE_CLIENT_SECRET`, and `AZURE_STORAGE_ACCOUNT_URL` in
`src/upload/publish_dashboard.py`.

## Why anonymous read is needed at all

The dashboard is a static React bundle running in a visitor's browser inside an
iframe on `plancatalyst.org`. It fetches the three JSON payloads directly. A
browser cannot hold a credential, so any key shipped to it would be public
anyway, just with extra steps. Anonymous read on three non-sensitive public
development statistics files is the honest version of that.

The data is all derived from public sources (UN SDG, World Bank, ND-GAIN,
UNDP HDR). There is no PII and nothing confidential in the payloads.

## Fallback if IT will not enable anonymous read

If the tenant blocks public blob access as policy, do not fight it. Serve the
payloads from the Static Web App instead:

- Commit the three JSON files into `dashboard/public/v1/` and let the SWA serve
  them from its own origin, same-origin to the app.
- The refresh then becomes "regenerate the JSON, commit, redeploy" rather than
  "upload to blob".

The only thing lost is the ability to refresh data without rebuilding the
frontend. At the confirmed **6-month refresh cadence** that costs almost
nothing, and it removes the public storage account from the architecture
entirely. If IT pushes back at all, this is the better answer, not a
concession.

Under this fallback IT issues no credentials, no container, and no service
principal. The Azure ask collapses to nothing.
