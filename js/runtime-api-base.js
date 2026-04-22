(function () {
  const host = (window.location && window.location.hostname) || '';
  const origin = (window.location && window.location.origin) || '';
  const search = new URLSearchParams((window.location && window.location.search) || '');
  const explicitFromQuery = (search.get('apiBase') || '').trim();
  const explicitFromStorage = (window.localStorage && window.localStorage.getItem('gameApiBaseOverride') || '').trim();
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const isGitHubPages = /\.github\.io$/i.test(host);

  // online profile: GitHub Pages defaults to external HTTPS API endpoint.
  const githubDefaultApiBase = 'https://lock-promote-repository-dense.trycloudflare.com';

  let apiBase = '';
  if (explicitFromQuery) {
    apiBase = explicitFromQuery;
  } else if (explicitFromStorage) {
    apiBase = explicitFromStorage;
  } else if (!isLocal && isGitHubPages) {
    apiBase = githubDefaultApiBase;
  }

  apiBase = apiBase.replace(/\/+$/, '');

  const globalObj = window;
  globalObj.__GAME_API_BASE__ = apiBase;

  if (!apiBase || !globalObj.fetch) {
    return;
  }

  function rewriteUrl(urlLike) {
    if (!urlLike) return urlLike;
    const text = String(urlLike);
    if (text.startsWith('/api/')) {
      return apiBase + text;
    }
    const originApiPrefix = origin + '/api/';
    if (text.startsWith(originApiPrefix)) {
      return apiBase + text.slice(origin.length);
    }
    return text;
  }

  const originalFetch = globalObj.fetch.bind(globalObj);
  globalObj.fetch = function wrappedFetch(input, init) {
    if (typeof input === 'string' || input instanceof URL) {
      const next = rewriteUrl(input);
      const originalInput = input;
      return originalFetch(next, init).catch((error) => {
        if (next === String(originalInput)) {
          throw error;
        }
        return originalFetch(originalInput, init);
      });
    }

    if (input instanceof Request) {
      const nextUrl = rewriteUrl(input.url);
      if (nextUrl !== input.url) {
        const nextReq = new Request(nextUrl, input);
        return originalFetch(nextReq, init);
      }
    }

    return originalFetch(input, init);
  };
})();
