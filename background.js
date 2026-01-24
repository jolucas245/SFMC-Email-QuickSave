let accessTokenCache = {
  token: null,
  expiresAt: 0,
  stack: null,
  businessUnitId: null
};

function getBaseUrl(stack) {
  if (!stack || stack === 's1.' || stack === 's1' || stack === '') {
    return 'https://mc.exacttarget.com';
  }
  const cleanStack = stack.replace(/\.$/, '');
  return `https://mc.${cleanStack}.exacttarget.com`;
}

async function getAccessToken(stack) {
  const now = Date.now();
  
  if (accessTokenCache.token && accessTokenCache.stack === stack && accessTokenCache.expiresAt > now) {
    return accessTokenCache;
  }
  
  try {
    const baseUrl = getBaseUrl(stack);
    const response = await fetch(`${baseUrl}/cloud/update-token.json`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao obter token: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.accessToken) {
      throw new Error('Token não encontrado - sessão inválida');
    }
    
    const userResponse = await fetch(`${baseUrl}/cloud/fuelapi/legacy/v1/beta/organization/user/@me`, {
      method: 'GET',
      credentials: 'include'
    });
    
    let businessUnitId = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      businessUnitId = userData.businessUnitId;
    }
    
    accessTokenCache = {
      token: data.accessToken,
      expiresAt: now + (data.expiresIn * 1000) - 60000,
      stack: stack,
      businessUnitId: businessUnitId
    };
    
    return accessTokenCache;
  } catch (error) {
    console.error('Erro ao obter token:', error);
    throw error;
  }
}

