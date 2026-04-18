<p align="center">
  <h1 align="center">🎬 OTT → Trakt Sync</h1>
  <p align="center">
    <strong>Automatically sync trending movies &amp; TV shows from your favourite OTT platforms straight to your Trakt lists.</strong>
  </p>
  <p align="center">
    <a href="https://pratiks360.github.io/ott-to-trakt-in/"><img src="https://img.shields.io/badge/🚀_Live_App-Open_Dashboard-e11d48?style=for-the-badge" alt="Live App"></a>
    <img src="https://img.shields.io/badge/Built_With-React_+_Vite-61dafb?style=for-the-badge&logo=react&logoColor=white" alt="React + Vite">
    <img src="https://img.shields.io/badge/API-Trakt_+_JustWatch-ed1c24?style=for-the-badge" alt="Trakt + JustWatch">
  </p>
</p>

---

## ✨ What Is This?

**OTT → Trakt Sync** is a sleek, browser-based dashboard that pulls the **top trending & popular movies and TV shows** from streaming platforms like Netflix, Prime Video, JioHotstar, and more — then pushes them directly into your **Trakt.tv** custom lists.

No servers. No backend. Everything runs in your browser.

> 🌐 **Try it now →** [pratiks360.github.io/ott-to-trakt-in](https://pratiks360.github.io/ott-to-trakt-in/)

---

## 🎯 Features

| Feature | Description |
|---|---|
| 🔄 **Multi-Platform Sync** | Sync 6 pre-configured Indian OTT platforms — Netflix, Prime Video, JioHotstar, Zee5, Sony Liv, Apple TV — or add your own |
| 📊 **Algorithm Choice** | Pick between **Popular** (stable catalog hits), **Trending** (current hype), or **Both Merged** (deduplicated best-of-both) |
| 🌍 **Country & Language** | Configure any JustWatch-supported country (`IN`, `US`, `GB`, etc.) and language (`en`, `hi`, `fr`, etc.) |
| 🖼️ **Poster Previews** | After syncing, see clickable movie/show posters inline in the terminal — click to open on IMDB |
| 🧹 **Auto List Cleanup** | Old items are automatically cleared before pushing fresh content, keeping your Trakt lists always up-to-date |
| ➕ **Custom Platforms** | Add any streaming service supported by JustWatch with its package shortcode |
| 💾 **Persistent Settings** | All credentials and preferences are saved to your browser's `localStorage` — no re-entry needed |
| 🔐 **Secure OAuth** | Full Trakt OAuth PIN flow — your credentials never leave your browser |

---

## 🚀 Quick Start (Use Online)

The fastest way to get going — **zero installation**:

### Step 1 · Create a Trakt API App

1. Go to **[trakt.tv/oauth/applications/new](https://trakt.tv/oauth/applications/new)**
2. Fill in the form:
   - **Name**: anything you like (e.g. `OTT Sync`)
   - **Redirect URI**: `urn:ietf:wg:oauth:2.0:oob`
   - **Permissions**: check `/users` at minimum
3. Click **Save App**
4. Copy your **Client ID** and **Client Secret** — you'll need both

### Step 2 · Create Your Trakt Lists

Create one list per platform you want to sync. Go to **[trakt.tv/users/YOUR_USERNAME/lists](https://trakt.tv/users/)** and create lists with slug names matching your setup:

| Platform | Suggested List Slug |
|---|---|
| Netflix | `netflix-india` |
| Amazon Prime | `prime-india` |
| JioHotstar | `hotstar-india` |
| Zee5 | `zee5-india` |
| Sony Liv | `sonyliv-india` |
| Apple TV | `appletv-india` |

> 💡 The slug is the URL-friendly name that appears in the list URL.  
> For example, a list called "Netflix India" gets the slug `netflix-india`.

### Step 3 · Open the Dashboard

1. Go to **[pratiks360.github.io/ott-to-trakt-in](https://pratiks360.github.io/ott-to-trakt-in/)**
2. Click **⚙️ Settings** in the top right
3. Fill in:
   - **Trakt Username** — your trakt.tv username
   - **Client ID** — from Step 1
   - **Client Secret** — from Step 1
   - Click the **"Get PIN / Auth Code →"** link, authorize, and paste the PIN
4. Close settings and hit **🔄 Sync All** — done!

---

## 🖥️ Run Locally

If you prefer running the app on your own machine (avoids CORS proxy dependency):

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or above
- A Trakt API application (see [Step 1](#step-1--create-a-trakt-api-app) above)

### Installation

```bash
# Clone the repository
git clone https://github.com/pratiks360/ott-to-trakt-in.git
cd ott-to-trakt-in

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will open at `http://localhost:5173` (or the next available port).

### Production Build

```bash
npm run build
npm run preview
```

---

## ⚙️ Settings Reference

Open the ⚙️ Settings modal from the top-right corner of the dashboard:

| Setting | What It Does |
|---|---|
| **Trakt Username** | Your trakt.tv profile username |
| **Client ID** | Your Trakt API application's Client ID |
| **Client Secret** | Your Trakt API application's Client Secret |
| **Auth Code** | The PIN you get after authorizing with Trakt (one-time use; token is cached) |
| **Country Code** | 2-letter ISO code for JustWatch region (e.g. `IN`, `US`, `GB`, `DE`) |
| **Language** | 2-letter ISO language code (e.g. `en`, `hi`, `fr`) |
| **Items to Fetch** | Number of movies/shows to pull per type per platform (default: `10`) |
| **Algorithm Sort By** | `Popular` = catalog staples · `Trending` = current hype · `Both` = merged & deduplicated |

---

## 🧩 How It Works

```
┌──────────────┐     GraphQL      ┌──────────────┐     REST API      ┌──────────────┐
│              │  ──────────────►  │              │  ──────────────►  │              │
│   Dashboard  │  Popular/Trending│   JustWatch   │   OAuth + Push   │   Trakt.tv   │
│   (Browser)  │  ◄──────────────  │   GraphQL    │  ◄──────────────  │   Lists      │
│              │   Movies/Shows   │              │   Sync Status     │              │
└──────────────┘                  └──────────────┘                   └──────────────┘
```

1. **Fetch** — The app queries JustWatch's GraphQL API for trending/popular titles on each OTT platform
2. **Filter** — Only titles with valid TMDB or IMDB IDs and matching monetization types (`FLATRATE`, `FREE`, `ADS`) are kept
3. **Clean** — Existing items in your Trakt list are cleared to prevent duplicates
4. **Push** — Fresh items are posted to your Trakt custom list via their REST API
5. **Display** — Posters of synced titles appear in the terminal as clickable IMDB links

---

## 🛠️ Tech Stack

- **React 19** — UI framework
- **Vite 8** — Lightning-fast build tool
- **JustWatch GraphQL API** — OTT catalog data (unofficial)
- **Trakt.tv REST API** — List management via OAuth
- **GitHub Actions** — Automated deployment to GitHub Pages
- **Vanilla CSS** — Glassmorphism design with custom properties

---

## 📝 Adding Custom Platforms

Know the JustWatch shortcode for a platform? You can add it right from the dashboard:

1. Click **+ Add Platform**
2. Enter the **Platform Name** (e.g. `Hulu`)
3. Enter the **JustWatch Shortcode** (e.g. `hlu`)
4. Enter your **Trakt List Slug** (e.g. `hulu-us`)
5. Click **Add Integration** — it appears alongside your other platforms instantly

> 🔍 To find a platform's JustWatch shortcode, visit [justwatch.com](https://www.justwatch.com), navigate to a provider page, and inspect the network requests — or check community-maintained lists on GitHub.

---

## ⚠️ Important Notes

- **JustWatch API**: This project uses JustWatch's *unofficial* internal GraphQL endpoint. It may change without notice. This app is intended for **personal, non-commercial use only**.
- **CORS Proxy**: The hosted version uses [corsproxy.io](https://corsproxy.io) to bypass browser CORS restrictions. If the proxy is down, run the app locally instead.
- **Token Expiry**: If your Trakt token expires, the app will auto-clear it and prompt you to generate a new Auth Code via Settings.

---

## 📄 License

This project is open source and available for personal use.

---

<p align="center">
  <sub>Built with ❤️ for movie lovers who want their Trakt lists always fresh.</sub>
</p>
