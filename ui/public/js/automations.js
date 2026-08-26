(function () {
  var devices = window.DEVICES || [];

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openModal() { document.getElementById('auto-modal').classList.add('is-open'); }
  function closeModal() { document.getElementById('auto-modal').classList.remove('is-open'); }

  document.querySelectorAll('.modal-close').forEach(function (btn) {
    btn.addEventListener('click', closeModal);
  });
  document.getElementById('auto-modal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // ── Trigger type show/hide ─────────────────────────────────────────────────

  var typeEl = document.getElementById('auto-type');
  var groupTime = document.getElementById('group-time');
  var groupOffset = document.getElementById('group-offset');

  function updateTriggerFields() {
    var t = typeEl.value;
    groupTime.style.display = t === 'time' ? '' : 'none';
    groupOffset.style.display = t !== 'time' ? '' : 'none';
  }
  typeEl.addEventListener('change', updateTriggerFields);
  updateTriggerFields();

  // ── Actions list ───────────────────────────────────────────────────────────

  function capabilitiesFor(deviceId) {
    var d = devices.find(function (x) { return x.id === deviceId; });
    return d ? d.capabilities : ['power'];
  }

  function buildValueOptions(cap) {
    if (cap === 'power') return '<option value="true">On</option><option value="false">Off</option>';
    return '<option value="true">true</option><option value="false">false</option>';
  }

  function addActionRow(device, capability, value) {
    device = device || (devices[0] && devices[0].id) || '';
    capability = capability || 'power';
    value = value !== undefined ? String(value) : 'true';

    var row = document.createElement('div');
    row.className = 'action-row';

    var deviceSel = '<select class="form-input act-device">';
    devices.forEach(function (d) {
      deviceSel += '<option value="' + d.id + '"' + (d.id === device ? ' selected' : '') + '>' + d.name + '</option>';
    });
    deviceSel += '</select>';

    var caps = capabilitiesFor(device);
    var capSel = '<select class="form-input act-cap">';
    caps.forEach(function (c) {
      capSel += '<option value="' + c + '"' + (c === capability ? ' selected' : '') + '>' + c + '</option>';
    });
    capSel += '</select>';

    var valSel = '<select class="form-input act-val">' + buildValueOptions(capability) + '</select>';

    row.innerHTML = deviceSel + capSel + valSel +
      '<button class="btn-icon btn-remove-action" title="Remove">' +
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg></button>';

    // Set correct value after inserting value select
    var list = document.getElementById('actions-list');
    list.appendChild(row);

    var valEl = row.querySelector('.act-val');
    valEl.value = value;

    // Device change → rebuild cap select, rebuild val select
    row.querySelector('.act-device').addEventListener('change', function () {
      var newCaps = capabilitiesFor(this.value);
      var capEl = row.querySelector('.act-cap');
      capEl.innerHTML = '';
      newCaps.forEach(function (c) {
        var o = document.createElement('option'); o.value = c; o.textContent = c; capEl.appendChild(o);
      });
      updateValSelect(row);
    });

    row.querySelector('.act-cap').addEventListener('change', function () { updateValSelect(row); });

    row.querySelector('.btn-remove-action').addEventListener('click', function () {
      list.removeChild(row);
    });
  }

  function updateValSelect(row) {
    var cap = row.querySelector('.act-cap').value;
    var valEl = row.querySelector('.act-val');
    valEl.innerHTML = buildValueOptions(cap);
  }

  document.getElementById('btn-add-action').addEventListener('click', function () { addActionRow(); });

  // ── Open add modal ─────────────────────────────────────────────────────────

  function openAdd() {
    document.getElementById('auto-modal-title').textContent = 'Add Automation';
    document.getElementById('auto-id').value = '';
    document.getElementById('auto-name').value = '';
    typeEl.value = 'time';
    updateTriggerFields();
    document.getElementById('auto-time').value = '08:00';
    document.getElementById('auto-offset').value = '0';
    document.querySelectorAll('.day-check').forEach(function (c) { c.checked = false; });
    document.getElementById('actions-list').innerHTML = '';
    addActionRow();
    openModal();
  }

  var addBtn = document.getElementById('btn-add-auto');
  var addBtnEmpty = document.getElementById('btn-add-auto-empty');
  if (addBtn) addBtn.addEventListener('click', openAdd);
  if (addBtnEmpty) addBtnEmpty.addEventListener('click', openAdd);

  // ── Open edit modal ────────────────────────────────────────────────────────

  document.querySelectorAll('.btn-edit-auto').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = this.dataset.id;
      fetch('/api/automations').then(function (r) { return r.json(); }).then(function (list) {
        var auto = list.find(function (a) { return a.id === id; });
        if (!auto) return;
        document.getElementById('auto-modal-title').textContent = 'Edit Automation';
        document.getElementById('auto-id').value = auto.id;
        document.getElementById('auto-name').value = auto.name;
        typeEl.value = auto.trigger.type;
        updateTriggerFields();
        document.getElementById('auto-time').value = auto.trigger.time || '08:00';
        document.getElementById('auto-offset').value = auto.trigger.offset || 0;
        document.querySelectorAll('.day-check').forEach(function (c) {
          c.checked = auto.trigger.days && auto.trigger.days.includes(parseInt(c.value));
        });
        document.getElementById('actions-list').innerHTML = '';
        (auto.actions || []).forEach(function (a) { addActionRow(a.device, a.capability, a.value); });
        openModal();
      });
    });
  });

  // ── Save ──────────────────────────────────────────────────────────────────

  document.getElementById('btn-save-auto').addEventListener('click', function () {
    var id = document.getElementById('auto-id').value;
    var name = document.getElementById('auto-name').value.trim();
    if (!name) { alert('Name is required'); return; }

    var type = typeEl.value;
    var trigger = { type: type };
    if (type === 'time') {
      trigger.time = document.getElementById('auto-time').value;
    } else {
      trigger.offset = parseInt(document.getElementById('auto-offset').value) || 0;
    }
    var days = [];
    document.querySelectorAll('.day-check:checked').forEach(function (c) { days.push(parseInt(c.value)); });
    trigger.days = days;

    var actions = [];
    document.querySelectorAll('.action-row').forEach(function (row) {
      var rawVal = row.querySelector('.act-val').value;
      var val = rawVal === 'true' ? true : rawVal === 'false' ? false : rawVal;
      actions.push({
        device: row.querySelector('.act-device').value,
        capability: row.querySelector('.act-cap').value,
        value: val,
      });
    });
    if (actions.length === 0) { alert('Add at least one action'); return; }

    var payload = { name: name, trigger: trigger, actions: actions };
    var method = id ? 'PUT' : 'POST';
    var url = id ? '/api/automations/' + id : '/api/automations';

    fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function () { location.reload(); })
      .catch(function (e) { alert('Save failed: ' + e.message); });
  });

  // ── Toggle ────────────────────────────────────────────────────────────────

  document.querySelectorAll('.auto-toggle').forEach(function (cb) {
    cb.addEventListener('change', function () {
      fetch('/api/automations/' + this.dataset.id + '/toggle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: this.checked }),
      });
    });
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  document.querySelectorAll('.btn-delete-auto').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!confirm('Delete this automation?')) return;
      fetch('/api/automations/' + this.dataset.id, { method: 'DELETE' })
        .then(function () { location.reload(); });
    });
  });
})();
