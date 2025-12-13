# AI Analysis: proof.clavastack.com

## Project Overview

This is a **tamper-evident bag verification system** for Specter Hardware Wallets. It uses AI-powered OCR (Google Gemini) to extract serial numbers from photos and creates immutable Bitcoin blockchain timestamps via OpenTimestamps.

---

## Why It Works

### 1. Clean Architecture Separation

```
Frontend (Static)              Backend (Cloud Run)           External Services
     |                              |                              |
     |  POST /api/verify            |                              |
     +----------------------------->+                              |
     |  + X-Auth-Token              |                              |
     |  + Base64 Image              |                              |
     |                              +----------------------------->|
     |                              |  Gemini AI API               |
     |                              |  (OCR Analysis)              |
     |                              |<-----------------------------+
     |<-----------------------------+                              |
     |  JSON [{bagId, version,      |                              |
     |         packer}]             |                              |
     |                              |                              |
     +------------------------------------------------------>|
     |               OpenTimestamps (Bitcoin Blockchain)           |
     |<------------------------------------------------------+
```

**Key Points:**
- **Stateless Backend**: No database required - each request is independent
- **API Key Protection**: Gemini API key is hidden in Cloud Run environment variables, never exposed to frontend
- **Token Authentication**: All API calls require `X-Auth-Token` header

### 2. Smart OCR Prompt Engineering

The backend uses a carefully crafted prompt that:
- Explicitly defines expected output format (JSON array)
- Provides concrete examples for the AI
- Lists known packers ("Schnuartz") to improve recognition
- Uses `responseMimeType: "application/json"` to force structured output

### 3. Majority Principle Algorithm

When OCR can't read certain values, the backend applies a clever deduplication:
```javascript
// If 5 bags have version "v1.9.0" and 1 has "UNKNOWN"
// The UNKNOWN gets replaced with "v1.9.0"
```

This improves data quality when some bag labels are partially obscured.

### 4. Bitcoin Blockchain Timestamps

Using OpenTimestamps library to create cryptographic proofs:
1. Hash the bag data (SHA-256)
2. Submit to multiple calendar servers
3. Wait for Bitcoin block confirmation (few hours)
4. Proof becomes immutable and independently verifiable

---

## Important Technical Details

### Backend (index.js)

| Setting | Value | Purpose |
|---------|-------|---------|
| **Port** | 8080 | Cloud Run requirement |
| **Payload Limit** | 50MB | Supports high-res images |
| **CORS** | Restricted | Only allows `proof.clavastack.com` and localhost |
| **Model** | `gemini-2.5-flash` | Fast, cost-effective OCR |

### Backend URL

```
https://secure-ai-proxy-server-187831042201.europe-west1.run.app
```

### Data Storage

- **localStorage keys**:
  - `auth_token`: Authentication token
  - `bag_timestamps`: All timestamp proofs (JSON object)
  - `language`: UI language preference (en/de)

---

## Error Analysis

### Errors You're Seeing

#### 1. Tailwind CDN Warning (Not a Bug)
```
cdn.tailwindcss.com should not be used in production
```
**Cause**: Using Tailwind CDN instead of compiled CSS
**Impact**: Slower page loads, larger bundle
**Fix**: Use Tailwind CLI to build production CSS

#### 2. Chrome Extension Errors (Not Your Code)
```
content_script.js:5539 Uncaught (in promise) TypeError: codes.forEach is not a function
chrome-extension://invalid/:1 Failed to load resource
```
**Cause**: Browser extension (likely translation/language extension) failing
**Impact**: None to your application
**Fix**: Disable problematic extensions when testing

#### 3. CORS Error from OpenTimestamps Calendar
```
Access to fetch at 'https://ots.btc.catallaxy.com/digest' from origin 'https://proof.clavastack.com'
has been blocked by CORS policy
```
**Cause**: One of the 4 calendar servers (`ots.btc.catallaxy.com`) doesn't allow browser requests
**Impact**: Minor - 3 other calendars still work successfully
**Fix**: Cannot fix (third-party server). The OpenTimestamps library handles this gracefully.

#### 4. Invalid Date Error
```
Verification error: RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
    at verifyTimestamp (add/:574:62)
```
**Cause**: OpenTimestamps returns invalid/undefined unix timestamp during verification
**Impact**: Verification fails for some timestamps
**Fix Needed**: Add validation before creating Date object (already partially added in code but may need strengthening)

