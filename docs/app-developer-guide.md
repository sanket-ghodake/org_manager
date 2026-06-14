# SG Forge Developer Integration Guide

This guide describes how to build, test, and integrate external applications into the SG Forge platform in under 30 minutes.

---

## 1. Core Architecture
SG Forge functions as an operating system. External applications run as independent services (written in any language: Go, Python, Node.js, React, etc.) and are presented securely within the platform portal via an iframe.

```text
  SG Forge Portal (Host) <--- [ postMessage ] ---> App Iframe (Frontend)
         |                                                 |
         |                                           [ REST HTTP ]
         v                                                 v
  SSO / DB / Audit APIs <--------------------------- App Backend Service
```

---

## 2. Step 1: Create the App Manifest (`app.json`)
Every application must declare a manifest `app.json` inside its folder under `src/apps/<app-slug>/`. This specifies metadata, entry URLs, database preferences, and permission scopes.

Example `app.json`:
```json
{
  "id": "my-custom-app",
  "slug": "my-custom-app",
  "version": "1.0.0",
  "name": "Custom Operations Panel",
  "description": "Performs custom inventory logs and asset allocations.",
  "developer": "Corporate IT Division",
  "entryPoint": "http://localhost:8090/",
  "icon": "terminal",
  "routingMode": "iframe",
  "database": {
    "requiresIsolatedSchema": false
  },
  "requiredBasePermissions": [
    "user.profile.read"
  ]
}
```

---

## 3. Step 2: Implement the Frontend Handshake
When a user launches your application, SG Forge embeds your `entryPoint` url inside an iframe, appending a temporary single-use `code` query parameter:
```text
http://localhost:8090/?code=auth_code_xyz123...
```

### In Your Frontend (HTML/JS):
Initialize the client, check for the code, and pass it to your backend service to exchange for an access token:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
</head>
<body>
  <h1>Hello Forge</h1>
  <div id="user">Loading profile...</div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // Send code to your own backend
      fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      .then(res => res.json())
      .then(data => {
        document.getElementById('user').innerText = `Logged in as: ${data.user.name}`;
      });
    }
  </script>
</body>
</html>
```

---

## 4. Step 3: Implement the Backend OAuth Exchange
Your backend receives the code from the frontend, queries your credentials, and exchanges it at the SG Forge Core REST endpoint.

### Python Example:
```python
import urllib.request
import json

def exchange_code_with_forge(code):
    portal_url = "http://localhost:3001/api/v1/auth/exchange"
    body = json.dumps({
        "code": code,
        "client_id": "YOUR_CLIENT_ID", # Obtained from App Registry or DB
        "client_secret": "YOUR_CLIENT_SECRET"
    }).encode("utf-8")

    req = urllib.request.Request(
        portal_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))
```

### Go Example:
```go
type ExchangePayload struct {
	Code         string `json:"code"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

func exchangeCode(code string) (*Session, error) {
	payload := ExchangePayload{
		Code:         code,
		ClientID:     "YOUR_CLIENT_ID",
		ClientSecret: "YOUR_CLIENT_SECRET",
	}
	body, _ := json.Marshal(payload)
	
	resp, err := http.Post("http://localhost:3001/api/v1/auth/exchange", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var session Session
	err = json.NewDecoder(resp.Body).Decode(&session)
	return &session, err
}
```

---

## 5. Step 4: Write Audit Logs
External apps should log sensitive security events or access violations to the central SG Forge audit logs repository.

* **Endpoint:** `POST http://localhost:3001/api/v1/audit/log`
* **Authorization Header:** `Bearer <access_token>`
* **Payload Structure:**
  ```json
  {
    "action": "document.deleted",
    "severity": "WARN",
    "payload": {
      "docId": "doc_xyz",
      "title": "Confidential Spec"
    }
  }
  ```

---

## 6. Step 5: Test & Register Your App
1. Place your app folder under `src/apps/<app-slug>`.
2. Ensure your backend service is running (e.g. at `http://localhost:8090`).
3. Log into SG Forge as an Administrator.
4. Navigate to **App Registry** in the sidebar.
5. Click **Scan & Re-sync Apps**.
6. Find your app in the list and toggle **Enabled**.
7. Your app is now registered and will appear in the navigation menu!
