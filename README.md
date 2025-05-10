# Getting Started

This repository is a template based on Next.js 15.

## Development Setup

1. Change the application name
   Modify the "name" field in the package.json file (currently "name": "<current-name>") to match your project.
2. Install dependencies
   ```
   npm install
   ```
3. Remove existing git history
   If a .git directory exists, remove it:
   ```
   rm -rf .git
   ```

## Run the App

To ensure the application starts correctly:

```
npm run dev
```

Open your browser and visit http://localhost:3000 to ensure the application is running as expected.

### Access from External Devices

If your device is on the same network, you can also access the application from external devices like smartphones by using the host machine's local IP address (e.g., `http://<your-local-ip>:3000`).
