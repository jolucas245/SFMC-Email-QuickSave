// SFMC Email Downloader - Background Service Worker
// Gerencia requisições à API do Marketing Cloud usando a sessão do navegador
// Baseado na análise do SFMC Companion

// Cache para o token de acesso
let accessTokenCache = {
  token: null,
  expiresAt: 0,
  stack: null,
  businessUnitId: null
};

// Obter URL base do Marketing Cloud
function getBaseUrl(stack) {
  // Se stack é vazio ou 's1.', usar sem prefixo
  if (!stack || stack === 's1.' || stack === 's1' || stack === '') {
    return 'https://mc.exacttarget.com';
  }
  // Remover ponto final se existir
  const cleanStack = stack.replace(/\.$/, '');
  return `https://mc.${cleanStack}.exacttarget.com`;
}

// Obter token de acesso da sessão ativa (método do SFMC Companion)
async function getAccessToken(stack) {
  const now = Date.now();
  
  // Verificar cache
  if (accessTokenCache.token && accessTokenCache.stack === stack && accessTokenCache.expiresAt > now) {
    return accessTokenCache;
  }
  
  try {
    const baseUrl = getBaseUrl(stack);
    
    // Endpoint usado pelo SFMC Companion para obter token
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
    
    // Obter informações do usuário
    const userResponse = await fetch(`${baseUrl}/cloud/fuelapi/legacy/v1/beta/organization/user/@me`, {
      method: 'GET',
      credentials: 'include'
    });
    
    let businessUnitId = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      businessUnitId = userData.businessUnitId;
    }
    
    // Atualizar cache
    accessTokenCache = {
      token: data.accessToken,
      expiresAt: now + (data.expiresIn * 1000) - 60000, // 1 minuto de margem
      stack: stack,
      businessUnitId: businessUnitId
    };
    
    return accessTokenCache;
  } catch (error) {
    console.error('Erro ao obter token:', error);
    throw error;
  }
}

// Fazer requisição usando a sessão do navegador (sem token no header)
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

// Fazer requisição com paginação (método do SFMC Companion)
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
    
    // Verificar se há mais páginas
    if (items.length < pageSize || items.length === 0) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  return results;
}

// Listar categorias (pastas) do Content Builder
async function listAllCategories(stack) {
  // Usar endpoint interno do SFMC (fuelapi)
  return await fetchWithPagination(
    stack, 
    '/cloud/fuelapi/asset/v1/content/categories',
    'items',
    500
  );
}

// Listar assets de uma categoria específica
async function listAssetsByCategory(stack, categoryId, assetTypes = ['htmlemail', 'templatebasedemail', 'htmlblock']) {
  const baseUrl = getBaseUrl(stack);
  
  // Mapear tipos para IDs
  const typeIdMap = {
    'htmlemail': 208,
    'templatebasedemail': 207,
    'htmlblock': 197,
    'textonlyemail': 209
  };
  
  const typeIds = assetTypes
    .map(type => typeIdMap[type.toLowerCase()])
    .filter(id => id !== undefined);
  
  // Usar query POST como o SFMC Companion
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
    // Fallback para GET simples
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

// Obter conteúdo de um asset
async function getAssetContent(stack, assetId) {
  return await makeSessionRequest(stack, `/cloud/fuelapi/asset/v1/content/assets/${assetId}`);
}

// Obter todas as pastas do sistema (método do SFMC Companion)
async function getAllFolders(stack) {
  const allFolders = [];
  
  // Primeiro obter pastas raiz
  const rootFolders = await makeSessionRequest(stack, '/cloud/fuelapi/legacy/v1/beta/folder/0/children');
  
  // Para cada tipo de pasta raiz, obter todas as subpastas
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

// Obter Data Extensions (método do SFMC Companion)
async function getDataExtensions(stack) {
  // Primeiro obter as pastas para encontrar a pasta "Data Extensions"
  const folders = await getAllFolders(stack);
  const deRootFolder = folders.find(f => f.parentId === 0 && f.name === 'Data Extensions');
  
  const allDEs = [];
  
  if (deRootFolder) {
    // Obter DEs da pasta raiz
    const rootDEs = await fetchWithPagination(
      stack,
      `/cloud/fuelapi/internal/v1/customobjects/category/${deRootFolder.categoryId}?orderBy=name%20asc`,
      'items',
      1000
    );
    allDEs.push(...rootDEs);
  }
  
  // Buscar DEs adicionais por caractere (técnica do SFMC Companion)
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

// Criar pasta de Data Extension
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

// Criar Data Extension
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

// Inserir linha em Data Extension
async function insertDERow(stack, deKey, rowData) {
  return await makeSessionRequest(stack, `/cloud/fuelapi/data-internal/v1/customobjectdata/key/${deKey}/rows`, {
    method: 'POST',
    body: JSON.stringify({ items: [rowData] })
  });
}

// Listener para mensagens do popup e content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch (request.action) {
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
  return true; // Indica que a resposta será assíncrona
});

// Limpar cache quando a extensão é instalada/atualizada
chrome.runtime.onInstalled.addListener(() => {
  accessTokenCache = {
    token: null,
    expiresAt: 0,
    stack: null,
    businessUnitId: null
  };
  console.log('SFMC Email Downloader instalado/atualizado');
});

console.log('SFMC Email Downloader - Background script carregado');
