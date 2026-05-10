# Running PlanCatalyst Locally

This guide covers the quickest way to run the Python pipeline and the React dashboard on your machine.

## 1) Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ and npm
- A local `.env` file in the repository root

## 2) Python Setup (Pipeline)

From the repository root:

```zsh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3) Environment Variables

Create or update:

- `.env` (at repository root)

Required values for Azure upload/publish:

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_STORAGE_ACCOUNT_URL=https://<your-storage-account>.blob.core.windows.net
```

If you are only doing a local dry run, you can disable upload in `src/config/settings.yaml`:

- `runtime.upload_azure: false`

## 4) Run the Full Pipeline

From the repository root:

```zsh
source .venv/bin/activate
python3 -m src.pipeline.run_pipeline
```

Main stage outputs are written to:

- `data/clean/`
- `data/interim/validated/`
- `data/organized/`

## 5) Frontend (Optional)

In a new terminal:

```zsh
cd dashboard
npm install
npm run dev
```

By default, the frontend reads contract files from local `/v1` unless `VITE_CONTRACT_BASE_URL` is set in `dashboard/.env`.

## 6) Useful Notes

- `runtime.fetch_raw: false` in `src/config/settings.yaml` means the pipeline uses existing raw files.
- Set `runtime.fetch_raw: true` if you want to fetch fresh upstream data.
- Keep secrets only in local `.env` files; do not commit them.
