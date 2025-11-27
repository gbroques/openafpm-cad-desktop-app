#!/bin/sh
# ================================================
# Get Latest Linux Artifact Link
# ================================================
# Retrieves the GitHub Actions artifact download link for the latest
# Linux build from the master branch.
#
# Requirements:
#   - GitHub CLI (gh) must be installed and authenticated
#
# Usage:
#   ./get-latest-linux-artifact-link.sh
#
# Output:
#   Prints the artifact download URL to stdout
#
# Example:
#   https://github.com/gbroques/openafpm-cad-desktop-app/actions/runs/12345/artifacts/67890

set -e

# Check if gh is installed
if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is not installed." >&2
  echo "Install it from: https://cli.github.com/" >&2
  exit 1
fi

# Check if authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: Not authenticated with GitHub CLI." >&2
  echo "Run: gh auth login" >&2
  exit 1
fi

# Get the database ID of the latest workflow run on master branch
RUN_ID=$(gh run list --workflow=build.yml --branch=master --limit=1 --json databaseId --jq '.[0].databaseId')

# Get the artifact ID for the linux-build artifact from that run
ARTIFACT_ID=$(gh api repos/gbroques/openafpm-cad-desktop-app/actions/runs/$RUN_ID/artifacts --jq '.artifacts[] | select(.name=="linux-build") | .id')

# Construct and print the artifact download URL
echo "https://github.com/gbroques/openafpm-cad-desktop-app/actions/runs/$RUN_ID/artifacts/$ARTIFACT_ID"
