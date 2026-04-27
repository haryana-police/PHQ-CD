"""
CCTNS API Test Script
Tests the full flow:
1. Get Token from ReqToken API
2. Try ComplaintData API with the token
3. Try ComplaintEnquiryData API with the token
4. Decrypt the response (if received)
"""

import urllib.request
import urllib.parse
import json
import base64
import ssl
import sys

# ─── CONFIG (from .env) ─────────────────────────────────────────────
SECRET_KEY     = "UserHryDashboard"
DECRYPT_KEY    = "O7yhrqWMMymKrM9Av64JkXo3GOoTebAyJlQ9diSxi0U="
TOKEN_API      = "http://api.haryanapolice.gov.in/cmDashboard/api/HomeDashboard/ReqToken"
COMPLAINT_API  = "http://164.100.137.228/homedashboard/api/HomeDashboard/ComplaintData"
ENQUIRY_API    = "http://api.haryanapolice.gov.in/cmdashboard/api/HomeDashboard/ComplaintEnquiryData"

# Ignore SSL errors for government APIs
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
            raw = r.read()
            return r.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return None, str(e).encode()

def try_decrypt(encrypted_text: str, key_b64: str) -> str:
    """Try AES-256-CBC decryption with Decrypt Key (base64)."""
    try:
        from Crypto.Cipher import AES
        from Crypto.Util.Padding import unpad
    except ImportError:
        return "[pycryptodome not installed — cannot decrypt]"

    try:
        key = base64.b64decode(key_b64)
        data = base64.b64decode(encrypted_text)
        # IV is first 16 bytes
        iv = data[:16]
        cipher_data = data[16:]
        cipher = AES.new(key, AES.MODE_CBC, iv)
        plaintext = unpad(cipher.decrypt(cipher_data), AES.block_size)
        return plaintext.decode("utf-8")
    except Exception as e:
        return f"[Decryption failed: {e}]"

# ─── STEP 1: Get Token ───────────────────────────────────────────────
print("=" * 60)
print("STEP 1: Fetching Bearer Token from ReqToken API")
print("=" * 60)

token_url = f"{TOKEN_API}?SecretKey={urllib.parse.quote(SECRET_KEY)}"
print(f"URL: {token_url}\n")

status, body = get(token_url)
print(f"HTTP Status: {status}")
print(f"Raw Response: {body[:500]}")

token = None
if status == 200:
    token_text = body.decode("utf-8", errors="replace").strip()
    print(f"\n✅ Token received: {token_text[:80]}...")
    token = token_text.strip('"').strip()
else:
    print(f"\n❌ Failed to get token (status {status})")

# ─── STEP 2: Complaint Data API ──────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 2: Fetching Complaint Data")
print("=" * 60)

complaint_url = f"{COMPLAINT_API}?TimeFrom=04/01/2026&TimeTo=04/01/2026"
print(f"URL: {complaint_url}")
headers = {}
if token:
    headers["Authorization"] = f"Bearer {token}"
    print(f"Authorization: Bearer {token[:40]}...\n")

status2, body2 = get(complaint_url, headers)
print(f"HTTP Status: {status2}")
print(f"Raw Response (first 500 chars): {body2[:500]}")

if status2 == 200 and body2:
    response_str = body2.decode("utf-8", errors="replace").strip()
    print("\n--- Attempting decryption ---")
    decrypted = try_decrypt(response_str.strip('"'), DECRYPT_KEY)
    print(f"Decrypted: {decrypted[:500]}")
else:
    print(f"\n❌ Complaint Data API returned status {status2}")

# ─── STEP 3: Complaint Enquiry Data API ─────────────────────────────
print("\n" + "=" * 60)
print("STEP 3: Fetching Complaint Enquiry Data")
print("=" * 60)

enquiry_url = f"{ENQUIRY_API}?TimeFrom=04/01/2026&TimeTo=04/01/2026"
print(f"URL: {enquiry_url}")

status3, body3 = get(enquiry_url, headers)
print(f"HTTP Status: {status3}")
print(f"Raw Response (first 500 chars): {body3[:500]}")

if status3 == 200 and body3:
    response_str3 = body3.decode("utf-8", errors="replace").strip()
    print("\n--- Attempting decryption ---")
    decrypted3 = try_decrypt(response_str3.strip('"'), DECRYPT_KEY)
    print(f"Decrypted: {decrypted3[:500]}")
else:
    print(f"\n❌ Enquiry API returned status {status3}")

# ─── STEP 4: District Master API (no auth needed) ────────────────────
print("\n" + "=" * 60)
print("STEP 4: Fetching District Master (public, no auth)")
print("=" * 60)

district_url = "https://api.haryanapolice.gov.in/eSaralServices/api/common/district"
print(f"URL: {district_url}\n")

status4, body4 = get(district_url)
print(f"HTTP Status: {status4}")
try:
    parsed = json.loads(body4)
    print(f"Districts count: {len(parsed) if isinstance(parsed, list) else 'N/A'}")
    print(f"Sample: {json.dumps(parsed[:3] if isinstance(parsed, list) else parsed, indent=2, ensure_ascii=False)[:600]}")
except:
    print(f"Raw: {body4[:500]}")

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
