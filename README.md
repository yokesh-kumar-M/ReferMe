# ReferMe — AI Job Application Agent

> Detect job forms. Autofill everything. Generate cover letters. Track applications. All free, all local.

**Full instructions, feature walkthroughs, and FAQ are on the project website:**
👉 [referme-agent.vercel.app](https://referme-agent.vercel.app)

---

## Download

Get the latest packaged extension from the [Releases page](https://github.com/yokesh-kumar-M/ReferMe/releases/latest).

1. Download `extension.zip` from the latest release.
2. Unzip it.
3. Open Chrome → `chrome://extensions` → enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

---

## Development

```bash
npm install
npm run build:ext   # builds + zips → extension.zip and out/
```

Then load the `out/` directory in Chrome via **Load unpacked**.

To run the web dashboard locally:

```bash
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

---

## Releasing a new version

Push a semver tag to trigger the release workflow:

```bash
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions will build `extension.zip` and publish it as a GitHub Release automatically.

---

## Stack

- **Extension & Dashboard**: Next.js 16 (static export for extension, SSR for dashboard)
- **AI**: Groq `llama-3.3-70b-versatile` · Gemini 2.0 Flash
- **Backend**: Express proxy (Render)
- **Deployment**: Vercel (dashboard) · GitHub Releases (extension)
