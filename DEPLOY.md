# Deploying to https://unizova.com/cms

The app runs as **one Node process** (API + built React app), served under the `/cms` sub-path
(`BASE_PATH=/cms` on the server, `VITE_BASE_PATH=/cms/` in `client/.env.production`).
Nginx on unizova.com proxies `/cms/` to it. Your existing site on `/` is untouched.

## 1. Server prerequisites (Ubuntu VPS)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs git
sudo npm i -g pm2
```
MongoDB: either install MongoDB 7/8 on the server, or create a free **MongoDB Atlas** cluster and use its connection string.

## 2. First deploy

```bash
cd /var/www
git clone https://github.com/balamurugesan03/Cms.git cms && cd cms

cp deploy/.env.production.example server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste as JWT_SECRET
nano server/.env                                                             # set JWT_SECRET, MONGO_URI

npm --prefix server ci --omit=dev
npm --prefix client ci && npm --prefix client run build

# OPTIONAL demo data (wipes the database!) – skip for a real company database
NODE_ENV=production node server/src/seed.js --force

pm2 start ecosystem.config.cjs && pm2 save && pm2 startup     # auto-start on reboot
curl http://127.0.0.1:5000/cms/api/health                     # -> {"ok":true,"db":true}
```

## 3. Nginx

Paste `deploy/nginx-unizova-cms.conf` inside the existing HTTPS `server { … unizova.com … }` block, then:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
Open **https://unizova.com/cms/**

## 4. Updates

```bash
cd /var/www/cms && bash deploy/deploy.sh
```

## Production checklist
- [ ] Strong `JWT_SECRET` (server refuses to start in production with the placeholder)
- [ ] Change all demo passwords, or don't seed demo data; create real users in **Users & Roles**
- [ ] Set company name / GSTIN / bank details in **Settings** (printed on quotations & invoices)
- [ ] Back up MongoDB (`mongodump`) and the `server/uploads/` folder regularly
- [ ] MongoDB not exposed to the internet (bind 127.0.0.1 or use Atlas IP allow-list)
