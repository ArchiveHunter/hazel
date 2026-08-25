const express = require('express');
const path = require('path');
const os = require('os');
const logger = require('./logger');
const configManager = require('./config-manager');

const startTime = Date.now();

function startUiServer(registry, config) {
  const app = express();
  const port = config.port || 3088;

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'ui', 'views'));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'ui', 'public')));

  // ─── SSE: device state ───────────────────────────────────────────────────────

  const stateClients = new Set();
  const logClients = new Set();

  registry.on('state', ({ deviceId, state }) => {
    const payload = `data: ${JSON.stringify({ type: 'state', deviceId, state })}\n\n`;
    for (const res of stateClients) { try { res.write(payload); } catch {} }
  });

  logger.on('line', (entry) => {
    const payload = `data: ${JSON.stringify(entry)}\n\n`;
    for (const res of logClients) { try { res.write(payload); } catch {} }
  });

  // ─── Pages ──────────────────────────────────────────────────────────────────

  app.get('/', (req, res) => res.redirect('/dashboard'));

  app.get('/dashboard', (req, res) => {
    res.render('dashboard', { devices: registry.getAll(), page: 'dashboard' });
  });

  app.get('/devices', (req, res) => {
    const cfg = configManager.load();
    const liveIds = new Set(registry.getAll().map(d => d.id));
    res.render('devices', {
      devices: cfg.devices,
      liveIds: [...liveIds],
      schemas: configManager.getSchemas(),
      enabledPlugins: configManager.getEnabledPluginNames(),
      page: 'devices',
    });
  });

  app.get('/plugins', (req, res) => {
    res.render('plugins', { plugins: configManager.getPlugins(), schemas: configManager.getSchemas(), page: 'plugins' });
  });

  app.get('/logs', (req, res) => {
    res.render('logs', { page: 'logs' });
  });

  app.get('/system', (req, res) => {
    const cfg = configManager.load();
    res.render('system', { bridge: cfg.bridge, page: 'system' });
  });

  // ─── API: devices ────────────────────────────────────────────────────────────

  app.get('/api/devices', (req, res) => res.json(registry.getAll()));

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    for (const d of registry.getAll()) {
      res.write(`data: ${JSON.stringify({ type: 'state', deviceId: d.id, state: d.state })}\n\n`);
    }
    stateClients.add(res);
    req.on('close', () => stateClients.delete(res));
  });

  app.post('/api/devices/:id/set', async (req, res) => {
    const { capability, value } = req.body;
    try {
      await registry.set(req.params.id, capability, value);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── API: config ─────────────────────────────────────────────────────────────

  app.get('/api/config', (req, res) => res.json(configManager.load()));

  app.post('/api/devices', (req, res) => {
    try {
      const device = configManager.addDevice(req.body);
      res.json({ ok: true, device, message: 'Device added. Restart Hazel to activate.' });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/devices/:id', (req, res) => {
    try {
      const device = configManager.updateDevice(req.params.id, req.body);
      res.json({ ok: true, device, message: 'Device updated. Restart Hazel to apply.' });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/devices/:id', (req, res) => {
    try {
      configManager.removeDevice(req.params.id);
      res.json({ ok: true, message: 'Device removed. Restart Hazel to apply.' });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/plugins/:name', (req, res) => {
    try {
      configManager.updatePluginGlobal(req.params.name, req.body);
      res.json({ ok: true, message: 'Plugin settings saved. Restart Hazel to apply.' });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/plugins/:name/toggle', (req, res) => {
    try {
      configManager.togglePlugin(req.params.name, Boolean(req.body.enabled));
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── API: logs ───────────────────────────────────────────────────────────────

  app.get('/api/logs/history', (req, res) => res.json(logger.getRecent()));

  app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    for (const entry of logger.getRecent()) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
    logClients.add(res);
    req.on('close', () => logClients.delete(res));
  });

  // ─── API: system ─────────────────────────────────────────────────────────────

  app.get('/api/system', (req, res) => {
    const mem = process.memoryUsage();
    const cpuLoad = os.loadavg()[0];
    res.json({
      uptime: Math.floor((Date.now() - startTime) / 1000),
      nodeVersion: process.version,
      platform: os.platform(),
      hostname: os.hostname(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      processMem: mem.rss,
      cpuLoad: cpuLoad.toFixed(2),
      deviceCount: registry.getAll().length,
      version: require('../package.json').version,
    });
  });

  app.post('/api/system/restart', (req, res) => {
    res.json({ ok: true, message: 'Restarting…' });
    setTimeout(() => process.exit(0), 500);
  });

  app.listen(port, () => {
    console.log(`[Hazel] Web UI → http://localhost:${port}`);
  });
}

module.exports = { startUiServer };
