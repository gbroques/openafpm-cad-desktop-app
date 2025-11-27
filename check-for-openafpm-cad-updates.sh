#!/bin/bash
#
# Check for OpenAFPM CAD dependency updates and send email notification
#
# Prerequisites:
# 1. Install msmtp:
#    sudo apt install msmtp msmtp-mta
#
# 2. Configure ~/.msmtprc:
#    defaults
#    auth on
#    tls on
#    tls_trust_file /etc/ssl/certs/ca-certificates.crt
#    logfile ~/.msmtp.log
#
#    account gmail
#    host smtp.gmail.com
#    port 587
#    from your-email@gmail.com
#    user your-email@gmail.com
#    password YOUR_APP_PASSWORD
#
#    account default : gmail
#
# 3. Set permissions:
#    chmod 600 ~/.msmtprc
#
# 4. Generate Gmail App Password:
#    - Go to Google Account → Security → 2-Step Verification → App passwords
#    - Generate app password for "Mail"
#    - Use that password in ~/.msmtprc
#
# 5. Set environment variables (add to ~/.bashrc or ~/.profile):
#    export OPENAFPM_SENDER_EMAIL="your-email@gmail.com"
#    export OPENAFPM_RECIPIENT_EMAIL="recipient@example.com"
#
# Usage:
#    ./check-for-openafpm-cad-updates.sh
#
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

# Check required environment variables
if [ -z "$OPENAFPM_SENDER_EMAIL" ]; then
  echo "Error: OPENAFPM_SENDER_EMAIL environment variable not set"
  exit 1
fi

if [ -z "$OPENAFPM_RECIPIENT_EMAIL" ]; then
  echo "Error: OPENAFPM_RECIPIENT_EMAIL environment variable not set"
  exit 1
fi

SENDER_EMAIL="$OPENAFPM_SENDER_EMAIL"
RECIPIENT_EMAIL="$OPENAFPM_RECIPIENT_EMAIL"

echo "Checking for OpenAFPM CAD updates..."

# Fetch latest commits from GitHub
echo "Fetching latest commits from GitHub..."
LATEST_CORE=$(gh api repos/gbroques/openafpm-cad-core/commits/master --jq '.sha')
LATEST_VIZ=$(gh api repos/gbroques/openafpm-cad-visualization/commits/master --jq '.sha')

echo "Latest openafpm-cad-core: $LATEST_CORE"
echo "Latest openafpm-cad-visualization: $LATEST_VIZ"

# Extract current commits
CURRENT_CORE=$(grep 'OPENAFPM_CAD_CORE_VERSION=' install-python-dependencies.sh | sed 's/.*="\(.*\)"/\1/')
CURRENT_VIZ=$(grep 'openafpm-cad-visualization' package.json | sed 's/.*#\(.*\)".*/\1/')

echo "Current openafpm-cad-core: $CURRENT_CORE"
echo "Current openafpm-cad-visualization: $CURRENT_VIZ"

# Track changes
CHANGED=()
COMMIT_LOGS=""

# Check openafpm-cad-core
if [ "$LATEST_CORE" != "$CURRENT_CORE" ]; then
  echo "Fetching commit log for openafpm-cad-core..."
  CORE_LOG=$(gh api "repos/gbroques/openafpm-cad-core/compare/$CURRENT_CORE...$LATEST_CORE" --jq '.commits[] | "- \(.commit.message | split("\n")[0])"')
  COMMIT_LOGS+="openafpm-cad-core changes:\n$CORE_LOG\n\n"
  CHANGED+=("openafpm-cad-core@${LATEST_CORE:0:7}")
  
  echo "Updating openafpm-cad-core..."
  sed -i "s/OPENAFPM_CAD_CORE_VERSION=\".*\"/OPENAFPM_CAD_CORE_VERSION=\"$LATEST_CORE\"/" install-python-dependencies.sh
fi

# Check openafpm-cad-visualization
if [ "$LATEST_VIZ" != "$CURRENT_VIZ" ]; then
  echo "Fetching commit log for openafpm-cad-visualization..."
  VIZ_LOG=$(gh api "repos/gbroques/openafpm-cad-visualization/compare/$CURRENT_VIZ...$LATEST_VIZ" --jq '.commits[] | "- \(.commit.message | split("\n")[0])"')
  COMMIT_LOGS+="openafpm-cad-visualization changes:\n$VIZ_LOG\n\n"
  CHANGED+=("openafpm-cad-visualization@${LATEST_VIZ:0:7}")
  
  echo "Updating openafpm-cad-visualization..."
  sed -i "s/#$CURRENT_VIZ\"/#$LATEST_VIZ\"/" package.json
fi

# Exit if no changes
if [ ${#CHANGED[@]} -eq 0 ]; then
  echo "No updates needed"
  exit 0
fi

# Commit and push
echo "Committing changes..."
git add install-python-dependencies.sh package.json
COMMIT_MSG="Update dependencies: $(IFS=', '; echo "${CHANGED[*]}")"
git commit -m "$COMMIT_MSG"
git push origin master

echo "Pushed: $COMMIT_MSG"

# Wait for build to complete
echo "Waiting for GitHub Actions build to complete..."
RUN_ID=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID"

# Get download link
echo "Getting download link..."
DOWNLOAD_LINK=$(./get-latest-linux-artifact-link.sh)

# Compose and send email
EMAIL_SUBJECT="OpenAFPM CAD Update: $(IFS=', '; echo "${CHANGED[*]}")"
EMAIL_BODY="New build available:\n$DOWNLOAD_LINK\n\n$COMMIT_LOGS"

echo "Sending email..."
echo -e "Subject: $EMAIL_SUBJECT\nTo: $RECIPIENT_EMAIL\nCc: $SENDER_EMAIL\n\n$EMAIL_BODY" | msmtp -t

echo "✓ Email sent to $RECIPIENT_EMAIL (CC: $SENDER_EMAIL)"
