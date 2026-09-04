set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
OK="${GREEN}✔${NC}"

FONTS_URL="https://files.isc-vs.ch/typst/modern-isc-fonts-v2.tar.gz"
FONTS_DIR_NAME="modern-isc-fonts-v2"
DEST_DIR="${HOME}/.local/share/fonts"
REQUIRED_FONTS=("Source Sans Pro" "Source Sans 3" "Inria Sans" "Fira Code")

TMP_DIR="$(mktemp -d /tmp/isc-fonts-XXXXXX)"
cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

log()  { echo -e "$1"; }
fail() { echo -e "${RED}Error: $1${NC}" >&2; exit 1; }

if command -v typst >/dev/null 2>&1; then
    missing=()
    for font in "${REQUIRED_FONTS[@]}"; do
        typst fonts | grep -qx "${font}" || missing+=("${font}")
    done
    if [ ${#missing[@]} -eq 0 ]; then
        log "${OK} All fonts are already installed. Nothing to do."
        exit 0
    fi
fi

mkdir -p "${DEST_DIR}"

log "Downloading fonts..."
ARCHIVE_PATH="${TMP_DIR}/fonts.tar.gz"
wget -q -O "${ARCHIVE_PATH}" "${FONTS_URL}" || fail "Failed to download ${FONTS_URL}"
log "${OK} Archive downloaded"

listing="$(tar -tzf "${ARCHIVE_PATH}")"
while IFS= read -r entry; do
    [ -z "${entry}" ] && continue
    case "${entry}" in
        */../*|../*) fail "suspect path detected in the archive: ${entry}" ;;
        *.ttf|*.otf) ;;                       # ok
        */)          ;;                       # folder, ok
        *)           fail "unexpected file in the archive (not a font): ${entry}" ;;
    esac
done <<< "${listing}"
log "${OK} Contenu de l'archive vérifié (uniquement des polices)"

EXTRACT_DIR="${TMP_DIR}/extracted"
mkdir -p "${EXTRACT_DIR}"
tar -zxf "${ARCHIVE_PATH}" -C "${EXTRACT_DIR}" || fail "Failed to extract the archive"

FONT_SRC_DIR="${EXTRACT_DIR}/${FONTS_DIR_NAME}"
[ -d "${FONT_SRC_DIR}" ] || FONT_SRC_DIR="${EXTRACT_DIR}"

shopt -s nullglob
ttfs=("${FONT_SRC_DIR}"/*.ttf)
otfs=("${FONT_SRC_DIR}"/*.otf)
shopt -u nullglob

[ ${#ttfs[@]} -eq 0 ] && [ ${#otfs[@]} -eq 0 ] && fail "no fonts found after extraction"

[ ${#ttfs[@]} -gt 0 ] && cp "${ttfs[@]}" "${DEST_DIR}/"
[ ${#otfs[@]} -gt 0 ] && cp "${otfs[@]}" "${DEST_DIR}/"
log "${OK} Fonts copied to ${DEST_DIR}"

fc-cache -f >/dev/null
log "${OK} Cache de polices reconstruit"

if command -v typst >/dev/null 2>&1; then
    missing=()
    for font in "${REQUIRED_FONTS[@]}"; do
        typst fonts | grep -qx "${font}" || missing+=("${font}")
    done
    if [ ${#missing[@]} -ne 0 ]; then
        fail "fonts still missing after installation: ${missing[*]}"
    fi
fi

log "${OK} Installation of fonts completed successfully."