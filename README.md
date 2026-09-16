# PlanCatalyst Data Dashboard

## What This Project Is

This is an interactive dasbhoard that visualizes country-level development.
It helps PlanCatalyst teams and stakeholders identify where need is highest and where investments can
have the most practical impact.

This repository contains the full data platform behind that dashboard:

- ingestion from external data sources
- cleaning and transformation logic
- scoring and aggregation across the 7-pillar model
- automated cloud publishing for the dashboard experience

Organizations often have fragmented datasets across health, agriculture, climate,
infrastructure, and socio-economic indicators. This project turns that fragmented
data into one reliable, comparable, country-level view that can be explored by
non-technical users in the dashboard.

## What We Built

- **A repeatable data pipeline** that fetches, cleans, and scores indicator data
  from multiple global sources.
- **A cloud publishing workflow** on Azure that pushes processed outputs for the
  dashboard to consume.
- **A frontend-ready data layer** that allows the React dashboard (embedded in
  Wix) to load consistent, versioned data snapshots.
- **An operational model** with validation and guardrails so bad runs do not
  overwrite known-good outputs.

## Architecture Overview

The current production flow is: validated pipeline run → versioned Blob
payloads → Azure Static Web Apps dashboard → Wix iframe. GitHub Actions gates
backend, frontend, container, dependency, and CodeQL checks. Dashboard
deployment is manually dispatched and environment-gated; a twice-yearly Azure
data-refresh job is a planned follow-up, not a currently running service.

![Azure architecture for PlanCatalyst pipeline](./Azure-Arch.png)

## Data Flow

At a high level, the pipeline fetches configured upstream data, cleans and
scores it, validates the contract, and publishes payloads atomically. The
semi-annual refresh is currently initiated from the documented runbook.

![Pipeline data flow from trigger to publish](./Data-Flow.png)

## Platform and Stack

- **Cloud:** Azure Blob Storage, Azure Static Web Apps, Azure Container
  Registry (container path retained for scheduled refresh work)
- **Backend:** Python data pipeline
- **Frontend:** React dashboard embedded in Wix
- **Data sources:** UN SDG, World Bank, ND-GAIN, UNDP Human Development Reports (HDI/GII/MPI), World Bank Worldwide Governance Indicators (WGI), and additional indexed sources

## Team

- **Thomas Llamzon** — PM · full-stack integration · frontend presentability
- **Anthony Lam** — Co-PM · Azure hosting · indicators · cleaning · publish · automation

See `TASKS.md` for the current plan.

## Documentation

- `HANDOFF.md` - project context and implementation history
- `TASKS.md` - remaining work and ownership
- `docs/PRINCIPLES.md` - project mission and operating constraints
- `docs/data-contract.md` - technical backend/frontend payload specification
- `indicators/indicators.yaml` - indicator taxonomy and metadata
- `indicators/SCORING_AUDIT.md` - scoring-direction audit and current gaps

