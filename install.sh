#!/bin/sh
# ===============================================
# Install FreeCAD, openafpm-cad-core module,    #
# and create .env file.                         #
#                                               #
# Supports Linux and Windows operating systems. #
# A contribution to support MacOS is welcomed.  #
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
  [ "$(uname --kernel-name)" = "Linux" ]
}

is_macOS()
{
  [ "$(uname --kernel-name)" = "Darwin" ]
}

# https://github.com/FreeCAD/FreeCAD/releases
if is_linux; then
  freecad_download_link='https://github.com/FreeCAD/FreeCAD/releases/download/0.21.2/FreeCAD-0.21.2-Linux-x86_64.AppImage'
  archive='freecad.AppImage'
elif is_macOS; then
  echo "Error: MacOS not supported. Please contribute changes on GitHub." >&2
  exit 1
else # Windows
  freecad_download_link='https://github.com/FreeCAD/FreeCAD/releases/download/0.21.2/FreeCAD-0.21.2-Windows-x86_64.7z'
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
  echo "Error: MacOS not supported. Please contribute changes on GitHub." >&2
  exit 1
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
  find $extracted_directory -type f -name "$1"
}

# Create .env file
# ----------------
if [ ! -f '.env' ]; then
  echo "Creating .env file."
  if is_linux; then
    python_path=$(get_path python)
    freecad_lib_directory=$(get_path FreeCAD.so | xargs -0 dirname)
  elif is_macOS; then
    echo "Error: MacOS not supported. Please contribute changes on GitHub." >&2
    exit 1
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
