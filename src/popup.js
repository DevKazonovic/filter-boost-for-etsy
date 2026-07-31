import { FILTERS, tabStatus, TAB_STATUS } from './lib/etsy.js';
import { readSettings, writeSettings, SETTINGS_KEY } from './lib/settings.js';

const t = (key, subs) => chrome.i18n.getMessage(key, subs);

const STATUS_TONE = {
  [TAB_STATUS.ACTIVE]: 'ok',
  [TAB_STATUS.MISSING]: 'warn',
  [TAB_STATUS.NO_FILTERS]: 'warn',
  [TAB_STATUS.DISABLED]: 'off',
  [TAB_STATUS.NOT_SEARCH]: 'neutral',
};

const STATUS_MESSAGE = {
  [TAB_STATUS.ACTIVE]: 'statusActive',
  [TAB_STATUS.MISSING]: 'statusMissing',
  [TAB_STATUS.NO_FILTERS]: 'statusNoFilters',
  [TAB_STATUS.DISABLED]: 'statusDisabled',
  [TAB_STATUS.NOT_SEARCH]: 'statusNotSearch',
};

const master = document.getElementById('master');
const masterState = document.getElementById('masterState');
const filtersList = document.getElementById('filters');
const statusBox = document.getElementById('status');
const statusText = document.getElementById('statusText');
const applyButton = document.getElementById('apply');
const shortcutLabel = document.getElementById('shortcut');
const rowTemplate = document.getElementById('filterRow');

let settings = null;
let activeTab = null;
let pendingTarget = null;

function applyStaticText() {
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  document.documentElement.lang = chrome.i18n.getUILanguage();
}

function buildFilterRows() {
  for (const filter of FILTERS) {
    const node = rowTemplate.content.cloneNode(true);
    const input = node.querySelector('input');
    input.id = `filter-${filter.id}`;
    input.dataset.filterId = filter.id;
    node.querySelector('label').setAttribute('for', input.id);
    node.querySelector('.row-title').textContent = t(filter.messageKey);
    node.querySelector('code').textContent = `${filter.param}=${filter.value}`;
    input.addEventListener('change', () => {
      settings = { ...settings, filters: { ...settings.filters, [filter.id]: input.checked } };
      writeSettings(settings);
      render();
    });
    filtersList.append(node);
  }
}

function renderStatus() {
  const result = tabStatus(activeTab?.url, settings);
  pendingTarget = result.target;
  statusBox.dataset.tone = STATUS_TONE[result.status];
  statusText.textContent = t(STATUS_MESSAGE[result.status]);
  applyButton.hidden = result.status !== TAB_STATUS.MISSING;
}

function render() {
  master.checked = settings.enabled;
  masterState.textContent = t(settings.enabled ? 'masterOn' : 'masterOff');
  document.body.classList.toggle('is-off', !settings.enabled);

  for (const input of filtersList.querySelectorAll('input')) {
    input.checked = settings.filters[input.dataset.filterId] !== false;
    input.disabled = !settings.enabled;
  }

  renderStatus();
}

async function loadShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const command = commands.find((entry) => entry.name === 'toggle-filters');
    shortcutLabel.textContent = command?.shortcut ? t('shortcutHint', [command.shortcut]) : t('shortcutUnset');
  } catch {
    shortcutLabel.textContent = '';
  }
}

master.addEventListener('change', () => {
  settings = { ...settings, enabled: master.checked };
  writeSettings(settings);
  render();
});

applyButton.addEventListener('click', async () => {
  if (!pendingTarget || !activeTab) return;
  await chrome.tabs.update(activeTab.id, { url: pendingTarget.href });
  window.close();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
  settings = await readSettings();
  render();
});

(async () => {
  applyStaticText();
  buildFilterRows();
  const [loaded, tabs] = await Promise.all([
    readSettings(),
    chrome.tabs.query({ active: true, currentWindow: true }),
  ]);
  settings = loaded;
  activeTab = tabs[0] || null;
  render();
  loadShortcut();
})();
