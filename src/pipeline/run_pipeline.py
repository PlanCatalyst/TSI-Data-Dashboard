"""
Runs the entire data pipeline through the Orchestrator.

Fetch -> Clean -> Score -> Upload -> Publish

Exit code 0 when the last log line is PIPELINE RUN COMPLETE, 1 when it is
PIPELINE RUN FAILED. The Azure Container Apps Job surfaces that code as the
execution status.
"""

import os
import sys

# Ensure repository root is on sys.path so absolute package imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.pipeline.orchestrator import Orchestrator


def main() -> int:
    return Orchestrator().run()


if __name__ == "__main__":
    sys.exit(main())
