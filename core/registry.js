const { EventEmitter } = require('events');

class Registry extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map(); // id → { config, driver, state }
  }

  register(id, config, driver) {
    const entry = { config, driver, state: { ...driver.state } };
    this.devices.set(id, entry);

    driver.on('state', (state) => {
      entry.state = state;
      this.emit('state', { deviceId: id, state });
    });
  }

  getAll() {
    return [...this.devices.entries()].map(([id, { config, driver, state }]) => ({
      id,
      name: config.name,
      plugin: config.plugin,
      capabilities: driver.capabilities || [],
      presets: config.presets || [],
      state,
    }));
  }

  get(id) {
    const entry = this.devices.get(id);
    if (!entry) return null;
    const { config, driver, state } = entry;
    return {
      id,
      name: config.name,
      plugin: config.plugin,
      capabilities: driver.capabilities || [],
      presets: config.presets || [],
      state,
    };
  }

  async set(id, capability, value) {
    const entry = this.devices.get(id);
    if (!entry) throw new Error(`Unknown device: ${id}`);
    await entry.driver.set(capability, value);
  }

  getDriver(id) {
    return this.devices.get(id)?.driver ?? null;
  }
}

module.exports = { Registry };
