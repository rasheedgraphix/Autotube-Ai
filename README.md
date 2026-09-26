# AutoTube Studio

Autonomous AI Video Production Studio (Shorts & Long-form Videos) with Google Gemini AI, Google Veo 3, ElevenLabs, and YouTube Data API.

## 🚀 GitHub Actions Auto-Deploy to GitHub Pages
This repository is configured with an automated CI/CD pipeline (`.github/workflows/deploy.yml`).

### Setup in GitHub:
1. Push this repository to GitHub.
2. In your repository, go to **Settings** -> **Pages**.
3. Under **Build and deployment** -> **Source**, select **GitHub Actions**.
4. Now, whenever you push or commit changes to `main` or `master`, GitHub Actions will automatically build and deploy your site to GitHub Pages!

### Local Development:
```bash
npm install
npm run dev
```

### Full Production Build:
```bash
npm run build
npm start
```
