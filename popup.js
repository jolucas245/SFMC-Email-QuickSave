const translations = {
  pt_BR: {
    brandName: "SFMC Email & Template QuickSave",
    checkingSession: "Verificando sessão...",
    actionsTitle: "AÇÕES",
    refresh: "Recarregar",
    expand: "Expandir",
    collapse: "Recolher",
    filtersTitle: "FILTROS",
    foldersTitle: "Pastas & Conteúdo",
    loading: "Carregando...",
    downloadSelected: "Baixar Selecionados",
    sessionErrorTitle: "Sem Sessão",
    sessionErrorDesc: "Faça login no Marketing Cloud para continuar.",
    tryAgain: "Tentar Novamente",
    connected: "Conectado",
    sessionLost: "Sessão não detectada",
    emptyFolder: "Vazia",
    downloading: "Baixando...",
    processing: "Processando",
    success: "Sucesso!",
    error: "Erro",
    noContent: "Sem conteúdo selecionado.",
    developedBy: "Desenvolvido por"
  },
  en: {
    brandName: "SFMC Email & Template QuickSave",
    checkingSession: "Checking session...",
    actionsTitle: "ACTIONS",
    refresh: "Reload",
    expand: "Expand",
    collapse: "Collapse",
    filtersTitle: "FILTERS",
    foldersTitle: "Folders & Content",
    loading: "Loading...",
    downloadSelected: "Download Selected",
    sessionErrorTitle: "No Session",
    sessionErrorDesc: "Please login to Marketing Cloud to continue.",
    tryAgain: "Try Again",
    connected: "Connected",
    sessionLost: "Session not detected",
    emptyFolder: "Empty",
    downloading: "Downloading...",
    processing: "Processing",
    success: "Success!",
    error: "Error",
    noContent: "No content selected.",
    developedBy: "Developed by"
  }
};
let currentLang = localStorage.getItem('sfmc_lang') || 'pt_BR';
const state = {
  stack: null,
  categories: [],
  categoryTree: {},
  assets: {},
  selectedAssets: new Set(),
  loadedCategories: new Set(),
  isLoading: false,
  statusKey: 'checkingSession',
  statusExtra: '' 
};
const elements = {
  statusStrip: null,
  statusText: null,
  folderTree: null,
  loginState: null,
  appLayout: null,
  btnDownload: null,
  btnText: null,
  selectAll: null,
  selectionCount: null,
  overlayLoading: null,
  overlayMsg: null,
  filters: {}
};
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  setLanguage(currentLang);
  initEventListeners();
  await checkSession();
});
function initElements() {
  elements.statusStrip = document.getElementById('status-strip');
  elements.statusText = document.getElementById('status-text');
  elements.folderTree = document.getElementById('folder-tree');
  elements.loginState = document.getElementById('login-state');
  elements.appLayout = document.querySelector('.app-layout');
  elements.btnDownload = document.getElementById('btn-download');
  elements.btnText = document.getElementById('btn-text');
  elements.selectAll = document.getElementById('select-all');
  elements.selectionCount = document.getElementById('selection-count');
  elements.overlayLoading = document.getElementById('overlay-loading');
  elements.overlayMsg = document.getElementById('overlay-msg');
  elements.filters = {
    email: document.getElementById('filter-htmlemail'),
    template: document.getElementById('filter-templatebasedemail'),
    block: document.getElementById('filter-htmlblock')
  };
}
function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  localStorage.setItem('sfmc_lang', lang);
  const t = translations[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  refreshStatusText();
  updateSelectionCount();
}
function getMsg(key) {
  return translations[currentLang][key] || key;
}
function initEventListeners() {
  document.getElementById('btn-refresh').addEventListener('click', fullReload);
  document.getElementById('btn-expand-all').addEventListener('click', expandAllFolders);
  document.getElementById('btn-collapse-all').addEventListener('click', collapseAllFolders);
  document.getElementById('btn-retry').addEventListener('click', checkSession);
  document.getElementById('modal-close-btn').addEventListener('click', () => elements.overlayMsg.classList.add('hidden'));
  elements.btnDownload.addEventListener('click', downloadSelected);
  elements.selectAll.addEventListener('change', toggleSelectAll);
  const authorLink = document.getElementById('author-link');
  if (authorLink) {
    authorLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://linkedin.com/in/jolucas240' });
    });
  }
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setLanguage(e.target.closest('button').dataset.lang);
    });
  });
  Object.values(elements.filters).forEach(filter => {
    filter.addEventListener('change', reloadCurrentFolders);
  });
}
async function fullReload() {
  state.categories = [];
  state.categoryTree = {};
  state.assets = {};
  state.loadedCategories.clear();
  state.selectedAssets.clear();
  updateSelectionCount();
  elements.folderTree.innerHTML = `
    <div class="placeholder-state">
      <div class="spinner"></div>
      <p>${getMsg('loading')}</p>
    </div>`;
  await checkSession();
}
async function checkSession() {
  updateStatus('warning', 'checkingSession');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      showLoginRequired();
      return;
    }
    state.stack = detectStackFromUrl(tab.url);
    if (!state.stack) state.stack = 's13.';
    const response = await sendMessage({
      action: 'checkSession',
      stack: state.stack
    });
    if (response.success && response.hasSession) {
      updateStatus('success', 'connected', ` (${state.stack.replace('.', '')})`);
      showMainContent();
      if (state.categories.length === 0) await loadCategories();
    } else {
      showLoginRequired();
      updateStatus('error', 'sessionLost');
    }
  } catch (error) {
    console.error(error);
    showLoginRequired();
    updateStatus('error', 'error');
  }
}
function updateStatus(type, key, extra = '') {
  state.statusKey = key;
  state.statusExtra = extra;
  elements.statusStrip.className = `status-strip ${type}`;
  refreshStatusText();
}
function refreshStatusText() {
  const text = getMsg(state.statusKey) + state.statusExtra;
  if(elements.statusText) elements.statusText.textContent = text;
}
function detectStackFromUrl(url) {
  if (!url) return null;
  let match = url.match(/mc\.([^.]+)\.exacttarget\.com/);
  if (match && match[1] !== 'exacttarget') return match[1] + '.';
  match = url.match(/([^.]+)\.marketingcloudapps\.com/);
  if (match) {
    const parts = match[1].split('.');
    if (parts.length > 1) return parts[parts.length - 1] + '.';
  }
  return null;
}
async function loadCategories() {
  elements.folderTree.innerHTML = `
    <div class="placeholder-state">
      <div class="spinner"></div>
      <p>${getMsg('loading')}</p>
    </div>`;
  try {
    const response = await sendMessage({
      action: 'getCategories',
      stack: state.stack
    });
    if (response.success) {
      state.categories = response.data;
      buildCategoryTree();
      renderFolderTree();
    } else {
      elements.folderTree.innerHTML = `<div style="padding:16px;text-align:center;color:red">${getMsg('error')}: ${response.error}</div>`;
    }
  } catch (error) {
    elements.folderTree.innerHTML = `<div style="padding:16px;text-align:center;color:red">${getMsg('error')}: ${error.message}</div>`;
  }
}
function buildCategoryTree() {
  state.categoryTree = {};
  const categoryMap = {};
  state.categories.forEach(cat => {
    categoryMap[cat.id] = { ...cat, children: [] };
  });
  state.categories.forEach(cat => {
    if (cat.parentId && categoryMap[cat.parentId]) {
      categoryMap[cat.parentId].children.push(categoryMap[cat.id]);
    } else if (!cat.parentId || cat.parentId === 0) {
      state.categoryTree[cat.id] = categoryMap[cat.id];
    }
  });
  const sortChildren = (node) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.children.forEach(sortChildren);
    }
  };
  Object.values(state.categoryTree).forEach(sortChildren);
}
function renderFolderTree() {
  elements.folderTree.innerHTML = '';
  const roots = Object.values(state.categoryTree).sort((a, b) => a.name.localeCompare(b.name));
  if (roots.length === 0) {
    elements.folderTree.innerHTML = `<div style="padding:16px;text-align:center">${getMsg('noContent')}</div>`;
    return;
  }
  roots.forEach(category => {
    elements.folderTree.appendChild(createFolderElement(category));
  });
}
function createFolderElement(category) {
  const container = document.createElement('div');
  container.className = 'tree-node';
  const row = document.createElement('div');
  row.className = 'tree-item';
  row.dataset.categoryId = category.id;
  row.innerHTML = `
    <span class="material-icons tree-toggle">chevron_right</span>
    <span class="material-icons tree-icon">folder</span>
    <span class="tree-label" title="${category.name}">${category.name}</span>
  `;
  container.appendChild(row);
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'tree-children';
  if (category.children && category.children.length > 0) {
    category.children.forEach(child => {
      childrenContainer.appendChild(createFolderElement(child));
    });
  }
  const assetsContainer = document.createElement('div');
  assetsContainer.className = 'assets-container';
  assetsContainer.dataset.categoryId = category.id;
  childrenContainer.appendChild(assetsContainer);
  container.appendChild(childrenContainer);
  row.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFolder(row, category, childrenContainer);
  });
  return container;
}
async function toggleFolder(row, category, childrenContainer) {
  const toggle = row.querySelector('.tree-toggle');
  const icon = row.querySelector('.tree-icon');
  const isExpanded = childrenContainer.classList.contains('expanded');
  if (isExpanded) {
    childrenContainer.classList.remove('expanded');
    toggle.classList.remove('rotated');
    icon.textContent = 'folder';
  } else {
    childrenContainer.classList.add('expanded');
    toggle.classList.add('rotated');
    icon.textContent = 'folder_open';
    if (!state.loadedCategories.has(category.id)) {
      await loadAssetsForCategory(category.id);
    }
  }
}
async function loadAssetsForCategory(categoryId) {
  const assetsContainer = document.querySelector(`.assets-container[data-category-id="${categoryId}"]`);
  if (!assetsContainer) return;
  const assetTypes = getSelectedAssetTypes();
  if (assetTypes.length === 0) {
    renderAssets(assetsContainer, []);
    state.loadedCategories.add(categoryId);
    return;
  }
  assetsContainer.innerHTML = `<div style="padding:8px;font-size:11px;color:#999;">${getMsg('loading')}</div>`;
  try {
    const response = await sendMessage({
      action: 'getAssetsByCategory',
      stack: state.stack,
      categoryId: categoryId,
      assetTypes: assetTypes
    });
    if (response.success) {
      const assets = response.data.items || [];
      state.assets[categoryId] = assets;
      state.loadedCategories.add(categoryId);
      renderAssets(assetsContainer, assets);
    } else {
      assetsContainer.innerHTML = `<div style="padding:8px;color:red;">${getMsg('error')}</div>`;
    }
  } catch (error) {
    assetsContainer.innerHTML = `<div style="padding:8px;color:red;">${getMsg('error')}</div>`;
  }
}
function getSelectedAssetTypes() {
  const types = [];
  if (elements.filters.email.checked) types.push('htmlemail');
  if (elements.filters.template.checked) types.push('templatebasedemail');
  if (elements.filters.block.checked) types.push('htmlblock');
  return types;
}
function renderAssets(container, assets) {
  container.innerHTML = '';
  if (assets.length === 0) {
    container.innerHTML = `<div style="padding:8px;font-size:11px;color:#999;">${getMsg('emptyFolder')}</div>`;
    return;
  }
  assets.forEach(asset => {
    container.appendChild(createAssetElement(asset));
  });
}
function createAssetElement(asset) {
  const row = document.createElement('div');
  row.className = 'asset-row';
  if (state.selectedAssets.has(asset.id)) row.classList.add('selected');
  const label = document.createElement('label');
  label.className = 'checkbox-wrapper';
  label.onclick = (e) => e.stopPropagation();
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'asset-checkbox';
  input.dataset.assetId = asset.id;
  input.checked = state.selectedAssets.has(asset.id);
  input.addEventListener('change', (e) => {
    toggleAssetSelection(asset, e.target.checked);
  });
  const customCheck = document.createElement('span');
  customCheck.className = 'custom-check';
  label.appendChild(input);
  label.appendChild(customCheck);
  let icon = 'description';
  const type = asset.assetType?.name?.toLowerCase() || '';
  if (type.includes('email')) icon = 'email';
  else if (type.includes('template')) icon = 'web';
  else if (type.includes('block')) icon = 'widgets';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'material-icons asset-icon';
  iconSpan.textContent = icon;
  const nameSpan = document.createElement('span');
  nameSpan.className = 'asset-name';
  nameSpan.textContent = asset.name;
  nameSpan.title = asset.name;
  row.appendChild(label);
  row.appendChild(iconSpan);
  row.appendChild(nameSpan);
  row.addEventListener('click', () => {
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change'));
  });
  return row;
}
function toggleAssetSelection(asset, isSelected) {
  if (isSelected) {
    state.selectedAssets.add(asset.id);
  } else {
    state.selectedAssets.delete(asset.id);
  }
  const el = document.querySelector(`.asset-checkbox[data-asset-id="${asset.id}"]`);
  if (el) {
    const row = el.closest('.asset-row');
    if (isSelected) row.classList.add('selected');
    else row.classList.remove('selected');
    el.checked = isSelected;
  }
  updateSelectionCount();
}
function updateSelectionCount() {
  const count = state.selectedAssets.size;
  elements.selectionCount.textContent = count;
  elements.selectionCount.style.display = count === 0 ? 'none' : 'inline-block';
  const baseText = getMsg('downloadSelected');
  elements.btnText.textContent = count > 0 ? `${baseText} (${count})` : baseText;
  elements.btnDownload.disabled = count === 0;
  elements.selectAll.checked = count > 0;
}
function toggleSelectAll() {
  const isChecked = elements.selectAll.checked;
  const checkboxes = document.querySelectorAll('.asset-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const assetId = parseInt(cb.dataset.assetId);
    toggleAssetSelection({ id: assetId }, isChecked);
  });
}
async function reloadCurrentFolders() {
  state.assets = {};
  state.loadedCategories.clear();
  const expandedContainers = document.querySelectorAll('.tree-children.expanded .assets-container');
  for (const container of expandedContainers) {
    const catId = parseInt(container.dataset.categoryId);
    await loadAssetsForCategory(catId);
  }
  state.selectedAssets.forEach(id => {
    const cb = document.querySelector(`.asset-checkbox[data-asset-id="${id}"]`);
    if(cb) {
      cb.checked = true;
      cb.closest('.asset-row').classList.add('selected');
    }
  });
}
function expandAllFolders() {
  const folders = document.querySelectorAll('.tree-node');
  folders.forEach(folder => {
    const children = folder.querySelector('.tree-children');
    const toggle = folder.querySelector('.tree-toggle');
    const icon = folder.querySelector('.tree-icon');
    const assetsContainer = folder.querySelector('.assets-container');
    const catId = parseInt(assetsContainer?.dataset?.categoryId);
    if (children) {
        children.classList.add('expanded');
        if (toggle) toggle.classList.add('rotated');
        if (icon) icon.textContent = 'folder_open';
        if (catId && !state.loadedCategories.has(catId)) {
            loadAssetsForCategory(catId);
        }
    }
  });
}
function collapseAllFolders() {
  const folders = document.querySelectorAll('.tree-node');
  folders.forEach(folder => {
    const children = folder.querySelector('.tree-children');
    const toggle = folder.querySelector('.tree-toggle');
    const icon = folder.querySelector('.tree-icon');
    if (children) {
        children.classList.remove('expanded');
        if (toggle) toggle.classList.remove('rotated');
        if (icon) icon.textContent = 'folder';
    }
  });
}
async function downloadSelected() {
  if (typeof JSZip === 'undefined') {
    showMessage(`${getMsg('error')}: jszip.min.js not found`);
    return;
  }
  if (state.selectedAssets.size === 0) return;
  const assetIds = Array.from(state.selectedAssets);
  const total = assetIds.length;
  showLoading(getMsg('downloading'));
  updateProgress(0, total);
  try {
    const files = [];
    for (let i = 0; i < total; i++) {
      updateProgress(i, total, `${getMsg('processing')} ${i+1}/${total}`);
      const assetId = assetIds[i];
      const response = await sendMessage({
        action: 'getAssetContent',
        stack: state.stack,
        assetId: assetId
      });
      if (response.success) {
        const asset = response.data;
        let content = asset.views?.html?.content || asset.content || asset.views?.preheader?.content;
        if (content) {
          files.push({
            name: sanitizeFileName(asset.name) + '.html',
            content: content
          });
        }
      }
    }
    if (files.length > 0) {
      if (files.length === 1) {
        downloadSingleFile(files[0]);
      } else {
        await downloadAsZip(files);
      }
      showMessage(getMsg('success'));
    } else {
      showMessage(getMsg('noContent'));
    }
  } catch (error) {
    showMessage(`${getMsg('error')}: ${error.message}`);
  } finally {
    hideLoading();
  }
}
async function downloadSingleFile(file) {
  const blob = new Blob([file.content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({
    url: url,
    filename: file.name
  });
}
async function downloadAsZip(files) {
  const zip = new JSZip();
  files.forEach(f => zip.file(f.name, f.content));
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);
  await chrome.downloads.download({
    url: url,
    filename: `sfmc-assets-${timestamp}.zip`
  });
}
function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim().substring(0, 50);
}
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
function showLoginRequired() {
  elements.appLayout.classList.add('hidden');
  elements.loginState.classList.remove('hidden');
}
function showMainContent() {
  elements.appLayout.classList.remove('hidden');
  elements.loginState.classList.add('hidden');
}
function showLoading(text) {
  document.getElementById('loading-text').textContent = text;
  elements.overlayLoading.classList.remove('hidden');
}
function hideLoading() {
  elements.overlayLoading.classList.add('hidden');
}
function updateProgress(current, total, text) {
  const percentage = Math.round((current / total) * 100);
  document.getElementById('progress-fill').style.width = percentage + '%';
  if (text) document.getElementById('progress-details').textContent = text;
}
function showMessage(text) {
  elements.overlayMsg.querySelector('.modal-text').textContent = text;
  elements.overlayMsg.classList.remove('hidden');
}