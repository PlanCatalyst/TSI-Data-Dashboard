# Six-month refresh playbook

Audience: PlanCatalyst staff, no engineering background (requirements v2,
section 4). The deliverable is a Word document; `playbook.md` is its source
text and `screenshots/` holds one PNG per numbered step so they can be
retaken without rewriting.

Status: **draft text complete, screenshots pending.** Screenshots can only be
taken once the Container Apps Job exists (`infra/container-apps-job.sh`).

## Screenshot list

| File | Shows |
|------|-------|
| `01-portal-home.png` | Azure portal home with the search box |
| `02-storage-account.png` | `tsidashboardblobstorage` overview |
| `03-containers.png` | Containers list with `pipeline-sources` selected |
| `04-upload-zip.png` | Upload dialog with the ND-GAIN ZIP chosen, folder `sources/ndgain` |
| `05-job-overview.png` | Container Apps Job `tsi-pipeline-refresh` overview with Run now |
| `06-run-now.png` | Run now confirmation |
| `07-execution-history.png` | Execution history with a running row |
| `08-logs-complete.png` | Log stream ending in `PIPELINE RUN COMPLETE` |
| `09-logs-failed.png` | Log stream ending in `PIPELINE RUN FAILED` |
| `10-dashboard-check.png` | Dashboard map with a country panel open, generated date visible |
| `11-rollback-upload.png` | Uploading saved `meta.json` to `dashboard-public/v1` |

## Producing the Word document

Convert `playbook.md` with the screenshots inlined, then save as
`docs/playbook/playbook.docx`. Keep both files in the repo (AC4.1). Rule for
every edit: no command-line instruction anywhere in the document (AC4.3).
