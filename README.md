
# Web Labs


## Requirements

- Node.js (v18 or later recommended)
- npm (v9 or later recommended)


## Getting Started

```bash
npm install
npm run dev
```


## Build & Production

```bash
npm run build
npm run start
```

## Running with PM2

### Initial Startup

```bash
pm2 start npm --name "web-labs" -- run start
```

### Enable pm2 Auto-Start

```bash
pm2 startup
pm2 save
```

### Manual Management

```bash
# Restart
pm2 restart web-labs
# Stop
pm2 stop web-labs
# Start
pm2 start web-labs
```

### Change Port or Environment Variables

If you want to change the port or other environment variables, delete the process and re-register:

```bash
pm2 delete web-labs
PORT=NEW_PORT pm2 start npm --name "web-labs" -- run start
pm2 save
```
