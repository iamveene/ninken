#!/usr/bin/env python3
"""NinLoader CLI entrypoint — run from repo root or as standalone script."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from ninloader.cli import main

if __name__ == "__main__":
    main()
