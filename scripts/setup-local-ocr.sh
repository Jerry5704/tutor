#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tool_dir="$project_dir/.tools/tesseract"
package_dir="$tool_dir/packages"
root_dir="$tool_dir/root"

mkdir -p "$package_dir" "$root_dir"

if [[ ! -x "$root_dir/usr/bin/tesseract" ]]; then
  (
    cd "$package_dir"
    apt-get download tesseract-ocr tesseract-ocr-pol tesseract-ocr-eng tesseract-ocr-osd
  )

  for package_file in "$package_dir"/*.deb; do
    dpkg-deb -x "$package_file" "$root_dir"
  done
fi

TESSDATA_PREFIX="$root_dir/usr/share/tesseract-ocr/5/tessdata" \
  "$root_dir/usr/bin/tesseract" --list-langs
