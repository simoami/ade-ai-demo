#!/usr/bin/env bash
set -euo pipefail
base="${1:-http://localhost:3000}"
response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT
request() {
  code=$(curl --silent --show-error --max-time 30 -o "$response_file" -w '%{http_code}' "$@")
  cat "$response_file"
  printf '\nHTTP %s\n' "$code"
}
request -H 'Content-Type: application/json' -d '{"fixtureId":"clinical-20"}' "$base/api/documents"
[[ "$code" == 202 ]] || exit 1
document_id=$(node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).documentId)' "$response_file")
url="$base/api/documents/$document_id"
request "$url"
[[ "$code" == 200 ]] || exit 1
for attempt in {1..60}; do
  request -H 'Content-Type: application/json' -d '{"type":"redaction.update","redactionId":"f5947cf9-48ef-4354-8c39-c1bba1444319","status":"accepted"}' "$url/review"
  [[ "$code" == 202 ]] && break
  [[ "$code" == 409 ]] || exit 1
  sleep 1
done
[[ "$code" == 202 ]] || { printf 'Review hook did not become ready\n' >&2; exit 1; }
request "$url"
[[ "$code" == 200 ]] || exit 1
request -H 'Content-Type: application/json' -d '{"type":"markReviewed"}' "$url/review"
[[ "$code" == 202 ]] || exit 1
for attempt in {1..60}; do
  request "$url"
  [[ "$code" == 200 ]] || exit 1
  state=$(node -e 'const fs = require("node:fs"); console.log(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).status)' "$response_file")
  if [[ "$state" == completed ]]; then
    node -e 'const assert = require("node:assert/strict"); const fs = require("node:fs"); const result = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).result; assert.equal(result.status, "reviewed"); assert.equal(result.refreshCount, 1)' "$response_file"
    exit 0
  fi
  [[ "$state" != failed && "$state" != cancelled ]] || exit 1
  sleep 1
done
printf 'Workflow did not complete within 60 polls\n' >&2
exit 1
