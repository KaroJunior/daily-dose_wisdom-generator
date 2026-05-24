(function() {
  // ----------------------------------------------
  // DOM elements
  const outputTextEl = document.getElementById('mainOutputText');
  const outputAuthorEl = document.getElementById('mainOutputAuthor');
  const adviceBtn = document.getElementById('adviceBtn');
  const motivationBtn = document.getElementById('motivationBtn');
  const copyBtn = document.getElementById('copyBtn');
  const shareBtn = document.getElementById('shareBtn');
  const regenerateBtn = document.getElementById('regenerateBtn');
  const contextTag = document.getElementById('contextTag');
  const quoteContainer = document.getElementById('quoteContainer');

  // ---------- STATE ----------
  let currentMode = 'advice';
  let currentQuoteData = { text: '', author: null };
  let isDailyLocked = false;
  let isFetching = false;
  
  // DEBUG: Enable console logging for troubleshooting
  const DEBUG = true;

  // ---------- STORAGE KEYS ----------
  const STORAGE_DATE_KEY = 'dailydose_date';
  const STORAGE_RESULT_KEY = 'dailydose_result';
  const STORAGE_MODE_KEY = 'dailydose_mode';

  // Helper: get today's YYYY-MM-DD
  function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Smooth transition with fade + vertical shift
  async function smoothUpdateContent(newText, newAuthor, newContextLabel) {
    // fade out
    quoteContainer.classList.add('fade-out');
    await new Promise(resolve => setTimeout(resolve, 160));

    // update content
    outputTextEl.innerText = newText || "Stay focused.";
    if (newAuthor && newAuthor.trim() !== "" && newAuthor.toLowerCase() !== 'unknown') {
      outputAuthorEl.innerText = `— ${newAuthor.trim()}`;
    } else {
      outputAuthorEl.innerText = '';
    }

    // update context badge
    if (newContextLabel) contextTag.innerText = newContextLabel;

    // fade in
    quoteContainer.classList.remove('fade-out');
    quoteContainer.classList.add('fade-in');

    setTimeout(() => {
      quoteContainer.classList.remove('fade-in');
    }, 250);
  }

  // Store daily dose
  function storeDailyDose(data, modeUsed) {
    const today = getTodayString();
    localStorage.setItem(STORAGE_DATE_KEY, today);
    localStorage.setItem(STORAGE_RESULT_KEY, JSON.stringify({ text: data.text, author: data.author || null }));
    localStorage.setItem(STORAGE_MODE_KEY, modeUsed);
  }

  // Get stored daily dose
  function getStoredDailyDose() {
    const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
    const storedResultRaw = localStorage.getItem(STORAGE_RESULT_KEY);
    const storedMode = localStorage.getItem(STORAGE_MODE_KEY);
    const today = getTodayString();

    if (storedDate === today && storedResultRaw && storedMode) {
      try {
        const parsed = JSON.parse(storedResultRaw);
        if (parsed.text && parsed.text.length > 0) {
          return { text: parsed.text, author: parsed.author, mode: storedMode };
        }
      } catch(e) { return null; }
    }
    return null;
  }

  // Update active button styling
  function setActiveModeButton(mode) {
    if (mode === 'advice') {
      adviceBtn.classList.add('active');
      motivationBtn.classList.remove('active');
    } else {
      motivationBtn.classList.add('active');
      adviceBtn.classList.remove('active');
    }
  }

  // Display quote with all updates
  async function displayQuote(data, mode, dailyFlag, updateStorage = true) {
    currentQuoteData = { text: data.text, author: data.author || null };
    currentMode = mode;
    isDailyLocked = dailyFlag;

    const label = dailyFlag ? "TODAY'S DOSE" : (mode === 'advice' ? "ADVICE" : "MOTIVATION");
    await smoothUpdateContent(data.text, data.author, label);
    setActiveModeButton(mode);

    if (dailyFlag && updateStorage) {
      storeDailyDose(data, mode);
    }
  }

  // ---------- API & FALLBACK WITH CACHE-BUSTING ----------
  async function fetchWithTimeout(url, timeoutMs = 2000, disableCache = false) {
    let finalUrl = url;
    
    // CRITICAL FIX: Add cache-busting for AdviceSlip API
    if (disableCache) {
      const separator = url.includes('?') ? '&' : '?';
      finalUrl = `${url}${separator}_=${Date.now()}`;
      if (DEBUG) console.log(`[Cache-Busting] Added timestamp to URL: ${finalUrl}`);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Use cache: 'no-store' to prevent browser caching
      const response = await fetch(finalUrl, { 
        signal: controller.signal, 
        headers: { 'Accept': 'application/json' },
        cache: disableCache ? 'no-store' : 'default'
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  function normalizeAdviceSlip(data) {
    if (data && data.slip && data.slip.advice) {
      const advice = data.slip.advice;
      if (DEBUG) console.log(`[AdviceSlip] Success: "${advice.substring(0, 50)}..."`);
      return { text: advice, author: null };
    }
    throw new Error('Invalid advice');
  }
  
  function normalizeZenQuote(data) {
    if (Array.isArray(data) && data[0] && data[0].q) {
      if (DEBUG) console.log(`[ZenQuote] Success: "${data[0].q.substring(0, 50)}..."`);
      return { text: data[0].q, author: data[0].a || null };
    }
    throw new Error('ZenQuote error');
  }
  
  function normalizeQuotable(data) {
    if (data && data.content) {
      if (DEBUG) console.log(`[Quotable] Success: "${data.content.substring(0, 50)}..."`);
      return { text: data.content, author: data.author || null };
    }
    throw new Error('Quotable error');
  }
  
  function normalizeDummyJson(data) {
    if (data && data.quote) {
      if (DEBUG) console.log(`[DummyJSON] Success: "${data.quote.substring(0, 50)}..."`);
      return { text: data.quote, author: data.author || null };
    }
    throw new Error('Dummy error');
  }
  
  function getFallbackContent(type) {
    const fallbacks = {
      advice: [
        "Break the routine. Small steps lead to clarity.",
        "Trust your gut. It knows the way before your mind does.",
        "Don't wait for perfect conditions. Start where you are."
      ],
      motivation: [
        "Discipline equals freedom. Move forward.",
        "The only bad workout is the one that didn't happen.",
        "Your future self is watching. Make them proud."
      ]
    };
    const list = fallbacks[type];
    const randomIndex = Math.floor(Math.random() * list.length);
    if (DEBUG) console.log(`[Fallback] Using local fallback #${randomIndex + 1} for ${type}`);
    return { text: list[randomIndex], author: null };
  }

  const ADVICE_ENDPOINTS = [
    { 
      url: 'https://api.adviceslip.com/advice', 
      normalize: normalizeAdviceSlip,
      needsCacheBust: true  // CRITICAL FIX: AdviceSlip API caches responses
    },
    { 
      url: 'https://zenquotes.io/api/random', 
      normalize: normalizeZenQuote,
      needsCacheBust: false
    },
    { 
      url: 'https://api.quotable.io/random', 
      normalize: normalizeQuotable,
      needsCacheBust: false
    }
  ];
  
  const MOTIVATION_ENDPOINTS = [
    { 
      url: 'https://zenquotes.io/api/random', 
      normalize: normalizeZenQuote,
      needsCacheBust: false
    },
    { 
      url: 'https://dummyjson.com/quotes/random', 
      normalize: normalizeDummyJson,
      needsCacheBust: false
    },
    { 
      url: 'https://api.quotable.io/random', 
      normalize: normalizeQuotable,
      needsCacheBust: false
    }
  ];

  async function tryAPIsSequentially(endpoints, fallbackType, requestId = null) {
    if (DEBUG) console.log(`[API Chain] Starting ${fallbackType} request (ID: ${requestId}) with ${endpoints.length} endpoints`);
    
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        if (DEBUG) console.log(`[API Chain] Attempt ${i + 1}/${endpoints.length}: ${endpoint.url.split('?')[0]}`);
        
        // Apply cache-busting only for endpoints that need it (AdviceSlip)
        const needsCacheBust = endpoint.needsCacheBust === true;
        const data = await fetchWithTimeout(endpoint.url, 2000, needsCacheBust);
        const normalized = endpoint.normalize(data);
        
        if (normalized && normalized.text && normalized.text.trim().length > 0) {
          if (DEBUG) console.log(`[API Chain] ✓ Success from endpoint ${i + 1} for ${fallbackType}`);
          return normalized;
        } else {
          throw new Error('Empty text after normalization');
        }
      } catch (err) {
        if (DEBUG) console.log(`[API Chain] ✗ Failed endpoint ${i + 1}: ${err.message}`);
        continue;
      }
    }
    
    if (DEBUG) console.log(`[API Chain] ⚠ All APIs failed for ${fallbackType}, using fallback`);
    return getFallbackContent(fallbackType);
  }

  // ---------- FETCH ADVICE WITH FRESH STATE ----------
  let activeAdviceRequest = null;
  let lastAdviceRequestId = 0;
  
  async function fetchAdvice() {
    // CRITICAL FIX: Always create a new request, never reuse previous promise
    // This prevents stale cached responses from being returned
    lastAdviceRequestId++;
    const currentRequestId = lastAdviceRequestId;
    
    if (DEBUG) console.log(`[Advice] Starting fresh advice request #${currentRequestId}`);
    
    const request = (async () => {
      try {
        const result = await tryAPIsSequentially(ADVICE_ENDPOINTS, 'advice', currentRequestId);
        if (DEBUG) console.log(`[Advice] Request #${currentRequestId} returned: "${result.text.substring(0, 50)}..."`);
        return result;
      } catch (err) {
        if (DEBUG) console.log(`[Advice] Request #${currentRequestId} failed:`, err);
        return getFallbackContent('advice');
      }
    })();
    
    // Store the request but don't reuse it for subsequent calls
    activeAdviceRequest = request;
    const result = await request;
    
    // Clear the active request after completion
    if (activeAdviceRequest === request) {
      activeAdviceRequest = null;
    }
    
    return result;
  }
  
  let activeMotivationRequest = null;
  async function fetchMotivation() {
    if (activeMotivationRequest) {
      if (DEBUG) console.log(`[Motivation] Reusing existing request (deduplicated)`);
      return activeMotivationRequest;
    }
    
    if (DEBUG) console.log(`[Motivation] Starting fresh motivation request`);
    const request = (async () => {
      try {
        const result = await tryAPIsSequentially(MOTIVATION_ENDPOINTS, 'motivation');
        if (DEBUG) console.log(`[Motivation] Success: "${result.text.substring(0, 50)}..."`);
        return result;
      } catch (err) {
        if (DEBUG) console.log(`[Motivation] Failed, using fallback`);
        return getFallbackContent('motivation');
      }
    })();
    activeMotivationRequest = request;
    const result = await request;
    activeMotivationRequest = null;
    return result;
  }
  
  async function fetchAndUpdateForMode(mode, overrideDaily = false) {
    if (isFetching) {
      if (DEBUG) console.log(`[Fetch] Already fetching, skipping duplicate request`);
      return;
    }
    
    isFetching = true;
    if (DEBUG) console.log(`[Fetch] Starting ${mode} fetch (overrideDaily: ${overrideDaily})`);

    // Show loading state
    outputTextEl.innerText = "Loading...";
    outputAuthorEl.innerText = "";
    
    try {
      let result;
      if (mode === 'advice') {
        result = await fetchAdvice();
      } else {
        result = await fetchMotivation();
      }

      if (!result || !result.text) throw new Error('invalid result');
      
      await displayQuote(result, mode, false, true);
      storeDailyDose(result, mode);
      isDailyLocked = false;
      if (DEBUG) console.log(`[Fetch] Successfully updated display with new ${mode}`);
    } catch (err) {
      if (DEBUG) console.log(`[Fetch] Error in fetchAndUpdateForMode:`, err);
      const fallback = getFallbackContent(mode);
      await displayQuote(fallback, mode, false, true);
      storeDailyDose(fallback, mode);
      isDailyLocked = false;
    } finally {
      isFetching = false;
      if (DEBUG) console.log(`[Fetch] ${mode} fetch completed`);
    }
  }

  // ---------- Daily Mode Initialization ----------
  async function initDailyMode() {
    const stored = getStoredDailyDose();
    if (stored && stored.text) {
      currentMode = stored.mode;
      isDailyLocked = true;
      await displayQuote({ text: stored.text, author: stored.author }, stored.mode, true, false);
      setActiveModeButton(stored.mode);
      contextTag.innerText = "TODAY'S DOSE";
      if (DEBUG) console.log(`[Init] Loaded stored daily dose for ${stored.mode}`);
    } else {
      if (DEBUG) console.log(`[Init] No stored dose, fetching fresh advice`);
      isFetching = true;
      outputTextEl.innerText = "Loading...";
      outputAuthorEl.innerText = "";
      try {
        const fresh = await fetchAdvice();
        await displayQuote(fresh, 'advice', true, true);
        storeDailyDose(fresh, 'advice');
        currentMode = 'advice';
        isDailyLocked = true;
      } catch (e) {
        const fallback = getFallbackContent('advice');
        await displayQuote(fallback, 'advice', true, true);
        storeDailyDose(fallback, 'advice');
        currentMode = 'advice';
        isDailyLocked = true;
      } finally {
        isFetching = false;
      }
    }
  }

  // ---------- Event Handlers ----------
  async function onAdvice() {
    if (isFetching) {
      if (DEBUG) console.log(`[onAdvice] Already fetching, ignoring click`);
      return;
    }
    if (DEBUG) console.log(`[onAdvice] User clicked Advice button`);
    currentMode = 'advice';
    await fetchAndUpdateForMode('advice', true);
  }

  async function onMotivation() {
    if (isFetching) return;
    if (DEBUG) console.log(`[onMotivation] User clicked Motivation button`);
    currentMode = 'motivation';
    await fetchAndUpdateForMode('motivation', true);
  }

  async function onRegenerate() {
    if (isFetching) {
      if (DEBUG) console.log(`[Regenerate] Already fetching, ignoring`);
      return;
    }
    if (DEBUG) console.log(`[Regenerate] User clicked Regenerate (current mode: ${currentMode})`);
    // CRITICAL FIX: Regenerate always triggers a fresh fetch without using any cached response
    await fetchAndUpdateForMode(currentMode, true);
  }

  function onCopy() {
    let copyText = currentQuoteData.text;
    if (currentQuoteData.author && currentQuoteData.author.trim() !== "" && currentQuoteData.author.toLowerCase() !== 'unknown') {
      copyText = `"${currentQuoteData.text}" — ${currentQuoteData.author}`;
    } else {
      copyText = `"${currentQuoteData.text}"`;
    }
    
    navigator.clipboard.writeText(copyText).then(() => {
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '✓ Copied';
      setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1500);
    }).catch(() => {});
  }

  function onShare() {
    let shareText = currentQuoteData.text;
    if (currentQuoteData.author && currentQuoteData.author.trim() !== "" && currentQuoteData.author.toLowerCase() !== 'unknown') {
      shareText = `"${currentQuoteData.text}" — ${currentQuoteData.author}`;
    } else {
      shareText = `"${currentQuoteData.text}"`;
    }
    const fullMessage = `DailyDose: ${shareText}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'DailyDose',
        text: fullMessage,
        url: window.location.href,
      }).catch(() => {});
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
      window.open(waUrl, '_blank');
    }
  }

  // Attach event listeners
  adviceBtn.addEventListener('click', onAdvice);
  motivationBtn.addEventListener('click', onMotivation);
  copyBtn.addEventListener('click', onCopy);
  shareBtn.addEventListener('click', onShare);
  regenerateBtn.addEventListener('click', onRegenerate);

  // Initialize
  initDailyMode();
})();