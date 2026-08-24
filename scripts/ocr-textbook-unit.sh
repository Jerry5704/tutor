#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pdf_path="${TEXTBOOK_PDF:-$project_dir/materials/biologia-na-czasie-4.pdf}"
output_dir="${OCR_OUTPUT_DIR:-$project_dir/materials/derived/biologia-na-czasie-4/unit-1}"
tesseract_root="$project_dir/.tools/tesseract/root"
tesseract_bin="$tesseract_root/usr/bin/tesseract"
tessdata_dir="$tesseract_root/usr/share/tesseract-ocr/5/tessdata"

# Unit 1 content spans printed pages 6-64 (PDF pages 8-66).
# PDF page 67 is already the opening divider for unit 2.
first_pdf_page=8
last_pdf_page=66
page_offset=2

if [[ ! -f "$pdf_path" ]]; then
  echo "Missing textbook PDF: $pdf_path" >&2
  exit 1
fi

if [[ ! -x "$tesseract_bin" ]]; then
  echo "Local OCR is not installed. Run: npm run ocr:setup" >&2
  exit 1
fi

mkdir -p "$output_dir/pages" "$output_dir/images"

pdf_checksum="$(sha256sum "$pdf_path" | awk '{print $1}')"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for pdf_page in $(seq "$first_pdf_page" "$last_pdf_page"); do
  book_page=$((pdf_page - page_offset))
  page_name="page-$(printf '%03d' "$book_page")"
  image_path="$output_dir/images/$page_name.png"
  text_base="$output_dir/pages/$page_name"

  if [[ -s "$text_base.txt" ]]; then
    continue
  fi

  pdftoppm -f "$pdf_page" -singlefile -png -r 220 "$pdf_path" "$text_base" >/dev/null 2>&1
  mv "$text_base.png" "$image_path"
  TESSDATA_PREFIX="$tessdata_dir" "$tesseract_bin" "$image_path" "$text_base" \
    -l pol+eng --psm 3 >/dev/null 2>&1
  echo "OCR: PDF $pdf_page / book $book_page"
done

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  printf '{\n'
  printf '  "source": "biologia-na-czasie-4.pdf",\n'
  printf '  "unit": "1. Genetyka molekularna",\n'
  printf '  "pdfPageRange": {"from": %d, "to": %d},\n' "$first_pdf_page" "$last_pdf_page"
  printf '  "bookPageRange": {"from": %d, "to": %d},\n' "$((first_pdf_page - page_offset))" "$((last_pdf_page - page_offset))"
  printf '  "language": "pol+eng",\n'
  printf '  "ocr": "tesseract-5.3.4",\n'
  printf '  "renderDpi": 220,\n'
  printf '  "sourceSha256": "%s",\n' "$pdf_checksum"
  printf '  "startedAt": "%s",\n' "$started_at"
  printf '  "finishedAt": "%s"\n' "$finished_at"
  printf '}\n'
} >"$output_dir/manifest.json"

echo "OCR complete: $output_dir"
