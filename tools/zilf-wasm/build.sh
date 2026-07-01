#!/usr/bin/env bash
# build.sh — offline ZILF→WASM build for Frotzsmith
#
# Requires: .NET 10 SDK at ~/.dotnet/dotnet (wasm-tools workload must be installed)
# Usage: bash tools/zilf-wasm/build.sh  (from repo root, or cd tools/zilf-wasm && ./build.sh)
#
# Output: public/zilf/_framework/ (committed, shipped like inform6.wasm)
# ZILF source: tools/zilf-wasm/zilf/ (gitignored clone, pinned at rev 5262550)
set -euo pipefail

DOTNET="${HOME}/.dotnet/dotnet"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ZILF_DIR="${SCRIPT_DIR}/zilf"
ZILF_REV="5262550"
OUTPUT_DIR="${REPO_ROOT}/public/zilf"

echo "=== Frotzsmith ZILF→WASM build ==="
echo "Repo root : ${REPO_ROOT}"
echo "Tools dir : ${SCRIPT_DIR}"
echo ".NET SDK  : ${DOTNET}"

# --- 0. Verify .NET SDK ---
if [[ ! -x "${DOTNET}" ]]; then
  echo "ERROR: .NET 10 SDK not found at ${DOTNET}"
  echo "Install: curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --version 10.0.301"
  exit 1
fi
echo ".NET version: $(${DOTNET} --version)"

# --- 1. (Re)create ZILF clone at pinned rev (idempotent) ---
if [[ -d "${ZILF_DIR}/.git" ]]; then
  CURRENT_REV="$(git -C "${ZILF_DIR}" rev-parse HEAD | cut -c1-7)"
  if [[ "${CURRENT_REV}" == "${ZILF_REV}" ]]; then
    echo "ZILF clone already at rev ${ZILF_REV} — skipping clone"
  else
    echo "ZILF clone at wrong rev (${CURRENT_REV}); re-cloning to ${ZILF_REV}..."
    rm -rf "${ZILF_DIR}"
    git clone https://github.com/taradinoc/zilf "${ZILF_DIR}"
    git -C "${ZILF_DIR}" checkout "${ZILF_REV}"
  fi
else
  echo "Cloning ZILF (https://github.com/taradinoc/zilf) at rev ${ZILF_REV}..."
  git clone https://github.com/taradinoc/zilf "${ZILF_DIR}"
  git -C "${ZILF_DIR}" checkout "${ZILF_REV}"
fi

# --- 2. dotnet publish ---
echo ""
echo "Publishing ZilfWasm (Release, WasmFingerprintAssets=false)..."
"${DOTNET}" publish "${SCRIPT_DIR}/ZilfWasm.csproj" \
  -c Release \
  -p:WasmFingerprintAssets=false \
  --output "${SCRIPT_DIR}/publish"

# --- 3. Copy _framework bundle to public/zilf/ ---
FRAMEWORK_SRC="${SCRIPT_DIR}/publish/wwwroot/_framework"
if [[ ! -d "${FRAMEWORK_SRC}" ]]; then
  echo "ERROR: publish did not produce ${FRAMEWORK_SRC}"
  exit 1
fi

echo ""
echo "Copying bundle to ${OUTPUT_DIR}/ ..."
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"
cp -r "${FRAMEWORK_SRC}" "${OUTPUT_DIR}/_framework"

# Also copy dotnet.js from wwwroot root if present (some .NET versions put it there)
# NOTE: main.js and index.html are wasmbrowser template samples — not used by the
# Frotzsmith worker (which imports _framework/dotnet.js directly). Do NOT copy them.
for f in dotnet.js; do
  SRC="${SCRIPT_DIR}/publish/wwwroot/${f}"
  if [[ -f "${SRC}" ]]; then
    cp "${SRC}" "${OUTPUT_DIR}/${f}"
  fi
done

FILE_COUNT=$(find "${OUTPUT_DIR}" -type f | wc -l | tr -d ' ')
DIR_SIZE=$(du -sh "${OUTPUT_DIR}" | awk '{print $1}')
echo ""
echo "=== Build complete ==="
echo "Output    : ${OUTPUT_DIR}"
echo "Files     : ${FILE_COUNT}"
echo "Raw size  : ${DIR_SIZE}"
echo ""
echo "Verify with:"
echo "  node tools/zilf-wasm/test-smoke.mjs"
