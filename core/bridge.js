const hap = require('hap-nodejs');
const { Bridge, Service, Characteristic, uuid, Categories, HAPStorage } = hap;
const path = require('path');
const { buildAccessories } = require('./device-builder');

class HazelBridge {
  constructor(config) {
    this.config = config;

    HAPStorage.setCustomStoragePath(path.join(__dirname, '..', 'persist'));

    this._bridge = new Bridge(config.name || 'Hazel', uuid.generate(`hazel:bridge:${config.name}`));

    this._bridge.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, 'Hazel')
      .setCharacteristic(Characteristic.Model, 'Bridge')
      .setCharacteristic(Characteristic.SerialNumber, config.username || '00:00:00:00:00:00');
  }

  addDevice(deviceConfig, driver) {
    const accessories = buildAccessories(deviceConfig, driver);
    for (const acc of accessories) {
      this._bridge.addBridgedAccessory(acc);
    }
    const names = accessories.map(a => a.displayName).join(', ');
    console.log(`[Hazel] Registered: ${names}`);
  }

  start() {
    this._bridge.publish({
      username: this.config.username,
      pincode: this.config.pin,
      port: this.config.port || 51987,
      category: Categories.BRIDGE,
    });

    console.log(`[Hazel] Bridge "${this.config.name}" started on port ${this.config.port || 51987}`);
    console.log(`[Hazel] Add to HomeKit with PIN: ${this.config.pin}`);
  }
}

module.exports = { HazelBridge };
