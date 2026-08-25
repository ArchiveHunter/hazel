module.exports = {
  apps: [{
    name: 'hazel',
    script: 'hazel.js',
    cwd: '/root/hazel',
    instances: 1,
    autorestart: true,
    watch: false,
    env: { NODE_ENV: 'production' }
  }]
};
