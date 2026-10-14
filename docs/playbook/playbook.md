# PlanCatalyst Dashboard: Six-Month Data Refresh

*How the dashboard gets its numbers, and how to refresh them yourself from the Azure portal.*

Version draft 1, 2026-10-14. Owner: Thomas Llamzon.

---

## 1. The system on one page

[Diagram: four boxes left to right. "Public data sources" (UN SDG, World Bank, UNDP, ND-GAIN) feed "The pipeline job" (runs in Azure), which writes "Three data files" into Azure Blob Storage, which the "Dashboard on plancatalyst.org" reads every time someone opens it.]

The dashboard does not store numbers of its own. Every time a visitor opens it, it reads three files from Azure Blob Storage. The pipeline job is the only thing that writes those files. Running the job is the refresh.

Four sources feed the job. Three of them (UN SDG, World Bank, UNDP) are fetched automatically over the internet. One, the ND-GAIN climate index, is published by the University of Notre Dame as a ZIP file and has to be downloaded and uploaded by a person. That upload is the only manual input in the whole refresh.

## 2. What changes every six months, and what does not

| Changes | Does not change |
|---------|-----------------|
| The ND-GAIN ZIP you upload | The dashboard itself (no code, no deploy) |
| The numbers in the three data files | The web address of the dashboard |
| The "Generated" date shown at the bottom of a country panel | The Wix page that embeds it |

If a refresh is skipped, the dashboard keeps showing the previous numbers. Nothing breaks; it just goes stale.

## 3. Before you start

**Access.** You need to be able to open the Azure portal and see the resource group named `tsi-data-dashboard`. If you can open it but cannot press "Run now" on the job, ask IT for the Contributor role on that resource group.

**Nothing to renew.** The job signs in with its own Azure identity. There is no password or key that expires.

**Check the current snapshot.** Open the dashboard, click any country, and read the "Generated" date at the bottom of the panel. Write it down; you will compare against it in step 4.6.

**Time.** Forty-five to ninety minutes, almost all of it waiting while the job runs. Start it and come back.

## 4. The refresh, step by step

### 4.1 Download the ND-GAIN ZIP

Go to the ND-GAIN Country Index website and download the latest "country index" data ZIP. Do not unzip it. Note the year in the file name.

### 4.2 Upload the ZIP to Azure

1. In the Azure portal, search for `tsidashboardblobstorage` and open it. `[Screenshot 02]`
2. In the left menu choose **Containers**, then open **pipeline-sources**. `[Screenshot 03]`
3. Open the folder **sources**, then **ndgain**.
4. Press **Upload**, choose the ZIP from step 4.1, and press **Upload**. `[Screenshot 04]`

The job always uses the newest ZIP in this folder. Old ones can stay; they are ignored.

### 4.3 Start the job

1. Search for `tsi-pipeline-refresh` and open it. `[Screenshot 05]`
2. Press **Run now** at the top, then **Run** to confirm. `[Screenshot 06]`

### 4.4 Watch it run

In the left menu choose **Execution history**. A new row appears with status Running. `[Screenshot 07]` Click the row, then **Console logs** or **Log stream**, to watch progress. The log is long; you only need its last line.

### 4.5 Read the last line

When the run finishes, the last line of the log is one of two things:

- `PIPELINE RUN COMPLETE: published v1 snapshot 20270415T101522Z, 193 countries` `[Screenshot 08]`
  The refresh worked. Go to step 4.6.
- `PIPELINE RUN FAILED: ...` `[Screenshot 09]`
  The refresh did not publish. The dashboard still shows the previous numbers. Go to section 5.

A line near the top that starts `ND-GAIN source:` names the ZIP the job used. Check that it is the one you uploaded.

### 4.6 Spot-check the dashboard

Open the dashboard in a private browser window so nothing is cached. Click three countries you know (for example Brazil, Kenya, Bangladesh). `[Screenshot 10]` Confirm:

- The "Generated" date at the bottom of the panel is today.
- The climate pillar shows a value, not a dash.
- Nothing looks obviously wrong (every pillar at 0, every pillar at 100).

If all three pass, the refresh is done.

## 5. When it fails

The last log line tells you which part failed. The three most likely:

| Last line starts with | What it means | What to do |
|-----------------------|---------------|------------|
| `PIPELINE RUN FAILED: nd-gain source` | The job could not find or open the ZIP you uploaded | Check the file is a `.zip`, is in `sources/ndgain`, and is not empty. Re-upload and run again. |
| `PIPELINE RUN FAILED: fetch` | One of the public data sources did not answer | Usually temporary. Wait an hour and run again. If it fails twice, contact Thomas. |
| `PIPELINE RUN FAILED: publish` | The numbers were produced but failed the safety check before upload | Do not retry. Contact Thomas with the run date. The dashboard is unaffected. |

Anything else: send Thomas the full last line and the run date.

In every failure case the dashboard keeps showing the previous numbers. A failed run never half-publishes.

You will also receive an email when a run fails, so you do not have to watch the log.

## 6. Rolling back

Publishing replaces the three data files in place. If a refresh completed but the numbers look wrong, the previous files can be put back:

1. Before any refresh, Thomas keeps a dated copy of the three files. Ask for the copy from the previous refresh.
2. Open `tsidashboardblobstorage`, **Containers**, **dashboard-public**, folder **v1**.
3. Upload `countries.json` and `timeseries.json` first, ticking **Overwrite if files already exist**.
4. Upload `meta.json` last. `[Screenshot 11]` The dashboard reads it on the next page load.

The order matters: `meta.json` is the file that tells the dashboard a snapshot is ready.

## 7. Glossary

- **Pillar.** One of the seven themes on the dashboard (Healthcare, Agriculture, and so on). Each pillar score is an average of its indicators.
- **Indicator.** A single measured series from a source, such as under-five mortality. There are 28.
- **Snapshot.** One complete set of the three data files, stamped with a run id and a generated date.
- **Need band.** The label next to a score: low, moderate, high or severe need. Higher scores mean lower need.
- **Benchmark.** The PlanCatalyst reference value each indicator is compared against. A country already better than the benchmark shows the top score for that indicator.
- **Run id.** The timestamp in the completion line, for example `20270415T101522Z`. Quote it when asking for help.

## 8. Contacts and ownership

| What | Who |
|------|-----|
| Azure subscription, resource group `tsi-data-dashboard`, storage account | PlanCatalyst (IT) |
| Pipeline code, dashboard code, this document | Thomas Llamzon (Gmail) |
| Scoring decisions and sign-off | Reyna, PlanCatalyst |
| Failure alert email | `[client-owned address, set when the job is created]` |