#### 5. LocalStorage Quota Exceeded (CRITICAL)
```
QuotaExceededError: Failed to execute 'setItem' on 'Storage':
Setting the value of 'bag_timestamps' exceeded the quota.
```
**Cause**: Storing too much data (potentially large base64 images) in localStorage
**Impact**: Application crashes when saving new timestamps
**Root Cause**: The code was storing `imageData` (full base64 images) in localStorage

**Current Mitigation** (in code):
```javascript
// Note: imageData not stored to avoid localStorage quota issues
// Also: Remove old imageData if present
if (existing.imageData) {
    delete existing.imageData;
}
```

---

## Potential Problems & Risks

### 1. Security Concerns

| Issue | Severity | Description |
|-------|----------|-------------|
| **CORS `*`** | Medium | Backend allows requests from ANY domain. Should restrict to `proof.clavastack.com` |
| **Token in localStorage** | Low | Auth token stored in browser - vulnerable to XSS |
| **No Rate Limiting** | Medium | API endpoint could be abused |

### 2. Data Persistence

| Issue | Severity | Description |
|-------|----------|-------------|
| **localStorage Only** | High | All data lost if user clears browser data |
| **No Backup** | High | No server-side storage of proofs |
| **Cross-Device** | Medium | Data doesn't sync between devices |

### 3. OpenTimestamps Dependencies

| Issue | Severity | Description |
|-------|----------|-------------|
| **Calendar Server Availability** | Low | Relies on third-party servers |
| **Verification Delay** | Low | Takes hours for Bitcoin confirmation |
| **Local Bitcoin Node** | Info | Lite-client verification (no local node needed, but less trust-minimized) |

### 4. Gemini API Risks

| Issue | Severity | Description |
|-------|----------|-------------|
| **API Cost** | Medium | Each image analysis costs money |
| **Rate Limits** | Medium | Google may throttle requests |
| **Model Changes** | Low | AI behavior could change with model updates |
| **Accuracy** | Medium | OCR isn't 100% accurate - human verification recommended |

---

## Architecture Diagram

```
                                   +-------------------+
                                   |  Hostinger        |
                                   |  Static Hosting   |
                                   +-------------------+
                                           |
                              +------------+------------+
                              |                         |
                    +---------v--------+      +---------v--------+
                    |   index.html     |      |  add/index.html  |
                    |   (Main List)    |      |   (Add Proof)    |
                    +--------+---------+      +---------+--------+
                             |                          |
                             |     localStorage         |
                             |   +---------------+      |
                             +-->| bag_timestamps |<----+
                                 | auth_token     |
                                 | language       |
                                 +---------------+
                                         |
                    +--------------------+--------------------+
                    |                                         |
          +---------v---------+                    +----------v---------+
          |  Google Cloud Run |                    |   OpenTimestamps   |
          |  (Backend Proxy)  |                    |   Calendar Servers |
          +---------+---------+                    +----------+---------+
                    |                                         |
          +---------v---------+                    +----------v---------+
          |   Google Gemini   |                    |  Bitcoin Blockchain |
          |   AI (OCR)        |                    |   (Immutable Proof) |
          +-------------------+                    +--------------------+
```

---

## Recommendations

### Immediate Fixes (COMPLETED)

1. **Fix LocalStorage Quota**: DONE - Implemented automatic cleanup, removes imageData before saving
2. **Add Error Handling**: DONE - Strengthened date validation with sanity checks (2009-2100 range)
3. **Consistent Backend URL**: DONE - Updated CLAUDE.md to match actual backend URL

### Production Improvements (COMPLETED)

1. **Restrict CORS**: DONE - Changed from `*` to allowlist (proof.clavastack.com + localhost)
2. **Build Tailwind**: DONE - Added Tailwind CLI build (`npm run build:css`), HTML files now use compiled CSS

### Future Improvements

1. **Add Server Storage**: Implement database backup for proofs
2. **Rate Limiting**: Add request limits to prevent abuse
3. **Export/Import**: Allow users to backup their data
4. **Batch Processing**: Upload multiple images at once
5. **Progress Indicator**: Show blockchain confirmation progress
6. **Email Notifications**: Notify when timestamp is confirmed

---

## Conclusion

The project is well-designed with a clean separation of concerns. All critical issues have been fixed:
- **localStorage quota**: Fixed with automatic cleanup
- **Date validation**: Fixed with comprehensive validation
- **CORS security**: Fixed with restricted origins
- **Tailwind production**: Fixed with CLI build

The architecture is solid. Third-party CORS issues (OpenTimestamps calendar server) cannot be fixed but are handled gracefully (3/4 servers work).
