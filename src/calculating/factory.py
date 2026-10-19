from src.calculating.scorers import (
    SimpleDirectionalScorer, RatioThresholdScorer,
    InverseRatioScorer, RatioGoalInverseScorer,
    DensityScorer, GoalRatioScorer, InverseIndexScorer,
    RelativeGainScorer,
)

class IndicatorScorerFactory:
    def __init__(self, below_benchmark: str = "clamp") -> None:
        # One rule for every benchmark scorer. See scorers.BelowBenchmark and
        # settings.yaml scoring.below_benchmark.
        if below_benchmark not in ("clamp", "soft_floor"):
            raise ValueError(f"unknown scoring.below_benchmark: {below_benchmark!r}")
        bb = below_benchmark
        self._scorers = {
            # --- SECTOR 1: HEALTH ---
            "SH_ACS_UNHC_25": SimpleDirectionalScorer(),             # 3.8.1
            "SH_TBS_INCD": RatioThresholdScorer(threshold=40.0, global_average=40.0, below_benchmark=bb),  # 3.3.2
            "SH_STA_MALR": RatioThresholdScorer(threshold=10.0, global_average=10.0, below_benchmark=bb),  # 3.3.3
            "SH_STA_MORT": RatioThresholdScorer(threshold=70.0, global_average=70.0, below_benchmark=bb),  # 3.1.1
            "SH_DYN_MORT": RatioThresholdScorer(threshold=25.0, global_average=25.0, below_benchmark=bb),  # 3.2.1
            "SH_STA_STNT": RatioThresholdScorer(threshold=12.0, global_average=12.0, below_benchmark=bb),  # 2.2.1
            "SN_STA_OVWGT": RatioThresholdScorer(threshold=2.5, global_average=2.5, below_benchmark=bb),  # 2.2.2
            "SH_STA_ANEM": RatioThresholdScorer(threshold=25.0, global_average=25.0, below_benchmark=bb),  # 2.2.3
            # 3.7.1: 77.2% global average (2025, UN Population Division) is the
            # floor; the best country scores 100. Framework clarified 2026-10-16.
            "SH_FPL_MTMM": RelativeGainScorer(benchmark=77.2),            # 3.7.1
            "SP_DYN_ADKL": RatioThresholdScorer(threshold=20.0, below_benchmark=bb),     # 3.7.2
            "SH_IHR_CAPS": SimpleDirectionalScorer(),                # 3.d.1
            
            # --- SECTOR 2: AGRICULTURE ---
            "AG_PRD_FIESMS": RatioThresholdScorer(threshold=20.0, global_average=20.0, below_benchmark=bb),  # 2.1.2
            # 2.4.1 — UN SDG returns AG_LND_SUST as a 0-100 proportion of
            # agricultural area under sustainable practices (NOT the 1-5 band
            # the metadata describes). Higher proportion = better = less need,
            # so 100 - value gives vulnerability orientation directly. The old
            # RatioGoalInverse(0.04) / (1/value^2) transform was built for the
            # 1-5 scale and saturated every 0-100 value to 0. See SCORING_AUDIT
            # issue #4. NOTE: confirm the true UN SDG return scale.
            "AG_LND_SUST": SimpleDirectionalScorer(),                # 2.4.1
            # 2.a.2 — value must be normalized to ag-flow/GDP BEFORE scoring
            # (done in pipeline.score_indicators). GoalRatioScorer then applies
            # 1 - ratio/0.02 against the 2%-of-GDP goal. Raw USD-millions input
            # saturated everyone to 0; see SCORING_AUDIT issue #3.
            "DC_TOF_AGRL": GoalRatioScorer(goal=0.02, below_benchmark=bb),               # 2.a.2
            
            # --- SECTOR 3: SOCIAL INFRASTRUCTURE ---
            "SH_H2O_SAFE": InverseRatioScorer(global_avg_val=27.1, below_benchmark=bb),  # 6.1.1
            "SH_SAN_SAFE": InverseRatioScorer(global_avg_val=43.0, below_benchmark=bb),  # 6.2.1
            "SH_STA_WASHARI": RatioThresholdScorer(threshold=10.0, global_average=10.0, below_benchmark=bb),  # 3.9.2
            "EG_ACS_ELEC": InverseRatioScorer(global_avg_val=9.8, below_benchmark=bb),   # 7.1.1
            "EG_EGY_CLEAN": InverseRatioScorer(global_avg_val=30.4, below_benchmark=bb), # 7.1.2
            # 7.2.1: a 20% renewable share is the goal and the floor (previously
            # read as a gap of 20, i.e. an 80% benchmark). Clarified 2026-10-16.
            "EG_FEC_RNEW": RelativeGainScorer(benchmark=20.0),            # 7.2.1
            "FB_BNK_ACCSS": InverseRatioScorer(global_avg_val=45.0, below_benchmark=bb), # 8.10.2

            # --- CROSS-CUTTING & CONTEXT ---
            "GII_INDEX": RatioThresholdScorer(threshold=0.32, below_benchmark=bb),       # Gender Inequality
            "ND_GAIN_VULN": RatioThresholdScorer(threshold=0.46, below_benchmark=bb),    # Climate
            "EN.POP.DNST": DensityScorer(),                          # Population density (WB id)
            "POP_DENSITY": DensityScorer(),                          # legacy alias
            "SI_POV_NAHC": RatioThresholdScorer(threshold=10.0, global_average=10.0, below_benchmark=bb),  # 1.2.1
            "MPI_INDEX": RatioThresholdScorer(threshold=0.089, below_benchmark=bb),      # MPI
            "HDI_INDEX": InverseIndexScorer(),                       # verification baseline; slot is MSPI_INDEX
            "MSPI_INDEX": SimpleDirectionalScorer(),                 # pri/macrosec composite (higher-is-better value)

            # State capacity proxy: World Bank WGI Government Effectiveness.
            # WGI publishes a pre-normalized 0-100 score where higher = better
            # governance, so SimpleDirectionalScorer (100 - value) gives
            # vulnerability orientation directly.
            "WGI_GOVEFF": SimpleDirectionalScorer(),
        }

    def for_series(self, series_code: str):
        return self._scorers.get(series_code, SimpleDirectionalScorer())