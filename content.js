// SFMC Email Downloader - Content Script
// Detecta a sessão ativa do Marketing Cloud e extrai informações

(function() {
  'use strict';
  
  // Detectar o stack a partir da URL atual
  function detectStack() {
    const hostname = window.location.hostname;
    
    // Padrão: mc.s13.exacttarget.com -> s13.
    // Padrão: mc.exacttarget.com -> "" (s1)
    // Padrão: content-builder.s13.marketingcloudapps.com -> s13.
    
    let match = hostname.match(/mc\.([^.]+)\.exacttarget\.com/);
    if (match && match[1] !== 'exacttarget') {
      return match[1] + '.';
    }
    
    match = hostname.match(/([^.]+)\.marketingcloudapps\.com/);
    if (match) {
      // Extrair stack do subdomínio (ex: content-builder.s13 -> s13)
      const parts = match[1].split('.');
      if (parts.length > 1) {
        return parts[parts.length - 1] + '.';
      }
    }
    
    // Verificar se há stack na URL do iframe pai
    try {
      if (window.parent && window.parent.location) {
        const parentMatch = window.parent.location.hostname.match(/mc\.([^.]+)\.exacttarget\.com/);
        if (parentMatch && parentMatch[1] !== 'exacttarget') {
          return parentMatch[1] + '.';
        }
      }
    } catch (e) {
      // Cross-origin, ignorar
    }
    
    return '';
  }
  
  // Verificar se estamos no Marketing Cloud
  function isMarketingCloud() {
    const hostname = window.location.hostname;
    return hostname.includes('exacttarget.com') || hostname.includes('marketingcloudapps.com');
  }
  
  // Extrair informações da página atual
  function getPageInfo() {
    return {
      url: window.location.href,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      stack: detectStack(),
      isMarketingCloud: isMarketingCloud(),
      timestamp: Date.now()
    };
  }
  
  // Listener para mensagens da extensão
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
      sendResponse(getPageInfo());
    } else if (request.action === 'detectStack') {
      sendResponse({ stack: detectStack() });
    } else if (request.action === 'isLoggedIn') {
      // Verificar se há elementos que indicam login
      const isLoggedIn = document.querySelector('[data-mc-user]') !== null ||
                         document.querySelector('.mc-header') !== null ||
                         document.querySelector('#mc-header') !== null ||
                         window.location.pathname.includes('/cloud/') ||
                         window.location.pathname.includes('/contentbuilder');
      sendResponse({ isLoggedIn });
    }
    return true;
  });
  
  // Notificar a extensão quando a página carregar
  if (isMarketingCloud()) {
    chrome.runtime.sendMessage({
      action: 'pageLoaded',
      pageInfo: getPageInfo()
    }).catch(() => {
      // Ignorar erros se o popup não estiver aberto
    });
  }
})();
