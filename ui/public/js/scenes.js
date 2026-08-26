(function () {
  var devices = window.DEVICES || [];

  function openModal() { document.getElementById('scene-modal').classList.add('is-open'); }
  function closeModal() { document.getElementById('scene-modal').classList.remove('is-open'); }

  document.querySelectorAll('.modal-close').forEach(function (btn) {
    btn.addEventListener('click', closeModal);
  });
  document.getElementById('scene-modal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // ── Action rows (shared logic with automations) ────────────────────────────

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

    row.innerHTML = deviceSel + capSel +
      '<select class="form-input act-val">' + buildValueOptions(capability) + '</select>' +
      '<button class="btn-icon btn-remove-action" title="Remove">' +
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg></button>';

    document.getElementById('scene-actions-list').appendChild(row);
    row.querySelector('.act-val').value = value;

    row.querySelector('.act-device').addEventListener('change', function () {
      var newCaps = capabilitiesFor(this.value);
      var capEl = row.querySelector('.act-cap');
      capEl.innerHTML = '';
      newCaps.forEach(function (c) {
        var o = document.createElement('option'); o.value = c; o.textContent = c; capEl.appendChild(o);
      });
      row.querySelector('.act-val').innerHTML = buildValueOptions(newCaps[0]);
    });

    row.querySelector('.act-cap').addEventListener('change', function () {
      row.querySelector('.act-val').innerHTML = buildValueOptions(this.value);
    });

    row.querySelector('.btn-remove-action').addEventListener('click', function () {
      document.getElementById('scene-actions-list').removeChild(row);
    });
  }

  document.getElementById('btn-add-scene-action').addEventListener('click', function () { addActionRow(); });

  // ── Open add ──────────────────────────────────────────────────────────────

  function openAdd() {
    document.getElementById('scene-modal-title').textContent = 'Add Scene';
    document.getElementById('scene-id').value = '';
    document.getElementById('scene-name').value = '';
    document.getElementById('scene-actions-list').innerHTML = '';
    addActionRow();
    openModal();
  }

  var addBtn = document.getElementById('btn-add-scene');
  var addBtnEmpty = document.getElementById('btn-add-scene-empty');
  if (addBtn) addBtn.addEventListener('click', openAdd);
  if (addBtnEmpty) addBtnEmpty.addEventListener('click', openAdd);

  // ── Open edit ─────────────────────────────────────────────────────────────

  document.querySelectorAll('.btn-edit-scene').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = this.dataset.id;
      fetch('/api/scenes').then(function (r) { return r.json(); }).then(function (list) {
        var scene = list.find(function (s) { return s.id === id; });
        if (!scene) return;
        document.getElementById('scene-modal-title').textContent = 'Edit Scene';
        document.getElementById('scene-id').value = scene.id;
        document.getElementById('scene-name').value = scene.name;
        document.getElementById('scene-actions-list').innerHTML = '';
        (scene.actions || []).forEach(function (a) { addActionRow(a.device, a.capability, a.value); });
        openModal();
      });
    });
  });

  // ── Save ──────────────────────────────────────────────────────────────────

  document.getElementById('btn-save-scene').addEventListener('click', function () {
    var id = document.getElementById('scene-id').value;
    var name = document.getElementById('scene-name').value.trim();
    if (!name) { alert('Name is required'); return; }

    var actions = [];
    document.querySelectorAll('#scene-actions-list .action-row').forEach(function (row) {
      var rawVal = row.querySelector('.act-val').value;
      actions.push({
        device: row.querySelector('.act-device').value,
        capability: row.querySelector('.act-cap').value,
        value: rawVal === 'true' ? true : rawVal === 'false' ? false : rawVal,
      });
    });
    if (actions.length === 0) { alert('Add at least one action'); return; }

    var method = id ? 'PUT' : 'POST';
    var url = id ? '/api/scenes/' + id : '/api/scenes';

    fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, actions }) })
      .then(function (r) { return r.json(); })
      .then(function () { location.reload(); })
      .catch(function (e) { alert('Save failed: ' + e.message); });
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  document.querySelectorAll('.btn-delete-scene').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!confirm('Delete this scene?')) return;
      fetch('/api/scenes/' + this.dataset.id, { method: 'DELETE' })
        .then(function () { location.reload(); });
    });
  });

  // ── Trigger ───────────────────────────────────────────────────────────────

  document.querySelectorAll('.btn-trigger-scene').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = this.dataset.id;
      var origText = this.innerHTML;
      this.disabled = true;
      this.innerHTML = 'Running…';
      fetch('/api/scenes/' + id + '/trigger', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) showToast('Scene triggered', 'success');
          else showToast(data.error || 'Failed', 'error');
        })
        .catch(function () { showToast('Failed', 'error'); })
        .finally(function () {
          btn.disabled = false;
          btn.innerHTML = origText;
        });
    });
  });

})();