async function makeSessionRequest(stack, endpoint, options = {}) {
  const baseUrl = getBaseUrl(stack);
  const url = baseUrl + endpoint;
  
  const defaultOptions = {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

async function fetchWithPagination(stack, endpoint, itemsKey = 'items', pageSize = 500) {
  const results = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const paginatedEndpoint = `${endpoint}${separator}$pageSize=${pageSize}&$page=${page}`;
    
    const response = await makeSessionRequest(stack, paginatedEndpoint);
    
    const items = response[itemsKey] || [];
    results.push(...items);
    
    if (items.length < pageSize || items.length === 0) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  return results;
}

async function listAllCategories(stack) {
  return await fetchWithPagination(
    stack, 
    '/cloud/fuelapi/asset/v1/content/categories',
    'items',
    500
  );
}

async function listAssetsByCategory(stack, categoryId, assetTypes = ['htmlemail', 'templatebasedemail', 'htmlblock']) {
  const baseUrl = getBaseUrl(stack);
  
  const typeIdMap = {
    'htmlemail': 208,
    'templatebasedemail': 207,
    'htmlblock': 197,
    'textonlyemail': 209
  };
  
  const typeIds = assetTypes
    .map(type => typeIdMap[type.toLowerCase()])
    .filter(id => id !== undefined);
  
  const query = {
    page: {
      page: 1,
      pageSize: 500
    },
    query: {
      leftOperand: {
        property: 'category.id',
        simpleOperator: 'equal',
        value: categoryId
      },
      logicalOperator: 'AND',
      rightOperand: {
        property: 'assetType.id',
        simpleOperator: 'in',
        value: typeIds.length > 0 ? typeIds : [208, 207, 197]
      }
    },
    sort: [
      {
        property: 'name',
        direction: 'ASC'
      }
    ],
    fields: ['id', 'name', 'assetType', 'category', 'modifiedDate', 'createdDate']
  };
  
  try {
    const response = await makeSessionRequest(stack, '/cloud/fuelapi/asset/v1/content/assets/query', {
      method: 'POST',
      body: JSON.stringify(query)
    });
    return response;
  } catch (error) {
    console.log('Tentando método alternativo...');
    const items = await fetchWithPagination(
      stack,
      `/cloud/fuelapi/asset/v1/content/assets?$filter=category.id%20eq%20${categoryId}`,
      'items',
      500
    );
    return { items, count: items.length };
  }
}

async function getAssetContent(stack, assetId) {
  return await makeSessionRequest(stack, `/cloud/fuelapi/asset/v1/content/assets/${assetId}`);
}

async function getAssetById(stack, assetId) {
  return await makeSessionRequest(stack, `/cloud/fuelapi/asset/v1/content/assets/${assetId}`);
}

async function getAssetByCustomerKey(stack, customerKey) {
  const query = {
    page: { page: 1, pageSize: 1 },
    query: {
      property: 'customerKey',
      simpleOperator: 'equal',
      value: customerKey
    }
  };
  
  const response = await makeSessionRequest(stack, '/cloud/fuelapi/asset/v1/content/assets/query', {
    method: 'POST',
    body: JSON.stringify(query)
  });
  
  if (response.items && response.items.length > 0) {
    return await getAssetById(stack, response.items[0].id);
  }
  return null;
}

function extractContentBlockReferences(html) {
  const references = [];
  
  const keyPattern = /%%=ContentBlockByKey\s*\(\s*["']([^"']+)["']\s*\)=%%/gi;
  let match;
  while ((match = keyPattern.exec(html)) !== null) {
    references.push({ type: 'key', value: match[1], fullMatch: match[0] });
  }
  
  const idPattern = /%%=ContentBlockById\s*\(\s*["']?(\d+)["']?\s*\)=%%/gi;
  while ((match = idPattern.exec(html)) !== null) {
    references.push({ type: 'id', value: match[1], fullMatch: match[0] });
  }
  
  const namePattern = /%%=ContentBlockByName\s*\(\s*["']([^"']+)["']\s*\)=%%/gi;
  while ((match = namePattern.exec(html)) !== null) {
    references.push({ type: 'name', value: match[1], fullMatch: match[0] });
  }
  
  return references;
}

async function resolveContentBlock(stack, reference) {
  try {
    let asset = null;
    
    if (reference.type === 'id') {
      asset = await getAssetById(stack, reference.value);
    } else if (reference.type === 'key') {
      asset = await getAssetByCustomerKey(stack, reference.value);
    } else if (reference.type === 'name') {
      const query = {
        page: { page: 1, pageSize: 1 },
        query: {
          property: 'name',
          simpleOperator: 'equal',
          value: reference.value
        }
      };
      const response = await makeSessionRequest(stack, '/cloud/fuelapi/asset/v1/content/assets/query', {
        method: 'POST',
        body: JSON.stringify(query)
      });
      if (response.items && response.items.length > 0) {
        asset = await getAssetById(stack, response.items[0].id);
      }
    }
    
    if (asset) {
      return asset.views?.html?.content || asset.content || '';
    }
    return '';
  } catch (error) {
    console.error(`Erro ao resolver content block ${reference.type}:${reference.value}:`, error);
    return `<!-- Content Block não encontrado: ${reference.value} -->`;
  }
}

async function compileAssetContent(stack, html, maxDepth = 5) {
  if (maxDepth <= 0) return html;
  
  let compiledHtml = html;
  const references = extractContentBlockReferences(compiledHtml);
  
  if (references.length === 0) {
    return compiledHtml;
  }
  
  for (const ref of references) {
    const blockContent = await resolveContentBlock(stack, ref);
    compiledHtml = compiledHtml.replace(ref.fullMatch, blockContent);
  }
  
  return await compileAssetContent(stack, compiledHtml, maxDepth - 1);
}

function compileAssetSlots(asset) {
  let html = asset.views?.html?.content || asset.content || '';
  
  if (asset.views?.html?.slots) {
    const slots = asset.views.html.slots;
    for (const [slotKey, slotData] of Object.entries(slots)) {
      if (slotData.blocks) {
        let slotContent = '';
        for (const block of slotData.blocks) {
          if (block.content) {
            slotContent += block.content;
          } else if (block.superContent) {
            slotContent += block.superContent;
          }
        }
        const slotPlaceholder = new RegExp(`<div[^>]*data-slot=["']${slotKey}["'][^>]*>.*?</div>`, 'gis');
        html = html.replace(slotPlaceholder, slotContent);
      }
    }
  }
  
  if (asset.blocks) {
    for (const block of asset.blocks) {
      if (block.content) {
        const blockPlaceholder = new RegExp(`%%=ContentBlockByKey\\s*\\(\\s*["']${block.customerKey}["']\\s*\\)=%%`, 'gi');
        html = html.replace(blockPlaceholder, block.content);
      }
    }
  }
  
  return html;
}

function extractImageUrls(html) {
  const urls = new Set();
  
  const srcPattern = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = srcPattern.exec(html)) !== null) {
    if (match[1] && !match[1].startsWith('data:')) {
      urls.add(match[1]);
    }
  }
  
  const bgPattern = /background(?:-image)?:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((match = bgPattern.exec(html)) !== null) {
    if (match[1] && !match[1].startsWith('data:')) {
      urls.add(match[1]);
    }
  }
  
  const bgShortPattern = /background:\s*[^;]*url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((match = bgShortPattern.exec(html)) !== null) {
    if (match[1] && !match[1].startsWith('data:')) {
      urls.add(match[1]);
    }
  }
  
  return Array.from(urls);
}

async function downloadImage(url) {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    
    let filename = url.split('/').pop().split('?')[0];
    if (!filename || filename.length > 100) {
      filename = 'image_' + Date.now();
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!filename.includes('.')) {
      if (contentType.includes('png')) filename += '.png';
      else if (contentType.includes('gif')) filename += '.gif';
      else if (contentType.includes('webp')) filename += '.webp';
      else filename += '.jpg';
    }
    
    return {
      filename: filename,
      data: arrayBuffer,
      contentType: contentType,
      originalUrl: url
    };
  } catch (error) {
    console.error(`Erro ao baixar imagem ${url}:`, error);
    return null;
  }
}

async function processAssetComplete(stack, assetId, options = {}) {
  const { resolveBlocks = true, includeImages = false } = options;
  
  const asset = await getAssetContent(stack, assetId);
  
  let html = asset.views?.html?.content || asset.content || '';
  
  html = compileAssetSlots(asset);
  
  if (resolveBlocks) {
    html = await compileAssetContent(stack, html, 5);
  }
  
  const result = {
    name: asset.name,
    html: html,
    images: []
  };
  
  if (includeImages) {
    const imageUrls = extractImageUrls(html);
    for (const url of imageUrls) {
      const imageData = await downloadImage(url);
      if (imageData) {
        result.images.push(imageData);
        html = html.split(url).join(`images/${imageData.filename}`);
      }
    }
    result.html = html;
  }
  
  return result;
}

async function getAllFolders(stack) {
  const allFolders = [];
  
  const rootFolders = await makeSessionRequest(stack, '/cloud/fuelapi/legacy/v1/beta/folder/0/children');
  
  for (const folder of rootFolders.entry || []) {
    try {
      const typeFolders = await fetchWithPagination(
        stack,
        `/cloud/fuelapi/automation/v1/folders/?$filter=categorytype%20eq%20${folder.type}`,
        'items',
        500
      );
      allFolders.push(...typeFolders);
    } catch (e) {
      console.log(`Erro ao obter pastas do tipo ${folder.type}:`, e);
    }
  }
  
  return allFolders;
}

async function getDataExtensions(stack) {
  const folders = await getAllFolders(stack);
  const deRootFolder = folders.find(f => f.parentId === 0 && f.name === 'Data Extensions');
  
  const allDEs = [];
  
  if (deRootFolder) {
    const rootDEs = await fetchWithPagination(
      stack,
      `/cloud/fuelapi/internal/v1/customobjects/category/${deRootFolder.categoryId}?orderBy=name%20asc`,
      'items',
      1000
    );
    allDEs.push(...rootDEs);
  }
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const foundIds = new Set(allDEs.map(de => de.id));
  
  for (const char of chars) {
    try {
      const searchDEs = await fetchWithPagination(
        stack,
        `/cloud/fuelapi/data-internal/v1/customobjects?retrievalType=1&includeFilterActivity=true&includeImportActivity=true&includeFullPath=true&$search=${char}%`,
        'items',
        1000
      );
      
      for (const de of searchDEs) {
        if (!foundIds.has(de.id)) {
          foundIds.add(de.id);
          allDEs.push(de);
        }
      }
    } catch (e) {
      console.log(`Erro ao buscar DEs com "${char}":`, e);
    }
  }
  
  return allDEs;
}

async function createDEFolder(stack, folderName, parentCategoryId) {
  const payload = {
    name: folderName,
    parentId: parentCategoryId,
    contentType: 'dataextension'
  };
  
  return await makeSessionRequest(stack, '/cloud/fuelapi/automation/v1/folders/', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function createDataExtension(stack, config) {
  const payload = {
    name: config.name,
    customerKey: config.customerKey || config.name.replace(/\s+/g, '_'),
    description: config.description || 'Criada pelo SFMC Email Downloader',
    categoryId: config.categoryId,
    isSendable: config.isSendable !== undefined ? config.isSendable : true,
    sendableDataExtensionField: {
      name: config.sendableField || 'EmailAddress',
      fieldType: 'EmailAddress'
    },
    sendableSubscriberField: {
      name: 'Subscriber Key'
    },
    fields: config.fields || [
      {
        name: 'EmailAddress',
        fieldType: 'EmailAddress',
        maxLength: 254,
        isPrimaryKey: true,
        isRequired: true
      }
    ]
  };
  
  return await makeSessionRequest(stack, '/cloud/fuelapi/data-internal/v1/customobjects', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function insertDERow(stack, deKey, rowData) {
  return await makeSessionRequest(stack, `/cloud/fuelapi/data-internal/v1/customobjectdata/key/${deKey}/rows`, {
    method: 'POST',
    body: JSON.stringify({ items: [rowData] })
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch(request.action) {

        case 'searchAssets':
          const defaultTypes = [208, 207, 197, 196, 209];
          const filterTypes = request.assetTypes && request.assetTypes.length > 0 
            ? request.assetTypes 
            : defaultTypes;
          const searchQuery = {
            page: { page: 1, pageSize: 100 },
            query: {
              leftOperand: {
                property: "name",
                simpleOperator: "like",
                value: request.term
              },
              logicalOperator: "AND",
              rightOperand: {
                property: "assetType.id",
                simpleOperator: "in",
                value: filterTypes
              }
            },
            fields: ['id', 'name', 'assetType', 'category', 'modifiedDate']
          };

          const searchResults = await makeSessionRequest(request.stack, '/cloud/fuelapi/asset/v1/content/assets/query', {
            method: 'POST',
            body: JSON.stringify(searchQuery)
          });
          return { success: true, data: searchResults };

        case 'checkSession':
          try {
            const tokenData = await getAccessToken(request.stack);
            return { 
              success: true, 
              hasSession: true,
              businessUnitId: tokenData.businessUnitId
            };
          } catch (error) {
            return { success: true, hasSession: false, error: error.message };
          }
          
        case 'getCategories':
          const categories = await listAllCategories(request.stack);
          return { success: true, data: categories };
          
        case 'getAssetsByCategory':
          const assets = await listAssetsByCategory(request.stack, request.categoryId, request.assetTypes);
          return { success: true, data: assets };
          
        case 'getAssetContent':
          const asset = await getAssetContent(request.stack, request.assetId);
          return { success: true, data: asset };
          
        case 'getAssetComplete':
          const completeAsset = await processAssetComplete(
            request.stack, 
            request.assetId, 
            {
              resolveBlocks: request.resolveBlocks !== false,
              includeImages: request.includeImages === true
            }
          );
          return { success: true, data: completeAsset };
          
        case 'getFolders':
          const folders = await getAllFolders(request.stack);
          return { success: true, data: folders };
          
        case 'getDataExtensions':
          const des = await getDataExtensions(request.stack);
          return { success: true, data: des };
          
        case 'createDEFolder':
          const newFolder = await createDEFolder(request.stack, request.folderName, request.parentCategoryId);
          return { success: true, data: newFolder };
          
        case 'createDataExtension':
          const newDE = await createDataExtension(request.stack, request.config);
          return { success: true, data: newDE };
          
        case 'insertDERow':
          const insertResult = await insertDERow(request.stack, request.deKey, request.rowData);
          return { success: true, data: insertResult };
          
        case 'downloadFile':
          const downloadId = await chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: request.saveAs || false
          });
          return { success: true, downloadId };
          
        default:
          return { success: false, error: 'Ação desconhecida: ' + request.action };
      }
    } catch (error) {
      console.error('Erro no background:', error);
      return { success: false, error: error.message };
    }
  };
  
  handleAsync().then(sendResponse);
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  accessTokenCache = {
    token: null,
    expiresAt: 0,
    stack: null,
    businessUnitId: null
  };
  console.log('SFMC QuickSave instalado/atualizado');
});

console.log('SFMC QuickSave - Background script carregado');
