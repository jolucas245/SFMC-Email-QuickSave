(function () {
  'use strict';

  function detectStack() {
    const hostname = window.location.hostname;

    let match = hostname.match(/mc\.([^.]+)\.exacttarget\.com/);
    if (match && match[1] !== 'exacttarget') {
      return match[1] + '.';
    }

    match = hostname.match(/([^.]+)\.marketingcloudapps\.com/);
    if (match) {
      const parts = match[1].split('.');
      if (parts.length > 1) {
        return parts[parts.length - 1] + '.';
      }
    }

    try {
      if (window.parent && window.parent.location) {
        const parentMatch = window.parent.location.hostname.match(/mc\.([^.]+)\.exacttarget\.com/);
        if (parentMatch && parentMatch[1] !== 'exacttarget') {
          return parentMatch[1] + '.';
        }
      }
    } catch (e) {
    }

    return '';
  }

  function isMarketingCloud() {
    const hostname = window.location.hostname;
    return hostname.includes('exacttarget.com') || hostname.includes('marketingcloudapps.com');
  }

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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
      sendResponse(getPageInfo());
    } else if (request.action === 'detectStack') {
      sendResponse({ stack: detectStack() });
    } else if (request.action === 'isLoggedIn') {
      const isLoggedIn = document.querySelector('[data-mc-user]') !== null ||
        document.querySelector('.mc-header') !== null ||
        document.querySelector('#mc-header') !== null ||
        window.location.pathname.includes('/cloud/') ||
        window.location.pathname.includes('/contentbuilder');
      sendResponse({ isLoggedIn });
    }
    return true;
  });

  if (isMarketingCloud()) {
    chrome.runtime.sendMessage({
      action: 'pageLoaded',
      pageInfo: getPageInfo()
    }).catch(() => {
    });
  }
})();
