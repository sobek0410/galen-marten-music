#!/usr/bin/env bash
# Resend sender for the Galen Marten newsletter skill.
#   send.sh test "Subject" email.html someone@example.com
#   send.sh broadcast "Subject" email.html [sendAt]
#   send.sh audience
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$SKILL_DIR/config.json"

cfg() { python3 -c "import json,sys; print(json.load(open('$CONFIG')).get('$1',''))" 2>/dev/null || true; }

API_KEY="${RESEND_API_KEY:-$(cfg api_key)}"
export API_KEY
AUDIENCE="${RESEND_AUDIENCE_ID:-$(cfg audience_id)}"
FROM="${RESEND_FROM:-$(cfg from)}"

[ -n "$API_KEY" ] || { echo "ERROR: no Resend API key (env RESEND_API_KEY or config.json api_key)"; exit 1; }

MODE="${1:-}"

if [ "$MODE" = "audience" ]; then
  curl -s "https://api.resend.com/audiences/$AUDIENCE/contacts" \
    -H "Authorization: Bearer $API_KEY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
contacts = d.get('data', [])
subbed = [c for c in contacts if not c.get('unsubscribed')]
print(f'audience {\"$AUDIENCE\"}: {len(subbed)} subscribed ({len(contacts)} total)')"
  exit 0
fi

SUBJECT="${2:?usage: send.sh test|broadcast SUBJECT file.html [to|sendAt]}"
HTML_FILE="${3:?missing html file}"
[ -f "$HTML_FILE" ] || { echo "ERROR: $HTML_FILE not found"; exit 1; }
[ -n "$FROM" ] || { echo "ERROR: no 'from' configured"; exit 1; }

if [ "$MODE" = "test" ]; then
  TO="${4:?test mode needs a recipient}"
  python3 - "$HTML_FILE" "$FROM" "$TO" "$SUBJECT" <<'EOF'
import json, sys, urllib.request, urllib.error, os
html_file, sender, to, subject = sys.argv[1:5]
html = open(html_file).read().replace('{{{RESEND_UNSUBSCRIBE_URL}}}', '#unsubscribe-preview')
body = {"from": sender, "to": [to], "subject": "[TEST] " + subject, "html": html}
req = urllib.request.Request("https://api.resend.com/emails",
    data=json.dumps(body).encode(),
    headers={"Authorization": "Bearer " + os.environ["API_KEY"], "Content-Type": "application/json", "User-Agent": "curl/8.4.0"})
try:
    print(json.load(urllib.request.urlopen(req)))
except urllib.error.HTTPError as e:
    print("RESEND ERROR:", e.read().decode()[:400]); sys.exit(1)
EOF
elif [ "$MODE" = "broadcast" ]; then
  [ -n "$AUDIENCE" ] || { echo "ERROR: no audience_id configured"; exit 1; }
  SENDAT="${4:-}"
  python3 - "$HTML_FILE" "$FROM" "$AUDIENCE" "$SUBJECT" "$SENDAT" <<'EOF'
import json, sys, urllib.request, urllib.error, os
html_file, sender, audience, subject, sendat = sys.argv[1:6]
key = os.environ["API_KEY"]
def call(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "curl/8.4.0"})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print("RESEND ERROR:", e.read().decode()[:400]); sys.exit(1)
b = call("https://api.resend.com/broadcasts", {
    "audience_id": audience, "from": sender, "subject": subject,
    "html": open(html_file).read(), "name": subject,
})
bid = b["id"]
send_body = {"scheduled_at": sendat} if sendat else {}
r = call(f"https://api.resend.com/broadcasts/{bid}/send", send_body)
print(f"broadcast {bid} -> {'scheduled for ' + sendat if sendat else 'sending now'} ({r})")
EOF
else
  echo "usage: send.sh test|broadcast|audience ..."; exit 1
fi
