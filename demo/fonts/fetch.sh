#!/bin/sh
# Caches the two Google Fonts families the page loads, so the recording does not
# open on a stretch of unstyled text. Optional: without it the script just lets
# the browser fetch them over the network.
set -e
dir=$(dirname "$0")
ua="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
css="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@110,600;110,700;110,800&family=Instrument+Sans:wght@400;500;600&display=swap"

curl -sS -A "$ua" "$css" -o "$dir/fonts.css"
: > "$dir/map.txt"
i=0
for url in $(grep -o 'https://fonts.gstatic.com[^)]*' "$dir/fonts.css" | sort -u); do
  i=$((i + 1))
  curl -sS "$url" -o "$dir/f$i.woff2"
  echo "$url fonts/f$i.woff2" >> "$dir/map.txt"
done
echo "cached $i font files"
