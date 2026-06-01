# Security

Baby Log is designed for private family data. Do not commit real family records, exported archives, Cloudflare D1 IDs, production routes, machine tokens, passwords, or local `.dev.vars` / `.env` files.

Use a fresh public repository when publishing this project if the original repository history ever contained private values.

Before publishing, run:

```bash
npm test
npm run build
gitleaks detect --source . --no-git --redact
trufflehog filesystem . --no-update --only-verified
```

Report security issues privately to the repository owner. Do not open public issues with secrets or family data.
