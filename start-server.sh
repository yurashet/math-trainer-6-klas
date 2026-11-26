#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "http://localhost:8080"
python -m http.server 8080
