#!/bin/bash
# Opcional: plugin nativo para escolher uma pasta do aparelho (SAF). Se falhar, o workflow segue sem ele.
set -e
PKG=android/app/src/main/java/com/codemobile/app
cp native/FolderPlugin.java "$PKG/FolderPlugin.java"
bash native/mainactivity.sh
