#!/usr/bin/env bash
# Prints a Supabase access token for use with the admin endpoints.
#
#   export JWT=$(./scripts/get-jwt.sh)
#
# The alternative is digging the token out of browser local storage, which is fiddly
# and easy to get wrong. This asks for the password with `read -s`, so it is never
# echoed and never lands in shell history — unlike pasting the same curl inline.
#
# Tokens last about an hour. Re-run when calls start returning 401.

set -euo pipefail

cd "$(dirname "$0")/.."

for f in .env.local .env; do
  if [ -f "$f" ]; then
    # shellcheck disable=SC1090
    set -a; . "./$f"; set +a
    break
  fi
done

SUPABASE_URL="${VITE_SUPABASE_URL:-}"
ANON_KEY="${VITE_SUPABASE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "Could not read VITE_SUPABASE_URL / VITE_SUPABASE_KEY from .env.local" >&2
  exit 1
fi

# Prompts go to stderr so `$(...)` captures only the token.
printf 'Email: ' >&2
read -r EMAIL
printf 'Password: ' >&2
read -rs PASSWORD
printf '\n' >&2

RESPONSE=$(curl -sS -X POST "${SUPABASE_URL%/}/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<JSON
{"email":$(printf '%s' "$EMAIL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),"password":$(printf '%s' "$PASSWORD" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}
JSON
)

TOKEN=$(printf '%s' "$RESPONSE" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit("Could not parse the auth response")
if "access_token" in data:
    print(data["access_token"])
else:
    sys.exit("Login failed: " + str(data.get("error_description") or data.get("msg") or data))
')

printf '%s\n' "$TOKEN"
