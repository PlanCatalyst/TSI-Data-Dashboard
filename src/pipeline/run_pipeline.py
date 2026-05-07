"""
Uses the Orchestrator class to run the entire data pipeline.

Fetch -> Clean -> Process -> Upload
"""

import os
import sys

# Ensure repository root is on sys.path so absolute package imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.pipeline.orchestrator import Orchestrator

def main():
    orchestrator = Orchestrator()
    processed_data = orchestrator.run()
    
    return processed_data

if __name__ == "__main__":
    main()
