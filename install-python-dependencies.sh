#!/bin/sh
# ===========================
# Install Python dependencies
# ===========================
# Downloads FreeCAD if not present to use its bundled Python interpreter.
# Creates symlinks to ../openafpm-cad-core and ../freecad-to-obj if they exist (for local development).
# Otherwise clones repositories from GitHub.
# Symlinks are replaced with real clones during packaging (see afterPack.js).
# Installs fastapi and uvicorn to site-packages/ using FreeCAD's Python.

# Exit on error. 
set -e

validate_command_exists()
{
  if ! [ -x "$(command -v $1)" ]; then
    echo "Error: $1 command must exist." >&2
    exit 1
  fi
}

# Get user data path based on platform
get_user_data_path()
{
  app_name=$(grep '"name"' package.json | sed 's/.*"name": "\(.*\)".*/\1/')
  
  case "$(uname -s)" in
    Linux*)
      echo "$HOME/.config/$app_name"
      ;;
    Darwin*)
      echo "$HOME/Library/Application Support/$app_name"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "$APPDATA/$app_name"
      ;;
    *)
      echo "Unsupported platform: $(uname -s)" >&2
      exit 1
      ;;
  esac
}

# Find Python executable in FreeCAD installation
find_python()
{
  user_data_path="$1"
  freecad_dir="$user_data_path/freecad"
  
  if [ ! -d "$freecad_dir" ]; then
    return 1
  fi
  
  # Find latest version directory
  version_dir=$(find "$freecad_dir" -maxdepth 1 -type d -name "1.0.*" | sort -V | tail -1)
  
  if [ -z "$version_dir" ]; then
    return 1
  fi
  
  # Find python executable
  python_path=$(find "$version_dir" -type f -name "python" | head -1)
  
  if [ -n "$python_path" ] && [ -x "$python_path" ]; then
    echo "$python_path"
    return 0
  fi
  
  return 1
}

# Download FreeCAD if not present
validate_command_exists node

user_data_path=$(get_user_data_path)
python_path=$(find_python "$user_data_path")

if [ -z "$python_path" ]; then
  echo "FreeCAD not found. Downloading..."
  node backend/downloadFreeCAD.js
  
  # Try finding Python again
  python_path=$(find_python "$user_data_path")
  
  if [ -z "$python_path" ]; then
    echo "Error: Failed to find Python after downloading FreeCAD" >&2
    exit 1
  fi
fi

echo "Using Python: $python_path"

# Install Python dependencies to site-packages
# --------------------------------------------
validate_command_exists git

site_packages_dir="site-packages"

# openafpm-cad-core
if [ ! -e "$site_packages_dir/openafpm-cad-core" ]; then
  if [ -d "../openafpm-cad-core" ]; then
    echo "Creating symlink to ../openafpm-cad-core for local development."
    ln -s "$(cd ../openafpm-cad-core && pwd)" "$site_packages_dir/openafpm-cad-core"
  else
    echo "Downloading openafpm-cad-core module."
    git clone --depth 1 https://github.com/gbroques/openafpm-cad-core.git "$site_packages_dir/openafpm-cad-core"
  fi
else
  echo "openafpm-cad-core module already exists."
fi

# freecad-to-obj
if [ ! -e "$site_packages_dir/freecad-to-obj" ]; then
  if [ -d "../freecad-to-obj" ]; then
    echo "Creating symlink to ../freecad-to-obj for local development."
    ln -s "$(cd ../freecad-to-obj && pwd)" "$site_packages_dir/freecad-to-obj"
  else
    echo "Downloading freecad-to-obj module."
    git clone --depth 1 https://github.com/gbroques/freecad-to-obj.git "$site_packages_dir/freecad-to-obj"
  fi
else
  echo "freecad-to-obj module already exists."
fi

# Install additional Python libraries
# -----------------------------------
if [ ! -d "$site_packages_dir/fastapi" ] || [ ! -d "$site_packages_dir/uvicorn" ]; then
  echo "Installing fastapi and uvicorn to $site_packages_dir."
  "$python_path" -m pip install --target "$site_packages_dir" fastapi uvicorn
else
  echo "fastapi and uvicorn already installed."
fi

echo 'Install complete.'
