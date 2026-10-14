"""One place that decides how the pipeline authenticates to Azure Storage.

Two callers exist today (validated CSV upload and the dashboard publish) and
they used to each require the full service principal triple. The Container
Apps Job runs under a managed identity with no secret (requirements v2,
REQ3.2), so the rule is now:

  * AZURE_STORAGE_ACCOUNT_URL set and the SP triple set  -> ClientSecretCredential
  * AZURE_STORAGE_ACCOUNT_URL set, no SP triple          -> DefaultAzureCredential
                                                            (managed identity in Azure,
                                                            az login locally)
  * no AZURE_STORAGE_ACCOUNT_URL                          -> Azure disabled, dry run

Secrets are read from the environment only and never logged.
"""
from __future__ import annotations

import os

from azure.identity import ClientSecretCredential, DefaultAzureCredential

_SP_KEYS = ("AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET")


def account_url() -> str | None:
    return os.getenv("AZURE_STORAGE_ACCOUNT_URL") or None


def azure_configured() -> bool:
    return account_url() is not None


def _service_principal_present() -> bool:
    return all(os.getenv(k) for k in _SP_KEYS)


def credential_kind() -> str:
    """Human label for the run log. Never includes a secret value."""
    if not azure_configured():
        return "none (dry run)"
    return "service principal" if _service_principal_present() else "managed identity or default chain"


def blob_credential():
    if _service_principal_present():
        return ClientSecretCredential(
            tenant_id=os.environ["AZURE_TENANT_ID"],
            client_id=os.environ["AZURE_CLIENT_ID"],
            client_secret=os.environ["AZURE_CLIENT_SECRET"],
        )
    return DefaultAzureCredential(exclude_interactive_browser_credential=True)
