import urllib.request, json, ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 1. Login to get JWT
login_data = json.dumps({"username": "admin", "password": "admin123"}).encode()
req = urllib.request.Request(
    "http://localhost:3000/api/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=5) as r:
    resp = json.loads(r.read())
token = resp["data"]["token"]
print(f"JWT obtained: {token[:30]}...")

# 2. Call the new live enquiries endpoint
url = "http://localhost:3000/api/cctns/enquiries-live?timeFrom=04/01/2026&timeTo=04/01/2026"
req2 = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(req2, timeout=20) as r:
    data = json.loads(r.read())

print(f"success: {data['success']}")
print(f"total records: {data['data']['total']}")
if data["data"]["records"]:
    print("First record:")
    print(json.dumps(data["data"]["records"][0], indent=2, ensure_ascii=False))
else:
    print("No records for this date range.")
