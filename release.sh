#!/bin/sh
#
# Release Script
# --------------
# Automates the release process by:
# 1. Updating package.json to the specified version (removes -SNAPSHOT suffix)
# 2. Creating a git commit with the version change
# 3. Creating a git tag (v<version>)
#
# Usage: ./release.sh <version>
# Example: ./release.sh 1.0.0
#
# After running, push with: git push --follow-tags

set -e

if [ -z "$1" ]; then
  echo "Usage: ./release.sh <version>"
  echo "Example: ./release.sh 1.0.0"
  exit 1
fi

VERSION=$1

# Validate version format (basic semver check)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in format X.Y.Z (e.g., 1.0.0)"
  exit 1
fi

# Update package.json
echo "Updating package.json to version $VERSION..."
npm version --no-git-tag-version "$VERSION"

# Commit and tag
echo "Creating commit and tag..."
git add package.json
git commit -m "Release $VERSION"
git tag "v$VERSION"

echo "Release $VERSION created successfully!"
echo "Push with: git push --follow-tags"
