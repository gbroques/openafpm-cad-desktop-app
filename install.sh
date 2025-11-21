#!/bin/sh
# ===============================================
# Install FreeCAD, openafpm-cad-core module,    #
# and create .env file.                         #
# ===============================================

# Exit on error. 
set -e

# Download and extract FreeCAD
# ----------------------------

validate_command_exists()
{
  if ! [ -x "$(command -v $1)" ]; then
    echo "Error: $1 command must exist." >&2
    exit 1
  fi
}

validate_command_exists curl

is_linux()
{
  [ "$(uname -s)" = "Linux" ]
}

is_macOS()
{
  [ "$(uname -s)" = "Darwin" ]
}

# https://github.com/FreeCAD/FreeCAD/releases
if is_linux; then
  freecad_download_link='https://github.com/FreeCAD/FreeCAD/releases/download/1.0.2/FreeCAD_1.0.2-conda-Linux-x86_64-py311.AppImage'
  archive='freecad.AppImage'
elif is_macOS; then
  freecad_download_link='https://github.com/FreeCAD/FreeCAD/releases/download/1.0.2/FreeCAD_1.0.2-conda-macOS-arm64-py311.dmg'
  archive='freecad.dmg'
else # Windows
  freecad_download_link='https://github.com/FreeCAD/FreeCAD/releases/download/1.0.0/FreeCAD_1.0.0-conda-Windows-x86_64-py311.7z'
  archive='freecad.7z'
fi

if [ ! -f "$archive" ]; then
  echo 'Downloading FreeCAD.'
  curl --location $freecad_download_link --output $archive
else
  echo 'FreeCAD already downloaded.'
fi

extracted_directory='squashfs-root'
if is_linux; then
  chmod a+x $archive
  if [ ! -d "$extracted_directory" ]; then
    echo 'Extracting FreeCAD AppImage.'
    ./$archive --appimage-extract
  else
    echo 'FreeCAD AppImage already extracted.'
  fi
elif is_macOS; then
  if [ ! -d "$extracted_directory" ]; then
    echo 'Extracting FreeCAD dmg.'
    hdiutil attach $archive
    echo "Copying files to $extracted_directory"
    cp -rv /Volumes/FreeCAD/FreeCAD.app/Contents/Resources $extracted_directory
    hdiutil detach /Volumes/FreeCAD
  else
    echo 'FreeCAD dmg already extracted.'
  fi
else # Windows
  if [ ! -d "$extracted_directory" ]; then
    echo 'Extracting FreeCAD archive.'
    validate_command_exists 7z
    7z e $archive -o $extracted_directory
  else
    echo 'FreeCAD archive already extracted.'
  fi
fi

# Install openafpm-cad-core module
# --------------------------------
validate_command_exists git

install_gbroques_module()
{
  if is_linux; then
    module_directory="$extracted_directory/usr/Mod/$1"
  else
    module_directory="$extracted_directory/Mod/$1"
  fi
  if [ ! -d "$module_directory" ]; then
    echo "Downloading $1 module."
    git clone https://github.com/gbroques/$1.git $module_directory
  else
    echo "$1 module already exists."
  fi
}

install_gbroques_module openafpm-cad-core
install_gbroques_module freecad-to-obj

get_path()
{
  find $extracted_directory -type f -name "$1" | head -1
}

# Install additional Python libraries
# -----------------------------------
if is_linux; then
  site_packages_dir=$(find "$extracted_directory/usr/lib" -name "python*" -type d | head -1)/site-packages
  if [ ! -d "$site_packages_dir/fastapi" ] || [ ! -d "$site_packages_dir/uvicorn" ]; then
    python_path=$(get_path python)
    echo "Installing fastapi and uvicorn."
    $python_path -m pip install --target $site_packages_dir fastapi uvicorn
  else
    echo "fastapi and uvicorn already installed."
  fi
fi

# Create .env file
# ----------------
if [ ! -f '.env' ]; then
  echo "Creating .env file."
  if is_linux || is_macOS; then
    python_path=$(get_path python)
    freecad_lib_directory=$(get_path FreeCAD.so | xargs -0 dirname)
  else # Windows
    validate_command_exists cygpath
    # cygpath is needed to convert posix paths to windows paths for .env file
    # for example /c/path/to/python.exe -> C:\path\to\python.exe
    python_path=$(cygpath -w "$extracted_directory/bin/python.exe")
    freecad_lib_directory=$(cygpath -w $(get_path FreeCADApp.dll | xargs -0 dirname))
  fi
  echo "PYTHON=$python_path" > .env
  echo "FREECAD_LIB=$freecad_lib_directory" >> .env
else
  echo ".env file already exists."
fi

echo 'Install complete.'
