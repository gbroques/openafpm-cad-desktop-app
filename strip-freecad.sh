#!/bin/sh
# ===============================================
# Strip unnecessary files from FreeCAD          #
# Conservative approach - safe for all uses     #
# Saves ~200 MB (2.4 GB → 2.2 GB)              #
# ===============================================

set -e

extracted_directory='squashfs-root'

if [ ! -d "$extracted_directory" ]; then
  echo "Error: $extracted_directory does not exist."
  exit 1
fi

echo "Stripping unnecessary files from FreeCAD (conservative)..."

# ===============================================
# Documentation and Help Files (~50 MB)
# ===============================================
echo "Removing documentation..."
rm -rf $extracted_directory/usr/share/doc
rm -rf $extracted_directory/usr/share/man
rm -rf $extracted_directory/usr/man
rm -rf $extracted_directory/usr/doc
rm -rf $extracted_directory/usr/share/info

# ===============================================
# Translations and Locales (~65 MB)
# ===============================================
echo "Removing translations..."
rm -rf $extracted_directory/usr/share/locale
rm -rf $extracted_directory/usr/translations

# ===============================================
# Example Files (~5 MB)
# ===============================================
echo "Removing examples..."
rm -rf $extracted_directory/usr/share/examples
rm -rf $extracted_directory/usr/share/hdf5_examples

# ===============================================
# Unused Libraries (~100 MB)
# ===============================================
echo "Removing unused libraries..."
# OpenVINO - AI inference library (not used)
rm -rf $extracted_directory/usr/lib/openvino-*
# PKCS11 - Security token library (not used)
rm -rf $extracted_directory/usr/lib/pkcs11

# ===============================================
# Unused Services (~15 MB)
# ===============================================
echo "Removing unused service files..."
# MySQL database files (not used)
rm -rf $extracted_directory/usr/share/mysql
# CUPS printing system (not used)
rm -rf $extracted_directory/usr/share/cups

# ===============================================
# Timezone Data (~3 MB)
# ===============================================
echo "Removing timezone data..."
rm -rf $extracted_directory/usr/share/zoneinfo

# ===============================================
# Python Cache and Test Files (~10 MB)
# ===============================================
echo "Removing Python cache and test files..."
# Find Python lib directory (works with any Python version)
python_lib_dir=$(find $extracted_directory/usr/lib -maxdepth 1 -type d -name "python*" | head -1)
if [ -n "$python_lib_dir" ]; then
  # Remove __pycache__ directories
  find "$python_lib_dir" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
  # Remove test directories
  find "$python_lib_dir" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
  find "$python_lib_dir" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
fi

# ===============================================
# Strip Debug Symbols from Binaries (~20 MB)
# ===============================================
echo "Stripping debug symbols from binaries..."
# Strip debug symbols from shared libraries
find $extracted_directory/usr/lib -name "*.so*" -type f -exec strip --strip-debug {} \; 2>/dev/null || true
# Strip all symbols from executables
find $extracted_directory/usr/bin -type f -exec strip --strip-all {} \; 2>/dev/null || true

echo "Strip complete."
