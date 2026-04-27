import urllib.request, urllib.parse, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

TOKEN_API     = "http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken"
COMPLAINT_API = "http://164.100.137.228/homedashboard/api/HomeDashboard/ComplaintData"
SECRET_KEY    = "UserHryDashboard"

def get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return None, str(e).encode()

# Get token
_, body = get(f"{TOKEN_API}?SecretKey={SECRET_KEY}")
token = body.decode("utf-8").strip().strip('"')
print(f"Token: {token[:40]}...\n")
auth = {"Authorization": f"Bearer {token}"}

tests = [
    ("1. No params at all",                      COMPLAINT_API),
    ("2. Wide range: 01/01/2022-04/01/2026",     COMPLAINT_API + "?TimeFrom=01/01/2022&TimeTo=04/01/2026"),
    ("3. Single day with likely data (Oct 2022)", COMPLAINT_API + "?TimeFrom=10/01/2022&TimeTo=10/01/2022"),
    ("4. Full month (Jan 2025)",                  COMPLAINT_API + "?TimeFrom=01/01/2025&TimeTo=01/31/2025"),
    ("5. No params, NO auth header",              COMPLAINT_API),
    ("6. Future date (Dec 2030)",                 COMPLAINT_API + "?TimeFrom=12/31/2030&TimeTo=12/31/2030"),
]

for label, url in tests:
    headers = auth if "No auth" not in label else {}
    s, b = get(url, headers)
    decoded = b.decode("utf-8", errors="replace")
    print(f"[{label}]")
    print(f"  HTTP Status : {s}")
    print(f"  Response    : {decoded[:200]}")
    print()
