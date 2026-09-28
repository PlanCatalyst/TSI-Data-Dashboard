from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
import json, requests, pandas as pd

from tenacity import retry, stop_after_attempt, wait_exponential
from src.pipeline.utils import setup_logger, ensure_dir
from src.pipeline.terminal_output import TerminalOutput

from .base_fetch import DataFetcher


def sdmx_obs_to_record(obs: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize one IDS SDMX observation to the WDI country/indicator record shape."""
    by_concept = {
        (item.get("concept") or ""): item for item in (obs.get("variable") or [])
    }
    country = by_concept.get("Country") or {}
    series = by_concept.get("Series") or {}
    time = by_concept.get("Time") or {}
    return {
        "countryiso3code": country.get("id"),
        "country": {"id": country.get("id"), "value": country.get("value")},
        "indicator": {"id": series.get("id"), "value": series.get("value")},
        "date": time.get("value"),
        "value": obs.get("value"),
    }


def _year_in_range(date_value: Any, start: int, end: int) -> bool:
    try:
        year = int(str(date_value)[:4])
    except (TypeError, ValueError):
        return False
    return start <= year <= end


"""
World Bank API data fetching client
"""
class WorldBankFetcher(DataFetcher):
    
    def __init__(self, base: str, credentials: Optional[dict] = None, **kwargs):
                
        super().__init__(base, credentials, **kwargs)        
        
        self.per_page = 1000                    # Records per page (pagination)
        self.session = requests.Session()       # Reusable HTTP session (faster)
        self.log = setup_logger()               # Logger for progress messages

    def save_raw_data(self, records: List[Dict[str, Any]], out_dir: Path, filename: str) -> None:
        # Saves the unmodified API response to JSON (raw data).

        ensure_dir(out_dir)
        (out_dir / filename).write_text(json.dumps(records, indent=2), encoding="utf-8")

    
    def fetch_indicator_data(
        self,
        indicator: str,
        countries: Iterable[str],
        start: int,
        end: int,
        *,
        source: Optional[int] = None,
        counterpart_area: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetches all data for a given indicator and list of countries over a year range.

        WDI series use `/country/{codes}/indicator/{id}`. IDS series that WDI has
        archived (e.g. DT.DOD.ALLC.ZS) must go through
        `/sources/{id}/country/{codes}/counterpart-area/{area}/series/{id}`
        and are year-filtered client-side because `date=` is ignored there.
        """

        country_str = ";".join(countries)
        if source:
            return self._fetch_ids_series(
                indicator,
                country_str,
                start,
                end,
                source=int(source),
                counterpart_area=counterpart_area or "WLD",
            )
        return self._fetch_wdi_series(indicator, country_str, start, end)

    def _fetch_wdi_series(
        self, indicator: str, country_str: str, start: int, end: int
    ) -> List[Dict[str, Any]]:
        page, out = 1, []
        while True:
            url = f"{self.base}/country/{country_str}/indicator/{indicator}"
            params = {
                "date": f"{start}:{end}",
                "format": "json",
                "per_page": self.per_page,
                "page": page,
            }
            payload = self.fetch(url, parameters=params).json()
            if not isinstance(payload, list) or len(payload) < 2:
                break
            meta, data = payload[0], payload[1]
            out.extend(data if isinstance(data, list) else [])
            TerminalOutput.print_progress(page, meta.get("pages", 1), prefix=f"  {indicator}: ")
            if page >= meta.get("pages", 1):
                break
            page += 1
        return out

    def _fetch_ids_series(
        self,
        indicator: str,
        country_str: str,
        start: int,
        end: int,
        *,
        source: int,
        counterpart_area: str,
    ) -> List[Dict[str, Any]]:
        page, out = 1, []
        url = (
            f"{self.base}/sources/{source}/country/{country_str}"
            f"/counterpart-area/{counterpart_area}/series/{indicator}"
        )
        while True:
            params = {"format": "json", "per_page": self.per_page, "page": page}
            payload = self.fetch(url, parameters=params).json()
            if not isinstance(payload, dict):
                break
            observations = ((payload.get("source") or {}).get("data")) or []
            for obs in observations:
                rec = sdmx_obs_to_record(obs)
                if _year_in_range(rec.get("date"), start, end):
                    out.append(rec)
            pages = int(payload.get("pages") or 1)
            TerminalOutput.print_progress(page, pages, prefix=f"  {indicator} (IDS {source}): ")
            if page >= pages:
                break
            page += 1
        return out
    

    def fetch_country_metadata(self) -> List[Dict[str, Any]]:
        """
        Fetch the World Bank country reference list in a single request.

        Returns one record per entry in ``/v2/country``, including ``lendingType``
        (IBD / IDB / IDX / LNX), ``incomeLevel`` and ``region``. Aggregates such as
        "Sub-Saharan Africa" are returned too and carry ``region.id == "NA"``;
        filtering them out is the cleaner's job, not the fetcher's.

        The full list is ~295 entries, so ``per_page=400`` retrieves it in one
        page. Do not loop this endpoint per iso3.
        """
        url = f"{self.base}/country"
        params = {"format": "json", "per_page": 400}
        payload = self.fetch(url, parameters=params).json()
        if not isinstance(payload, list) or len(payload) < 2:
            raise ValueError(
                f"Unexpected /country payload shape from {url}: "
                f"{type(payload).__name__}"
            )
        records = payload[1]
        if not isinstance(records, list):
            raise ValueError(f"/country returned no record list from {url}")
        self.log.info(f"Fetched {len(records)} World Bank country metadata records")
        return records


    """ ################################################################## 
    ### CLIENT-SPECIFIC METHODS ###
    ################################################################## """
        
    @retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=0.5, max=8))
    def fetch(self, base: str, parameters: Dict[str, Any]):   
        """
        Fetches data from a World Bank API with retry logic.
        
        Returns:
            r: Response object from the requests library
        """

        r = self.session.get(base, params=parameters, timeout=60)
        r.raise_for_status()  # Raise error if response failed
        return r