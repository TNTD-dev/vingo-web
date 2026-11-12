#!/usr/bin/env bash
# Đồng bộ contracts/vingo-openapi.yaml theo CONTRACT_VERSION.
#   contract-vX.Y.Z → tải từ GitHub Release của vingo-backend (cần gh đã đăng nhập)
#   local           → copy từ repo vingo-backend cạnh bên (BACKEND_DIR, mặc định ../vingo-backend)
set -euo pipefail

cd "$(dirname "$0")/.."
version="$(tr -d '[:space:]' < CONTRACT_VERSION)"
dest="contracts/vingo-openapi.yaml"

if [[ "$version" == "local" ]]; then
  src="${BACKEND_DIR:-../vingo-backend}/contracts/vingo-openapi.yaml"
  [[ -f "$src" ]] || { echo "Không thấy $src. Đặt BACKEND_DIR trỏ tới repo vingo-backend." >&2; exit 1; }
  cp "$src" "$dest"
  echo "Đã copy contract từ $src"
else
  gh release download "$version" --repo TNTD-dev/vingo-backend --pattern vingo-openapi.yaml --output "$dest" --clobber
  echo "Đã tải contract $version"
fi
