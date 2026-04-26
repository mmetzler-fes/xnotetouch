#!/bin/bash

# Entferne alle Snap-bezogenen Umgebungsvariablen
unset GTK_PATH
unset GIO_MODULE_DIR
unset GTK_EXE_PREFIX
unset LOCPATH
unset GTK_IM_MODULE_FILE
unset GSETTINGS_SCHEMA_DIR

# Setze saubere XDG-Pfade ohne Snap
export XDG_DATA_DIRS="/usr/local/share:/usr/share"
export XDG_CONFIG_DIRS="/etc/xdg"

# Bereinige LD_LIBRARY_PATH
export LD_LIBRARY_PATH=""

# Starte Tauri im Dev-Modus direkt
npx tauri dev
