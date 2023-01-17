#!/bin/sh
# ===============================================
# Install FreeCAD, openafpm-cad-core module,    #
# and create .env file.                         #
#                                               #
# Supports Linux and Windows operating systems. #
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

if is_linux; then
  freecad_download_link='https://github.com/FreeCAD/FreeCAD/releases/download/0.20.2/FreeCAD_0.20.2-2022-12-27-conda-Linux-x86_64-py310.AppImage'
  archive='freecad.AppImage'
else
  # Use 0.20.1 instead of 0.20.2 because extracting portable 0.20.2 Windows zip errors on certain files.
  freecad_download_link='https://github.com/FreeCAD/FreeCAD/releases/download/0.20.1/FreeCAD-0.20.1-WIN-x64-portable-1.zip'
  archive='freecad.zip'
fi

if [ ! -f "$archive" ]; then
  echo 'Downloading FreeCAD.'
  curl --location $freecad_download_link --output $archive
else
  echo 'FreeCAD already downloaded.'
fi

if is_linux; then
  chmod a+x $archive
  extracted_directory='squashfs-root'
  if [ ! -d "$extracted_directory" ]; then
    echo 'Extracting FreeCAD AppImage.'
    ./$archive --appimage-extract
  else
    echo 'FreeCAD AppImage already extracted.'
  fi
else
  extracted_directory='FreeCAD-portable'
  if [ ! -d "$extracted_directory" ]; then
    echo 'Extracting FreeCAD archive.'
    validate_command_exists unzip
    unzip $archive -d $extracted_directory
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
  validate_command_exists realpath
  realpath `find $extracted_directory -type f -name "$1"`
}

# Create .env file
# ----------------
if [ ! -f '.env' ]; then
  echo "Creating .env file."
  if is_linux; then
    python_path=$(get_path python)
    freecad_lib_directory=$(get_path FreeCAD.so | xargs -0 dirname)
  else
    validate_command_exists cygpath
    # cygpath is needed to convert posix paths to windows paths for .env file
    # for example /c/path/to/python.exe -> C:\path\to\python.exe
    python_path=$(cygpath -w `realpath "$extracted_directory/bin/python.exe"`)
    freecad_lib_directory=$(cygpath -w $(get_path FreeCADApp.dll | xargs -0 dirname))
  fi
  echo "PYTHON=$python_path" > .env
  echo "FREECAD_LIB=$freecad_lib_directory" >> .env
else
  echo ".env file already exists."
fi

echo 'Install complete.'
