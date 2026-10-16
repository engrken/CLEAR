// PM2 process for CLEAR. Runs `next start` on a private port; Apache proxies the
// public domain to it. Next reads .env.production from this folder.
module.exports = {
  apps: [
    {
      name: "clear-sys",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      // Same private Node 22 the other Next apps on this VPS use (~/sinadi-node).
      // The system Node and the other PM2 apps are not affected.
      interpreter: "/home/ubuntu/sinadi-node/bin/node",
      args: "start -p 3040 -H 127.0.0.1",
      env: { NODE_ENV: "production" },
      max_memory_restart: "700M",
    },
  ],
};
