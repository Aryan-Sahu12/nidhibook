# NidhiBook Desktop

A production-ready cross-platform desktop application built with **Tauri v2**, **Firebase Authentication**, and **SQLite** — ready to extend with your business features.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Firebase Setup](#firebase-setup)
4. [Running Locally](#running-locally)
5. [Building Installers](#building-installers)
6. [Database](#database)
7. [Project Structure](#project-structure)
8. [Environment Variables](#environment-variables)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Node.js

Install Node.js **v18 or later**: https://nodejs.org/

Verify:

```bash
node --version   # v18+
npm --version    # v9+
```

### Rust

Install Rust via rustup: https://rustup.rs/

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup update stable
```

Verify:

```bash
rustc --version
cargo --version
```

### Platform Dependencies

**macOS** — Xcode Command Line Tools:

```bash
xcode-select --install
```

**Windows** — Install Visual Studio Build Tools with the "Desktop development with C++" workload:  
https://visualstudio.microsoft.com/visual-cpp-build-tools/

**Linux (Ubuntu/Debian)**:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Linux (Fedora/RHEL)**:

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

---

## Project Setup

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd NidhiBook-Desktop

# 2. Install Node.js dependencies
npm install

# 3. Copy the environment template and fill in your Firebase credentials
cp .env.example .env
```

Edit `.env` with your Firebase project credentials (see [Firebase Setup](#firebase-setup)).

---

## Firebase Setup

1. Go to https://console.firebase.google.com/
2. Create a new project (or use an existing one)
3. Enable **Authentication** → **Sign-in method** → **Email/Password**
4. Go to **Project Settings** → **General** → **Your apps** → click the web icon `</>`
5. Register a web app and copy the configuration object
6. Fill in `.env`:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc
```

> **Note**: Firebase is only used for authentication. All CRUD data is stored locally in SQLite.

### Create a Test User

In the Firebase Console:

1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Enter an email and password
4. Use these credentials to sign in to the desktop app

---

## Running Locally

```bash
npm run dev
```

This command:
1. Starts the Vite dev server on port 1420
2. Compiles the Rust/Tauri backend
3. Opens the desktop window

> The first run takes 2–5 minutes to compile Rust dependencies. Subsequent runs are much faster.

---

## Building Installers

### Generate App Icons (first time only)

Place a square PNG (1024×1024) at `src-tauri/icons/app-icon.png`, then:

```bash
npm run tauri -- icon src-tauri/icons/app-icon.png
```

This generates all required icon formats automatically.

### Production Build (current platform)

```bash
npm run build
```

Output: `src-tauri/target/release/bundle/`

### Windows Installer (MSI + NSIS)

```bash
npm run build:windows
```

Requires a Windows machine or cross-compilation setup.  
Output: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/`

### macOS DMG

```bash
npm run build:mac
```

Requires a macOS machine.  
Output: `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/`

> For Intel Macs, use target `x86_64-apple-darwin`.  
> First, install: `rustup target add x86_64-apple-darwin`

### Linux (AppImage + DEB + RPM)

```bash
npm run build:linux
```

Output: `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/`

---

## Database

### Technology

[SQLite](https://sqlite.org/) via [`tauri-plugin-sql`](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql).

### Database Location

The SQLite file (`nidhibook.db`) is stored in the platform's application data directory:

| Platform | Path                                                             |
|----------|------------------------------------------------------------------|
| macOS    | `~/Library/Application Support/com.nidhibook.desktop/nidhibook.db` |
| Windows  | `%APPDATA%\com.nidhibook.desktop\nidhibook.db`                  |
| Linux    | `~/.local/share/com.nidhibook.desktop/nidhibook.db`             |

### Schema

The database is automatically created and migrated on startup.

```sql
CREATE TABLE IF NOT EXISTS users_local (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

### Offline Support

After signing in, all CRUD operations work completely offline. Firebase is only contacted during:
- Sign in
- Session validation on app startup

---

## Project Structure

```
NidhiBook-Desktop/
│
├── index.html                  # HTML shell entry point
├── vite.config.js              # Vite bundler configuration
├── package.json                # Node deps + npm scripts
├── .env.example                # Environment variable template
├── .gitignore
│
├── src/                        # Frontend source (HTML/CSS/JS)
│   ├── app.js                  # ✦ App entry: auth guard + router
│   │
│   ├── assets/
│   │   └── style.css           # Global design system (tokens, components)
│   │
│   ├── firebase/
│   │   └── config.js           # Firebase config from env vars
│   │
│   ├── services/
│   │   ├── firebase.js         # ✦ Firebase auth service layer
│   │   └── db.js               # ✦ SQLite CRUD service layer
│   │
│   ├── pages/
│   │   ├── login.js            # Login page (render + form logic)
│   │   └── dashboard.js        # Dashboard page (CRUD UI)
│   │
│   ├── components/
│   │   └── toast.js            # Toast notification helper
│   │
│   └── database/
│       └── schema.sql          # SQL schema (documentation reference)
│
└── src-tauri/                  # Tauri / Rust backend
    ├── Cargo.toml              # Rust dependencies
    ├── build.rs                # Tauri build script
    ├── tauri.conf.json         # ✦ Tauri config (window, bundle, SQL)
    ├── capabilities/
    │   └── default.json        # Tauri v2 permissions
    ├── icons/                  # App icons (generate with tauri icon cmd)
    └── src/
        ├── main.rs             # Binary entry point
        └── lib.rs              # Plugin registration
```

> Files marked ✦ are the primary extension points.

---

## Environment Variables

All Firebase credentials must be prefixed with `VITE_` so Vite exposes them to the frontend bundle.

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `<project>.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Numeric sender ID |
| `VITE_FIREBASE_APP_ID` | Web app ID |

---

## Extending the Application

### Adding a new database table

1. Add `CREATE TABLE IF NOT EXISTS ...` to `src/services/db.js` → `initDb()`
2. Add CRUD functions in `src/services/db.js`
3. Create a new page in `src/pages/`
4. Import and call from `src/app.js`

### Adding a Rust command

In `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
fn my_command(arg: String) -> String {
    format!("Hello, {}!", arg)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![my_command])  // ← add
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

In JavaScript:

```js
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('my_command', { arg: 'World' });
```

---

## Troubleshooting

### `npm run dev` fails immediately

- Make sure Rust is installed: `rustc --version`
- Make sure platform dependencies are installed (see [Prerequisites](#prerequisites))
- Check that port 1420 is not in use: `lsof -i :1420`

### Firebase login fails with "auth/invalid-credential"

- Verify `.env` values are correct (no extra spaces, no quotes around values)
- Confirm Email/Password is enabled in Firebase Console → Authentication → Sign-in method
- Confirm the test user exists in Firebase Console → Authentication → Users

### "Database not initialized" error

- This means `initDb()` was not called or failed silently
- Check the DevTools console (right-click → Inspect in dev mode) for errors
- Verify that `sql:allow-load` permission is in `capabilities/default.json`

### Icons missing / build fails with icon error

Run:

```bash
npm run tauri -- icon src-tauri/icons/app-icon.png
```

You need a 1024×1024 PNG source image.

### Windows build fails: "linker not found"

Install Visual Studio Build Tools with the C++ workload:  
https://visualstudio.microsoft.com/visual-cpp-build-tools/

### macOS: "App is damaged and can't be opened"

The app is not code-signed. For distribution, sign with an Apple Developer certificate.  
For local testing: `sudo xattr -rd com.apple.quarantine /path/to/NidhiBook\ Desktop.app`

### Linux: WebKit not found

```bash
sudo apt install -y libwebkit2gtk-4.1-dev
```

---

## License

Proprietary — © Aryan Sahu & Company. All rights reserved.
