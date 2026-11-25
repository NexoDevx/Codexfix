#!/bin/bash
# Opcional (o workflow roda com continue-on-error): coloca proot + Alpine + plugin Java no projeto Android.
# Se qualquer passo falhar, NADA é copiado para o app e o APK sai igual ao de antes (só sem o Linux embutido).
set -e
APP=android/app/src/main; PKG=$APP/java/com/codemobile/app; JNI=$APP/jniLibs/arm64-v8a
W=$(mktemp -d); mkdir -p "$JNI" "$APP/assets"

# 1) proot estático (loader separado) — builds prontos do green-green-avk/build-proot-android
git clone --depth 1 https://github.com/green-green-avk/build-proot-android "$W/bp"
echo "pacotes disponíveis:"; ls "$W/bp/packages" || true
T=$(ls "$W"/bp/packages/*aarch64* 2>/dev/null | head -1); [ -n "$T" ] || { echo "sem pacote aarch64 de proot"; exit 1; }
mkdir "$W/pr"; tar -xf "$T" -C "$W/pr"
PROOT=$(find "$W/pr" -type f -path '*bin/proot' | head -1); LOADER=$(find "$W/pr" -type f -path '*libexec/proot/loader' | head -1)
[ -n "$PROOT" ] && [ -n "$LOADER" ] || { echo "proot/loader não encontrados"; exit 1; }
cp "$PROOT" "$W/libproot.so"; cp "$LOADER" "$W/libproot-loader.so"

# 2) rootfs do Alpine (aarch64) embutido no APK (nome .bin para o Gradle não mexer no .gz)
B=https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/aarch64
F=$(curl -fsSL "$B/latest-releases.yaml" | grep -o 'alpine-minirootfs-[0-9.]*-aarch64.tar.gz' | head -1)
[ -n "$F" ] || { echo "rootfs do Alpine não encontrado"; exit 1; }
curl -fsSL "$B/$F" -o "$W/rootfs.bin"

# 3) tudo certo: agora sim copia para o app
cp "$W/libproot.so" "$W/libproot-loader.so" "$JNI/"; cp "$W/rootfs.bin" "$APP/assets/rootfs.bin"
cp native/ShellPlugin.java "$PKG/ShellPlugin.java"
bash native/mainactivity.sh
echo "Linux embutido adicionado ao projeto Android."
