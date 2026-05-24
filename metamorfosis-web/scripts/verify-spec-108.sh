#!/usr/bin/env bash
# SPEC-108 — Verificación post-deploy.
# Uso: bash scripts/verify-spec-108.sh
#
# Espera ~120s después del push antes de correrlo (deploy Hostinger).
#
# Nota: pasamos un User-Agent realista de Chrome porque el proxy HCDN de
# Hostinger interpone una página intersticial ("Checking your browser
# before accessing...") en requests con UA tipo `curl/8.x`. Con UA de
# navegador o de bot conocido (Googlebot, etc.) sirve directamente el
# HTML real. Sin esto, el script reportaría falsos negativos.

set -u
BASE="https://www.metamorfosisvital.com.co"

echo "=== 1) 0 referencias a localhost en el HTML SSR ==="
LH=$(curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/" | grep -c "localhost:4321")
echo "Coincidencias 'localhost:4321': $LH   (esperado: 0)"
echo

echo "=== 2) Canonical / OG / Twitter con dominio real ==="
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/" | grep -oE '(canonical|og:url|og:image|twitter:url|twitter:image)[^"]*"[^"]+"' | head
echo

echo "=== 3) Title limpio (sin pipe huerfano) ==="
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/" | grep -oE '<title>[^<]+</title>'
echo "(esperado: <title>Metamorfosis Real</title>)"
echo

echo "=== 4) Robots meta en home (debe ser index, follow, ...) ==="
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/" | grep -oE 'name="robots"[^>]*'
echo

echo "=== 5) Robots meta en /login (debe ser noindex, nofollow) ==="
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/login" | grep -oE 'name="robots"[^>]*'
echo

echo "=== 6) Sitemap responde con URLs del dominio real ==="
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/sitemap.xml" | head -8
echo

echo "=== 7) JSON-LD Organization presente ==="
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/" | grep -c '"@type":"Organization"'
echo "(esperado: 1)"
echo

echo "=== 8) og:site_name y og:locale ==="
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" "$BASE/" | grep -oE '(og:site_name|og:locale)[^>]*'
echo

echo "=== Done ==="
