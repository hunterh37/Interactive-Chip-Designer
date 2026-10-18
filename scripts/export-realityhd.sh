#!/bin/sh
# Exports RealityHD catalog props to GLB (three.js / WebXR) and USDZ (Quick Look, visionOS) into web/public/models.
set -e
cd "$(dirname "$0")/.."
OUT="$PWD/web/public/models"
mkdir -p "$OUT"
( cd ../RealityHD && swift build -c release --product realityhd >/dev/null )
for id in desktop-monitor laptop; do ../RealityHD/.build/release/realityhd export "$id" --lod 1 --size 512 --out "$OUT"; done
