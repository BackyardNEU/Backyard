#!/usr/bin/env bash
# Prints a Supabase access token for use with the admin endpoints.
#
#   export JWT=$(./scripts/get-jwt.sh)
#
# PASSWORD ACCOUNTS ONLY. If you signed up with Google there is no password to give,
# and this will fail with "Invalid login credentials". Use the browser instead:
#
#   1. Open the app in Chrome, signed in
#   2. Cmd+Option+J for the console
#   3. If it refuses to paste, type:  allow pasting  then Enter
#   4. Paste:
#        copy(JSON.parse(Object.entries(localStorage)
#          .find(([k]) => k.startsWith('sb-') && k.endsWith('-auth-token'))[1]).access_token)
#   5. The token is on your clipboard — export JWT="<paste>" in your terminal
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
    reason = data.get("error_description") or data.get("msg") or str(data)
    if "credentials" in reason.lower():
        reason += ("\n\nIf you signed in with Google there is no password on this account. "
                   "See the browser instructions at the top of this script.")
    sys.exit("Login failed: " + reason)
')

printf '%s\n' "$TOKEN"
