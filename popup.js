const translations = {
  pt_BR: {
    brandName: "SFMC Email & Template QuickSave",
    checkingSession: "Verificando sessão...",
    actionsTitle: "AÇÕES",
    refresh: "Recarregar",
    expand: "Expandir",
    collapse: "Recolher",
    filtersTitle: "FILTROS",
    optionsTitle: "OPÇÕES",
    optionResolveBlocks: "Resolver Blocks",
    optionIncludeImages: "Incluir Imagens",
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
    filterAll: "Todos",
    filterFolder: "Pasta",
    filterEmail: "Email",
    filterTemplate: "Template",
    filterBlock: "Block",
    resolvingBlocks: "Resolvendo Content Blocks...",
    downloadingImages: "Baixando imagens...",
    success: "Sucesso!",
    error: "Erro",
    noContent: "Sem conteúdo selecionado.",
    developedBy: "Desenvolvido por",
    buyCoffee: "Me pague um café? Sou apenas um Dev Mineiro",
    donateTitle: "Escolha como apoiar",
    donateBR: "Sou do Brasil 🇧🇷 (Pix)",
    donateInt: "Sou Gringo 🌎 (Ko-fi)",
    donateClose: "Cancelar",
    sessionExpiredTitle: "Sessão Expirada",
    sessionExpiredDesc: "Você não tem uma sessão ativa no SFMC. Por favor, faça o login.",
    imagesIncluded: "imagens incluídas"
  },
  en: {
    brandName: "SFMC Email & Template QuickSave",
    checkingSession: "Checking session...",
    actionsTitle: "ACTIONS",
    refresh: "Reload",
    expand: "Expand",
    collapse: "Collapse",
    filtersTitle: "FILTERS",
    optionsTitle: "OPTIONS",
    optionResolveBlocks: "Resolve Blocks",
    optionIncludeImages: "Include Images",
    foldersTitle: "Folders & Content",
    loading: "Loading...",
    filterAll: "All",
    filterFolder: "Folder",
    filterEmail: "Email",
    filterTemplate: "Template",
    filterBlock: "Block",
    downloadSelected: "Download Selected",
    sessionErrorTitle: "No Session",
    sessionErrorDesc: "Please login to Marketing Cloud to continue.",
    tryAgain: "Try Again",
    connected: "Connected",
    sessionLost: "Session not detected",
    emptyFolder: "Empty",
    downloading: "Downloading...",
    processing: "Processing",
    resolvingBlocks: "Resolving Content Blocks...",
    downloadingImages: "Downloading images...",
    success: "Success!",
    error: "Error",
    noContent: "No content selected.",
    developedBy: "Developed by",
    buyCoffee: "Buy me a coffee? I'm just a solo Dev",
    donateTitle: "Choose how to support",
    donateBR: "I'm from Brazil 🇧🇷 (Pix)",
    donateInt: "I'm International 🌎 (Ko-fi)",
    donateClose: "Cancel",
    sessionExpiredTitle: "Session Expired",
    sessionExpiredDesc: "You do not have an active session on SFMC. Please log in.",
    imagesIncluded: "images included"
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
  filters: {},
  options: {}
};

let searchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  initResizer();
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
  elements.searchType = document.getElementById('search-type');
  elements.searchInput = document.getElementById('search-input');
  elements.clearSearch = document.getElementById('clear-search');
  elements.filters = {
    email: document.getElementById('filter-htmlemail'),
    template: document.getElementById('filter-templatebasedemail'),
    block: document.getElementById('filter-htmlblock')
  };
  elements.options = {
    resolveBlocks: document.getElementById('option-resolve-blocks'),
    includeImages: document.getElementById('option-include-images')
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
  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.clearSearch.addEventListener('click', clearSearch);
  elements.btnDownload.addEventListener('click', downloadSelected);
  elements.selectAll.addEventListener('change', toggleSelectAll);

  elements.searchType.addEventListener('change', () => {
    const term = elements.searchInput.value.trim();
    if (term.length >= 3) {
      performSearch(term);
    }
  });

  const authorLink = document.getElementById('author-link');
  if (authorLink) {
    authorLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://linkedin.com/in/jolucas245' });
    });
  }

  const coffeeLink = document.getElementById('coffee-link');
  const donationModal = document.getElementById('donation-modal');
  const closeDonation = document.getElementById('close-donation');
  const btnDonateBR = document.getElementById('btn-donate-br');
  const btnDonateInt = document.getElementById('btn-donate-int');

  if (coffeeLink) {
    coffeeLink.addEventListener('click', (e) => {
      e.preventDefault();
      donationModal.classList.remove('hidden');
    });
  }
  if (closeDonation) {
    closeDonation.addEventListener('click', () => {
      donationModal.classList.add('hidden');
    });
  }
  if (donationModal) {
    donationModal.addEventListener('click', (e) => {
      if (e.target === donationModal) donationModal.classList.add('hidden');
    });
  }
  if (btnDonateBR) {
    btnDonateBR.addEventListener('click', () => {
      const linkBR = 'https://livepix.gg/vaquinha/sfmc-quicksave';
      chrome.tabs.create({ url: linkBR });
      donationModal.classList.add('hidden');
    });
  }
  if (btnDonateInt) {
    btnDonateInt.addEventListener('click', () => {
      const linkInt = 'https://ko-fi.com/jolucas245';
      chrome.tabs.create({ url: linkInt });
      donationModal.classList.add('hidden');
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

function handleSearchInput(e) {
  const term = e.target.value.trim();
  
  elements.clearSearch.classList.toggle('hidden', term.length === 0);
  
  if (searchTimeout) clearTimeout(searchTimeout);

  if (term.length < 3) {
    if (term.length === 0) renderFolderTree();
    return;
  }

  searchTimeout = setTimeout(() => performSearch(term), 500);
}

async function performSearch(term) {
  const searchType = elements.searchType.value; // 'all', 'folder', 'email', 'template', 'block'
  
  elements.folderTree.innerHTML = `
    <div class="placeholder-state">
      <div class="spinner"></div>
      <p>Buscando por "${term}"...</p>
    </div>`;

  try {
    let matchingFolders = [];
    let matchingAssets = [];

    if (searchType === 'all' || searchType === 'folder') {
      matchingFolders = state.categories.filter(cat => 
        cat.name.toLowerCase().includes(term.toLowerCase())
      );
    }

    if (searchType !== 'folder') {
      
      let assetTypesIds = [];
      
      switch(searchType) {
        case 'email':
          assetTypesIds = [208, 209, 242];
          break;
        case 'template':
          assetTypesIds = [207];
          break;
        case 'block':
          assetTypesIds = [196, 197];
          break;
        default:
          assetTypesIds = [208, 207, 197, 196, 209];
      }

      const response = await sendMessage({
        action: 'searchAssets',
        stack: state.stack,
        term: term,
        assetTypes: assetTypesIds 
      });

      if (response.success && response.data.items) {
        matchingAssets = response.data.items;
      }
    }

    renderSearchResults(term, matchingFolders, matchingAssets);

  } catch (error) {
    console.error(error);
    elements.folderTree.innerHTML = `<div style="padding:16px;color:red">Erro na busca.</div>`;
  }
}

function renderSearchResults(term, folders, assets) {
  elements.folderTree.innerHTML = '';
  
  if (folders.length === 0 && assets.length === 0) {
    elements.folderTree.innerHTML = `<div style="padding:16px;text-align:center">Nenhum resultado para "${term}"</div>`;
    return;
  }

  if (folders.length > 0) {
    const folderHeader = document.createElement('div');
    folderHeader.className = 'sidebar-label';
    folderHeader.style.padding = '8px';
    folderHeader.textContent = `PASTAS (${folders.length})`;
    elements.folderTree.appendChild(folderHeader);

    folders.forEach(cat => {
      const folderEl = createFolderElement({ ...cat, children: [] });
      elements.folderTree.appendChild(folderEl);
    });
  }

  if (assets.length > 0) {
    const assetHeader = document.createElement('div');
    assetHeader.className = 'sidebar-label';
    assetHeader.style.padding = '8px 8px 0 8px';
    assetHeader.style.marginTop = '12px';
    assetHeader.textContent = `CONTEÚDO (${assets.length})`;
    elements.folderTree.appendChild(assetHeader);

    assets.forEach(asset => {
      const assetEl = createAssetElement(asset);
      assetEl.style.marginLeft = '0';
      elements.folderTree.appendChild(assetEl);
    });
  }
}

function clearSearch() {
  elements.searchInput.value = '';
  elements.clearSearch.classList.add('hidden');
  renderFolderTree();
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

function initResizer() {
  const sidebar = document.querySelector('.sidebar');
  const resizer = document.getElementById('resizer');
  
  let isResizing = false;
  
  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const newWidth = e.clientX;

    if (newWidth > 50 && newWidth < 500) {
      sidebar.style.width = `${newWidth}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('resizing');
      document.body.style.cursor = 'default';
    }
  });
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
  if (elements.statusText) elements.statusText.textContent = text;
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
      handleApiError(new Error(response.error), elements.folderTree);
    }
  } catch (error) {
    handleApiError(error, elements.folderTree);
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
  
  const assetsContainer = childrenContainer.querySelector('.assets-container');

  if (isExpanded) {
    childrenContainer.classList.remove('expanded');
    toggle.classList.remove('rotated');
    icon.textContent = 'folder';
  } else {
    childrenContainer.classList.add('expanded');
    toggle.classList.add('rotated');
    icon.textContent = 'folder_open';
    
    const isDomEmpty = assetsContainer && assetsContainer.children.length === 0;
    
    if (!state.loadedCategories.has(category.id) || isDomEmpty) {
      await loadAssetsForCategory(category.id);
    }
  }
}

async function loadAssetsForCategory(categoryId) {
  const assetsContainer = document.querySelector(`.assets-container[data-category-id="${categoryId}"]`);
  if (!assetsContainer) return;

  if (state.assets[categoryId]) {
    renderAssets(assetsContainer, state.assets[categoryId]);
    state.loadedCategories.add(categoryId);
    return;
  }

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
      handleApiError(new Error(response.error), assetsContainer);
    }
  } catch (error) {
    handleApiError(error, assetsContainer);
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

async function refreshCategories() {
  state.categories = [];
  state.categoryTree = {};
  state.assets = {};
  state.loadedCategories.clear();
  state.selectedAssets.clear();
  updateSelectionCount();
  await loadCategories();
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
    if (cb) {
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
  const resolveBlocks = elements.options.resolveBlocks?.checked ?? true;
  const includeImages = elements.options.includeImages?.checked ?? false;
  
  showLoading(getMsg('downloading'));
  updateProgress(0, total);
  
  try {
    const files = [];
    const allImages = [];
    
    for (let i = 0; i < total; i++) {
      let statusText = `${getMsg('processing')} ${i + 1}/${total}`;
      if (resolveBlocks) {
        statusText += ` - ${getMsg('resolvingBlocks')}`;
      }
      updateProgress(i, total, statusText);
      
      const assetId = assetIds[i];
      
      const response = await sendMessage({
        action: 'getAssetComplete',
        stack: state.stack,
        assetId: assetId,
        resolveBlocks: resolveBlocks,
        includeImages: includeImages
      });
      
      if (response.success && response.data) {
        const assetData = response.data;
        
        if (assetData.html) {
          files.push({
            name: sanitizeFileName(assetData.name) + '.html',
            content: assetData.html
          });
        }
        
        if (assetData.images && assetData.images.length > 0) {
          for (const img of assetData.images) {
            allImages.push(img);
          }
        }
      }
    }
    
    if (files.length > 0) {
      if (files.length === 1 && allImages.length === 0) {
        downloadSingleFile(files[0]);
      } else {
        await downloadAsZip(files, allImages);
      }
      
      let successMsg = getMsg('success');
      if (allImages.length > 0) {
        successMsg += ` (${allImages.length} ${getMsg('imagesIncluded')})`;
      }
      showMessage(successMsg);
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

async function downloadAsZip(files, images = []) {
  const zip = new JSZip();
  
  files.forEach(f => zip.file(f.name, f.content));
  
  if (images.length > 0) {
    const imgFolder = zip.folder('images');
    for (const img of images) {
      if (img.data && img.filename) {
        imgFolder.file(img.filename, img.data);
      }
    }
  }
  
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

function handleApiError(error, containerElement) {
  if (error.message.includes('401') || error.message.includes('Not Authenticated')) {
    const titleEl = document.querySelector('#login-state h2');
    const descEl = document.querySelector('#login-state p');

    if (titleEl) titleEl.textContent = getMsg('sessionExpiredTitle');
    if (descEl) descEl.textContent = getMsg('sessionExpiredDesc');

    showLoginRequired();
    updateStatus('error', 'sessionLost');
    return;
  }

  if (containerElement) {
    containerElement.innerHTML = `
      <div style="padding:20px; text-align:center; color: var(--error);">
        <span class="material-icons" style="font-size: 24px; margin-bottom: 8px;">error_outline</span>
        <p style="margin:0; font-weight:500;">${getMsg('error')}</p>
        <p style="margin-top:4px; font-size:11px; opacity:0.8;">${error.message}</p>
      </div>`;
  }
}
