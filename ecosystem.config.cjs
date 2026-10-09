// PM2 process file:  pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'buildpro-cms',
      cwd: './server',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
