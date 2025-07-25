# Dots Experiences Lambda

A serverless AWS Lambda function for managing Art Blocks composite token data, updating IPFS manifests (via Pinata), and triggering Art Blocks asset refreshes. Includes robust monitoring and deployment automation.

---

## 📁 Directory Structure

```
composite-lambda-function/
├── abis/           # Contract ABIs
├── config/         # Environment/config templates
├── docs/           # Documentation
├── monitoring/     # Monitoring scripts
├── policies/       # IAM/trust policy JSONs
├── scripts/        # Deployment/utility scripts
├── src/            # Main source code
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
```

---

## ⚡️ Setup & Configuration

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Environment variables:**
   - Copy `config/env-vars.example.json` to `config/env-vars.json` and fill in your secrets.
   - Or create a `.env` file for local testing.

---

## 🚀 Deployment (AWS Lambda)

1. **Build & Deploy:**
   ```sh
   cd scripts
   ./deploy.sh
   ```
   - This script zips the code, uploads to AWS Lambda, and sets environment variables from `config/env-vars.json`.
2. **IAM & Scheduling:**
   - Use `setup-iam.sh` and `create-schedule.sh` to configure Lambda permissions and schedule.
3. **Docs:**
   - See `docs/DEPLOYMENT.md` for full deployment instructions.

---

## 📊 Monitoring

- **Monitoring scripts:** Located in `monitoring/`.
- **Run a health check:**
  ```sh
  node monitoring/monitor-lambda.js
  ```
- **Automated reports:**
  - Use `setup-monitoring.sh` to install cron jobs for regular Lambda health checks and alerts.
- **Docs:**
  - See `docs/MONITORING.md` for details.

---

## 🛠 Development & Testing

- **Local test:**
  ```sh
  node scripts/test-lambda.js
  ```
- **Main handler:**
  - Source code is in `src/index.js`.
- **ABIs:**
  - Contract ABIs are in `abis/`.

---

## 🔒 Security Notes
- **Never commit secrets:** All secrets should be in `.env` or `config/env-vars.json` (which are gitignored).
- **Use `env-vars.example.json`** as a template for sharing config structure.

---

## 📬 Contact / License
- Maintained by [r4v3n](mailto:r@r4v3n.art)
- See LICENSE file (if present) for usage terms.
