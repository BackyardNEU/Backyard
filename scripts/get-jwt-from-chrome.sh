#!/usr/bin/env bash
# Recovers a live Supabase access token from Chrome's on-disk local storage.
#
#   export JWT=$(./scripts/get-jwt-from-chrome.sh)
#
# The console-snippet route asks someone to run JavaScript in exactly the right tab and
# then paste the result into exactly the right shell quote. That is three chances to be
# in the wrong place, and the failure looks identical every time: a 401.
#
# Chrome keeps local storage in a LevelDB on disk, and a JWT is base64 text, so the
# tokens are greppable without touching the browser at all. Every candidate is decoded
# and checked for expiry, and the one with the latest expiry wins — old tokens from
# previous sessions are still sitting in those files.
#
# Password accounts can use get-jwt.sh instead. This one works regardless of how you
# signed in, including Google.

set -uo pipefail

PROFILE="${CHROME_PROFILE:-Default}"
LS_DIR="$HOME/Library/Application Support/Google/Chrome/$PROFILE/Local Storage/leveldb"

if [ ! -d "$LS_DIR" ]; then
  echo "No Chrome local storage at:" >&2
  echo "  $LS_DIR" >&2
  echo >&2
  echo "Available profiles:" >&2
  ls "$HOME/Library/Application Support/Google/Chrome/" 2>/dev/null \
    | grep -iE '^(Default|Profile )' | sed 's/^/  /' >&2
  echo >&2
  echo "Re-run with:  CHROME_PROFILE='Profile 1' $0" >&2
  exit 1
fi

# .log holds the most recent writes, so it usually has the freshest token.
CANDIDATES=$(strings "$LS_DIR"/*.ldb "$LS_DIR"/*.log 2>/dev/null \
  | grep -oE 'eyJhbGciOiJIUzI1[A-Za-z0-9_.-]{40,}' | sort -u)

if [ -z "$CANDIDATES" ]; then
  echo "No Supabase tokens found on disk." >&2
  echo "Log into the app in Chrome first, then re-run." >&2
  exit 1
fi

printf '%s\n' "$CANDIDATES" | python3 -c '
import base64, json, sys, time

def payload(tok):
    try:
        part = tok.split(".")[1]
        part += "=" * (-len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(part))
    except Exception:
        return None

now = time.time()
best, best_exp = None, 0
expired = 0

for tok in (line.strip() for line in sys.stdin if line.strip()):
    data = payload(tok)
    if not data or data.get("aud") != "authenticated":
        continue
    exp = data.get("exp", 0)
    if exp <= now:
        expired += 1
        continue
    if exp > best_exp:
        best, best_exp = tok, exp

if best:
    mins = int((best_exp - now) / 60)
    print(f"Found a token valid for another {mins} min.", file=sys.stderr)
    print(best)
else:
    print(f"Only expired tokens on disk ({expired} of them).", file=sys.stderr)
    print("Open the app in Chrome, make sure you are signed in, reload once, then re-run.",
          file=sys.stderr)
    sys.exit(1)
'
