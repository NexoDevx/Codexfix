#!/bin/bash
# Gera a MainActivity registrando só os plugins nativos que existem no projeto (Shell e/ou Folder).
PKG=android/app/src/main/java/com/codemobile/app; R=""
[ -f "$PKG/ShellPlugin.java" ] && R="$R    registerPlugin(ShellPlugin.class);\n"
[ -f "$PKG/FolderPlugin.java" ] && R="$R    registerPlugin(FolderPlugin.class);\n"
if [ -z "$R" ]; then
  printf 'package com.codemobile.app;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n' > "$PKG/MainActivity.java"
else
  printf 'package com.codemobile.app;\n\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n  @Override\n  public void onCreate(Bundle savedInstanceState) {\n%b    super.onCreate(savedInstanceState);\n  }\n}\n' "$R" > "$PKG/MainActivity.java"
fi
