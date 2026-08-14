#!/usr/bin/env bash
# Smoke test for the club onboarding flow.
#
# Checks the parts that can be checked from a terminal. It deliberately stops before
# signup and the wizard itself: those need a browser and a real inbox, and pretending
# otherwise would give false confidence in the half that matters most.
#
# Usage:
#   export API="https://your-backend.up.railway.app"
#   export JWT="ey..."           # see below
#   ./scripts/smoke-onboarding.sh                 # checks only
#   ./scripts/smoke-onboarding.sh <club-uuid>     # also mints a test link
#
# Getting JWT: log into the app in Chrome, DevTools -> Application -> Local Storage ->
# find the key starting "sb-" and ending "-auth-token", copy the access_token field.
# It expires after an hour; grab a fresh one if you start seeing 401s.

set -uo pipefail

API="${API:-}"
JWT="${JWT:-}"
CLUB_ID="${1:-}"

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAILED=1; }
info() { printf '  \033[2m%s\033[0m\n' "$1"; }
FAILED=0

if [ -z "$API" ] || [ -z "$JWT" ]; then
  echo "Set API and JWT first:"
  echo '  export API="https://your-backend.up.railway.app"'
  echo '  export JWT="ey..."'
  exit 1
fi

API="${API%/}"

echo
echo "Backend: $API"
echo

# ── 1. Is the API reachable at all ──────────────────────────────────────────
echo "1. Backend reachable"
health=$(curl -sS -o /dev/null -w '%{http_code}' "$API/api/health" 2>/dev/null)
if [ "$health" = "200" ]; then
  pass "/api/health returned 200"
else
  fail "/api/health returned ${health:-no response}"
  info "Wrong API url, or the service is down. Nothing below will work."
  exit 1
fi

# ── 2. Admin allowlist ──────────────────────────────────────────────────────
echo
echo "2. You are recognised as an admin"
admin=$(curl -sS -w '\n%{http_code}' "$API/api/admin/is-admin" -H "Authorization: Bearer $JWT")
code=$(printf '%s' "$admin" | tail -1)
case "$code" in
  200) pass "ADMIN_USER_IDS includes you" ;;
  401) fail "401 — JWT missing or expired. Grab a fresh one." ;;
  403) fail "403 — your user id is not in ADMIN_USER_IDS on Railway"
       info "Supabase -> Authentication -> Users -> your row -> copy the UID" ;;
  *)   fail "unexpected $code" ;;
esac

# ── 3. Unknown tokens are rejected cleanly ──────────────────────────────────
echo
echo "3. A bogus invite token is rejected"
bogus=$(curl -sS -o /dev/null -w '%{http_code}' "$API/api/invite/definitely-not-a-real-token")
if [ "$bogus" = "404" ]; then
  pass "404, as it should be"
else
  fail "expected 404, got $bogus"
fi

# ── 4. Onboarding admin routes are actually mounted ─────────────────────────
echo
echo "4. Onboarding admin routes are live"
pending=$(curl -sS -o /dev/null -w '%{http_code}' "$API/api/admin/onboarding/pending" \
  -H "Authorization: Bearer $JWT")
case "$pending" in
  200) pass "review queue responds" ;;
  401|403)
    # The route answered and demanded auth, which is the thing being checked here.
    # Whether this token is any good is check 2's job, not this one's.
    pass "route is mounted (returned $pending — auth issue, see check 2)" ;;
  404)
    fail "404 — the backend has not redeployed with this branch yet" ;;
  *)
    fail "review queue returned $pending" ;;
esac

# ── 5. Mint a link, only if a club was named ────────────────────────────────
if [ -n "$CLUB_ID" ]; then
  echo
  echo "5. Minting a test link for $CLUB_ID"
  mint=$(curl -sS -X POST "$API/api/admin/onboarding-links" \
    -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
    -d "{\"club_ids\":[\"$CLUB_ID\"]}")

  url=$(printf '%s' "$mint" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')
  result=$(printf '%s' "$mint" | sed -n 's/.*"result":"\([^"]*\)".*/\1/p')

  if [ -n "$url" ] && [ "$url" != "null" ]; then
    pass "minted ($result)"
    echo
    echo "  Open this in an incognito window:"
    printf '    \033[36m%s\033[0m\n' "$url"
    echo
    info "This is the only copy of that link — hashed at rest, cannot be re-shown."
  else
    case "$result" in
      skipped_has_owner) fail "that club already has an owner — pick an unclaimed one" ;;
      existing)          fail "that club already has a live link; re-run with rotate:true" ;;
      *)                 fail "no url returned"; info "$mint" ;;
    esac
  fi
else
  echo
  echo "5. Minting — skipped"
  info "Pass a club UUID to mint a test link:  ./scripts/smoke-onboarding.sh <uuid>"
  info "Find one in Supabase: select id, club_name from demo_club_data limit 5;"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo
if [ "$FAILED" = "1" ]; then
  echo "Some checks failed — fix those before going further."
  exit 1
fi

cat <<'DONE'
Terminal checks passed.

What this did NOT test, and what actually matters most — do it in a browser,
in an incognito window, using the link printed above:

  1. Open the link. Your club's name and logo should appear.
  2. Sign up with a real address you can read (a +test alias is fine).
  3. Confirm the email. You should land back on the wizard, not a 404.
  4. Fill in step 1, then CLOSE THE TAB and reopen the same link.
     Your answers must still be there. Clubs abandon halfway constantly.
  5. Upload a logo. It should appear.
  6. Finish the steps and hit Send for review.
  7. Approve it:
       curl "$API/api/admin/onboarding/pending" -H "Authorization: Bearer $JWT"
       curl -X POST "$API/api/admin/onboarding/<club-uuid>/approve" \
            -H "Authorization: Bearer $JWT"
  8. Check the club looks right in the main app.
  9. Clean up:
       curl -X POST "$API/api/admin/onboarding/<club-uuid>/unclaim" \
            -H "Authorization: Bearer $JWT"

If any step fails, write down exactly what happened and post it on PR #36.
Do not work around it — a problem here affects all 150 clubs.
DONE
