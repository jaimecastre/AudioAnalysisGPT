#!/usr/bin/env bash
set -euo pipefail

# Setup Graphify knowledge graph for the AcousticCanvas project
# This script installs graphify and builds the codebase knowledge graph

echo "Installing graphify..."
python -m pip install --upgrade graphifyy

echo "Installing graphify hooks..."
graphify install

echo "Building knowledge graph (AST only, skipping clustering for speed)..."
graphify . --no-viz

echo "Graphify setup complete. Knowledge graph available in graphify-out/"
