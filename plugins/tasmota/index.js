const axios = require('axios');
const { EventEmitter } = require('events');

class TasmotaDriver extends EventEmitter {
  constructor(config) {
    super();
    this.host = config.host;
    this.name = config.name;
    this.state = { on: false };
    this._pollTimer = null;
  }

  get capabilities() {
    return ['power'];
  }

  async init() {
    await this._poll();
    this._pollTimer = setInterval(() => this._poll(), 5000);
  }

  async _poll() {
    try {
      const { data } = await axios.get(`http://${this.host}/cm`, {
        params: { cmnd: 'Power' },
        timeout: 3000,
      });
      const on = (data.POWER ?? data.POWER1 ?? '').toLowerCase() === 'on';
      this.state.on = on;
      // Always emit so the registry can track lastSeen; registry deduplicates for SSE
      this.emit('state', { ...this.state });
    } catch {}
  }

  get(capability) {
    if (capability === 'power') return this.state.on;
    return null;
  }

  async set(capability, value) {
    if (capability !== 'power') return;
    const cmd = value ? 'Power ON' : 'Power OFF';
    await axios.get(`http://${this.host}/cm`, {
      params: { cmnd: cmd },
      timeout: 3000,
    });
    this.state.on = Boolean(value);
    this.emit('state', { ...this.state });
  }

  destroy() {
    clearInterval(this._pollTimer);
  }
}

module.exports = {
  name: 'tasmota',
  async init(config) {
    const driver = new TasmotaDriver(config);
    await driver.init();
    return driver;
  },
};
