# Deploying CLEAR to the VPS

CLEAR runs on the VPS (`ssh myvps`, Ubuntu, 51.79.146.152) the same way as the
other Next.js apps there (sinadi, klase):

- code in `~/clear-sys`, built on the VPS with the shared Node 22 in `~/sinadi-node`
- PM2 process `clear-sys` running `next start` on `127.0.0.1:3040` (`ecosystem.config.cjs`)
- Apache proxies the domain to it; certbot provides HTTPS
- database: the existing **Neon** production database (unchanged)

Run the PowerShell scripts from the project root on your PC. They use the Windows
OpenSSH client, which has your key; Git Bash's `ssh` does not.

## First-time setup

Domain: `clear.rupertbulquerin.com` (Cloudflare DNS, A record, DNS only — added 2026-10-16).

1. **DNS**: add an `A` record for the domain pointing to `51.79.146.152` and wait
   until it resolves (`nslookup clear.rupertbulquerin.com`).

2. **Environment file** on the VPS, from your local `.env.production.backup`
   (copies only the keys the app reads, adds `AUTH_URL` and `AUTH_TRUST_HOST`, chmod 600):

   ```powershell
   powershell -File deploy\push-env.ps1 -Domain clear.rupertbulquerin.com
   ```

3. **Code, install, build and start** (only committed code is shipped):

   ```powershell
   powershell -File deploy\deploy.ps1
   ```

   Check it answers locally on the VPS:

   ```bash
   ssh myvps "curl -sI http://127.0.0.1:3040/ | head -1"
   ```

4. **Apache vhost + HTTPS** (on the VPS):

   ```bash
   DOMAIN=clear.rupertbulquerin.com
   sudo mkdir -p /var/www/clear-root
   sed "s/__DOMAIN__/$DOMAIN/g" ~/clear-sys/deploy/clear.conf.template | sudo tee /etc/apache2/sites-available/$DOMAIN.conf >/dev/null
   sudo a2ensite $DOMAIN.conf && sudo apache2ctl configtest && sudo systemctl reload apache2
   sudo certbot --apache -d $DOMAIN
   ```

5. **Smoke test** at `https://clear.rupertbulquerin.com`: officer sign-in, Super Admin
   sign-in at `/dashboard`, a student clearance lookup.

## Updating

Commit, then:

```powershell
powershell -File deploy\deploy.ps1
```

If the change includes a Prisma migration, apply it to Neon from your PC **before**
deploying (read-only check first):

```powershell
node --env-file=.env.production.backup node_modules/prisma/build/index.js migrate status
node --env-file=.env.production.backup node_modules/prisma/build/index.js migrate deploy
```

## Operating

```bash
ssh myvps "pm2 status clear-sys"
ssh myvps "pm2 logs clear-sys --lines 100 --nostream"
ssh myvps "pm2 restart clear-sys"
```

Rollback: check out the previous commit locally, run `deploy\deploy.ps1`, then
return to `main`. `~/clear-sys/REVISION` shows the deployed commit.

## Notes

- Vercel Analytics is only rendered on Vercel; the Blob store (logos) keeps working
  with its token.
- Emails (sign-in codes, receipts) go out through **Resend** SMTP as
  `CLEAR System <noreply@clear.rupertbulquerin.com>` (Resend account `rupert2133`,
  Tokyo region). DKIM/SPF/DMARC records for it are in Cloudflare. To replace the
  API key: `powershell -File deploy\set-resend-smtp.ps1` (prompts, input hidden).
- Once the VPS is live, retire the Vercel deployment (or keep it as a fallback
  until the new domain has been verified).
