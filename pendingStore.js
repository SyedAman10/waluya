const fs = require('fs');
const path = require('path');

const PENDING_FILE = path.join(__dirname, 'pendingUpdates.json');

function loadPendingUpdates() {
  try {
    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function savePendingUpdates(updates) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(updates, null, 2));
}

let pendingUpdates = loadPendingUpdates();

function set(token, improvements) {
  pendingUpdates[token] = improvements;
  savePendingUpdates(pendingUpdates);
}

function get(token) {
  return pendingUpdates[token];
}

function deleteToken(token) {
  delete pendingUpdates[token];
  savePendingUpdates(pendingUpdates);
}

module.exports = {
  pendingUpdates,
  set,
  get,
  delete: deleteToken,
};
