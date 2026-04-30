# Raw Source Staging

This directory holds source-native pulls before cleaning/normalization.

## Source folders

- `unsdg/` - UN SDG API payloads and snapshots (`un_sdg_raw.json`)
- `world-bank/` - World Bank API payloads and snapshots (`world_bank_raw.json`)
- `nd-gain/` - ND-GAIN index downloads and extracted source payloads (`nd_gain_raw.json`)
- `undp-hdr/` - UNDP Human Development Reports data (GII, MPI inputs)
- `owid-state-capacity/` - State capacity source files (OWID-linked path)
- `world-bank-imf-concessionality/` - inputs used to build concessionality index

Current fetch stage writes source payloads by source folder. Additional source
folders are intentionally scaffolded for implementation growth.
