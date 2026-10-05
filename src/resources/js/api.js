/*
 * API layer for the SkynetA11y PDF Remediation service.
 *
 * Every request carries `Authorization: Bearer <token>` when a token is known;
 * the backend rejects /api/documents and everything below it with 401
 * "Authentication required" otherwise. /api/billing/plans is public.
 *
 * Configuration is read through `PdfConfig.get()` on every call rather than
 * captured at load time, so a host that injects `window.AIOPDF_CONFIG` after
 * this file is parsed still takes effect.
 */
(function (global) {
  'use strict';

  function config() {
    return global.PdfConfig.get();
  }

  function account() {
    return global.PdfAccount.resolveAccount();
  }

  /* ------------------------------------------------------------------ *
   * Identity
   *
   * Everything here comes from the account somebody entered in the details
   * dialog (see account.js). There is no derivation from the page's hostname
   * any more: if nobody has connected, these are empty and the module asks
   * before it talks to the service.
   * ------------------------------------------------------------------ */

  /** The site the remediation account is registered against. */
  function website() {
    var identity = account();

    return identity ? identity.domain : '';
  }

  /** The address the account is provisioned under. */
  function accountEmail() {
    var identity = account();

    return identity ? identity.email : '';
  }

  /**
   * The domain the Website Scan tab crawls, before the account's own list is
   * consulted. A configured `activeDomain` pins it; otherwise it is the domain
   * on the account.
   */
  function activeDomain() {
    return config().activeDomain || website();
  }

  /**
   * Autologin link behind the coverage modal's upgrade button.
   *
   * The token is `base64(domain|pf)` — the `|pf` marker goes INSIDE the
   * encoding, so it is `btoa` of the host and the suffix together. The dashboard
   * decodes the token and reads that suffix to land the visitor on the PDF plans
   * page rather than the general one.
   */
  function upgradeUrl() {
    var c = config();

    if (c.upgradeUrl) return c.upgradeUrl;

    var host = website();

    return host ? c.dashboardUrl + '/front/autologin/' + global.btoa(host + '|pf') : '';
  }

  /** Absolute URL for a backend endpoint, e.g. apiUrl('/documents'). */
  function apiUrl(path) {
    return config().apiBaseUrl + '/api' + (path.charAt(0) === '/' ? path : '/' + path);
  }

  /* ------------------------------------------------------------------ *
   * Session token
   * ------------------------------------------------------------------ */

  /**
   * Storage key for the session token, scoped to the account it belongs to.
   *
   * Scoping matters: the token is what lets the page skip signing in, so a token
   * cached under a shared key would silently keep an old account alive after the
   * configured domain changed. With the account folded into the key, a changed
   * account simply finds no token and signs in again.
   */
  function storageKey() {
    var c = config();
    var identity = account();
    var fingerprint = c.accountKey || (identity ? identity.domain + '|' + identity.email : '');

    if (!fingerprint) return c.tokenKey;

    return c.tokenKey + '_' + global.btoa(unescape(encodeURIComponent(fingerprint))).replace(/=+$/, '');
  }

  function token() {
    try {
      return localStorage.getItem(storageKey());
    } catch (e) {
      return null;
    }
  }

  function setToken(value) {
    try {
      if (value) localStorage.setItem(storageKey(), value);
      else localStorage.removeItem(storageKey());
    } catch (e) {
      /* storage unavailable (private mode) — requests simply go unauthenticated */
    }
  }

  /**
   * The remediation job this browser last started, if it was still running.
   *
   * Kept beside the session token, and scoped the same way, so a reload can pick
   * the job back up: without it the progress bar disappears on refresh while the
   * service carries on working, and the only sign left is a row stuck on
   * "Processing".
   */
  function activeJobId() {
    try {
      return localStorage.getItem(storageKey() + '_job');
    } catch (e) {
      return null;
    }
  }

  function setActiveJobId(id) {
    try {
      if (id) localStorage.setItem(storageKey() + '_job', id);
      else localStorage.removeItem(storageKey() + '_job');
    } catch (e) {
      /* storage unavailable — the job still runs, it just cannot be resumed */
    }
  }

  /** Authorization header for hand-rolled fetch calls (file downloads). */
  function authHeaders() {
    var t = token();

    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  /**
   * A token may also arrive as `?token=…`. It is stored and stripped from the
   * visible URL so it is not left sitting in the address bar or in a copied
   * link.
   */
  function adoptTokenFromQuery() {
    try {
      var params = new URLSearchParams(global.location.search);
      var t = params.get('token');

      if (!t) return;

      setToken(t);
      params.delete('token');

      var query = params.toString();

      global.history.replaceState(
        {},
        '',
        global.location.pathname + (query ? '?' + query : '') + global.location.hash
      );
    } catch (e) {
      /* malformed URL — nothing to adopt */
    }
  }

  /**
   * Clears tokens written under the bare `tokenKey`, which could belong to any
   * account, rather than trusting them.
   */
  function reconcileAccount() {
    var c = config();

    try {
      if (localStorage.getItem(c.tokenKey)) localStorage.removeItem(c.tokenKey);
      localStorage.removeItem(c.tokenKey + '_account');
    } catch (e) {
      /* storage unavailable — nothing to clean up */
    }
  }

  /* ------------------------------------------------------------------ *
   * Sign-in
   *
   * One call to the service's provisioning endpoint does both jobs: it registers
   * the account on first use and returns a session on every use thereafter. It
   * is idempotent — the same email comes back as the same account with
   * `isNewToApp: false` — so there is no separate registration step and repeat
   * calls cannot create duplicate accounts.
   * ------------------------------------------------------------------ */

  function ApiError(status, data) {
    var err = new Error(String((data && data.error) || 'Request failed'));

    err.name = 'ApiError';
    err.status = status;
    err.code = data && data.code;
    err.data = data || {};

    return err;
  }

  /**
   * POST {apiBaseUrl}/api/billing/provision-account — registers and signs in.
   *
   * `identity` is the name/email/domain somebody submitted; omit it and the one
   * already connected is used. Rejects on failure so the details dialog can show
   * the service's own reason (a rejected domain, a malformed address) instead of
   * a generic "could not sign in".
   */
  function provisionSession(identity) {
    var c = config();
    var who = identity || account();

    if (!who) return Promise.resolve(false);

    return fetch(apiUrl('/billing/provision-account'), {
      method: 'POST',
      headers: {
        'X-Api-Key': c.provisionApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: who.name,
        email: who.email,
        company_name: who.name,
        website: who.domain,
        plan_id: c.planId,
        country: c.country
      })
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {}; /* non-JSON response */
        })
        .then(function (data) {
          if (!res.ok || !data || !data.token) throw ApiError(res.status, data);

          setToken(data.token);

          return true;
        });
    });
  }

  /**
   * Asks a host-supplied server endpoint for a session instead.
   *
   * Unused in the shipped configuration — set `sessionUrl` in config.js to an
   * endpoint of your own that performs the provisioning call server-side, and
   * the API key never reaches the browser. See README.md.
   */
  function serverSession() {
    var c = config();
    var headers = { Accept: 'application/json' };

    if (c.csrfToken) headers['X-CSRF-TOKEN'] = c.csrfToken;

    return fetch(c.sessionUrl, {
      method: 'POST',
      headers: headers,
      credentials: 'same-origin'
    })
      .then(function (res) {
        if (!res.ok) return false;

        return res.json().then(function (data) {
          if (!data || !data.token) return false;

          setToken(data.token);

          return true;
        });
      })
      .catch(function () {
        return false;
      });
  }

  /**
   * Resolves true once a session token is in storage, false otherwise.
   *
   * Never rejects: this is the silent path — boot, and the one retry after a
   * 401 — where there is no dialog on screen to show a reason to. The details
   * dialog calls `provisionSession` directly so it can surface the service's
   * message.
   */
  function signIn() {
    if (config().sessionUrl) return serverSession();

    return provisionSession().catch(function () {
      return false;
    });
  }

  /**
   * Resolves to true when a usable session exists — reusing the stored token if
   * there is one, and provisioning otherwise. An expired stored token is caught
   * by the 401 retry in `request` rather than probed here, which keeps boot to a
   * single round trip.
   */
  function ensureSession() {
    reconcileAccount();

    if (token()) return Promise.resolve(true);

    return signIn();
  }

  /* ------------------------------------------------------------------ *
   * Request plumbing
   * ------------------------------------------------------------------ */

  function request(path, options, isRetry) {
    options = options || {};

    var headers = {};
    var key;

    if (options.headers) {
      for (key in options.headers) {
        if (Object.prototype.hasOwnProperty.call(options.headers, key)) {
          headers[key] = options.headers[key];
        }
      }
    }

    var t = token();

    if (t) headers.Authorization = 'Bearer ' + t;

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(apiUrl(path), {
      method: options.method || 'GET',
      body: options.body,
      headers: headers
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {}; /* non-JSON response */
        })
        .then(function (data) {
          if (res.ok) return data;

          // The session is a short-lived JWT. One silent re-issue keeps a
          // long-open page working instead of failing every later action.
          // `isRetry` bounds it to a single attempt per call.
          if (res.status === 401 && !isRetry) {
            setToken(null);

            return signIn().then(function (ok) {
              if (!ok) throw ApiError(res.status, data);

              return request(path, options, true);
            });
          }

          throw ApiError(res.status, data);
        });
    });
  }

  var raw = {
    get: function (path) {
      return request(path);
    },
    post: function (path, body) {
      return request(path, {
        method: 'POST',
        body: body instanceof FormData ? body : JSON.stringify(body || {})
      });
    },
    del: function (path) {
      return request(path, { method: 'DELETE' });
    }
  };

  /* ------------------------------------------------------------------ *
   * Endpoints
   * ------------------------------------------------------------------ */

  /** GET /api/auth/me — the signed-in user (plan, pages remaining, domains). */
  function fetchMe() {
    return raw.get('/auth/me').then(function (d) {
      return d.user;
    });
  }

  /** GET /api/billing/plans */
  function fetchPlans() {
    return raw.get('/billing/plans').then(function (d) {
      return d.plans || [];
    });
  }

  /**
   * GET /api/documents — the full unpaginated list.
   *
   * Used to work out remediation eligibility across the WHOLE queue rather than
   * just the visible table page.
   */
  function fetchDocuments() {
    return raw.get('/documents').then(function (d) {
      return d.documents || [];
    });
  }

  /**
   * GET /api/documents?type=…&page=…&perPage=… — server-side paginated, filtered
   * and searched fetch for a single tab.
   */
  function fetchDocumentsPage(params) {
    var qs = new URLSearchParams();

    qs.set('type', params.type);
    qs.set('page', String(params.page));
    qs.set('perPage', String(params.perPage));

    if (params.search) qs.set('search', params.search);
    if (params.status && params.status !== 'all') qs.set('status', params.status);
    if (params.domain) qs.set('domain', params.domain);
    if (params.source && params.source !== 'all') qs.set('source', params.source);

    return raw.get('/documents?' + qs.toString());
  }

  /** POST /api/documents/upload — multipart, field name `file`. */
  function uploadPdf(file) {
    var form = new FormData();

    form.append('file', file);

    return raw.post('/documents/upload', form).then(function (d) {
      return d.document;
    });
  }

  /** POST /api/documents/:id/scan — reads the PDF and fills in its page count. */
  function scanPdfUrl(id) {
    return raw.post('/documents/' + id + '/scan').then(function (d) {
      return d.document;
    });
  }

  /** POST /api/documents/crawl — sweeps a domain for linked PDFs. */
  function crawlDomain(domain) {
    return raw.post('/documents/crawl', { domain: domain });
  }

  /** DELETE /api/documents/:id */
  function removeDocument(id) {
    return raw.del('/documents/' + id).then(function () {
      return id;
    });
  }

  /** GET /api/documents/:id/suggestions */
  function fetchSuggestions(id) {
    return raw.get('/documents/' + id + '/suggestions');
  }

  /** POST /api/remediation/start */
  function startRemediation(documentIds, allowPartial) {
    return raw.post('/remediation/start', {
      documentIds: documentIds,
      allowPartial: Boolean(allowPartial)
    });
  }

  /** GET /api/remediation/jobs/:id — polled while a job is processing. */
  function pollJob(jobId) {
    return raw.get('/remediation/jobs/' + jobId);
  }

  /**
   * GET /api/documents/:id/download — fetched as a blob with the auth token
   * attached, then handed to the browser as a save.
   */
  function downloadRemediated(docId, fileName, isRetry) {
    return fetch(apiUrl('/documents/' + docId + '/download'), { headers: authHeaders() })
      .then(function (res) {
        // Same single silent re-issue as `request` — this path bypasses it.
        if (res.status === 401 && !isRetry) {
          setToken(null);

          return signIn().then(function (ok) {
            return ok ? downloadRemediated(docId, fileName, true) : false;
          });
        }

        if (!res.ok) return false;

        return res.blob().then(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');

          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);

          return true;
        });
      })
      .catch(function () {
        return false;
      });
  }

  /** Smallest plan that covers `pages` — falls back to the largest one. */
  function recommendPlan(plans, pages) {
    var paid = (plans || []).filter(function (p) {
      return p.price > 0;
    });

    if (!paid.length) return null;

    var sorted = paid.slice().sort(function (a, b) {
      return a.pages - b.pages;
    });

    for (var i = 0; i < sorted.length; i++) {
      if (sorted[i].pages >= pages) return sorted[i];
    }

    return sorted[sorted.length - 1];
  }

  global.PdfApi = {
    ApiError: ApiError,
    raw: raw,

    website: website,
    accountEmail: accountEmail,
    activeDomain: activeDomain,
    upgradeUrl: upgradeUrl,
    apiUrl: apiUrl,

    storageKey: storageKey,
    token: token,
    setToken: setToken,
    activeJobId: activeJobId,
    setActiveJobId: setActiveJobId,
    authHeaders: authHeaders,
    adoptTokenFromQuery: adoptTokenFromQuery,
    reconcileAccount: reconcileAccount,

    provisionSession: provisionSession,
    serverSession: serverSession,
    signIn: signIn,
    ensureSession: ensureSession,

    fetchMe: fetchMe,
    fetchPlans: fetchPlans,
    fetchDocuments: fetchDocuments,
    fetchDocumentsPage: fetchDocumentsPage,
    uploadPdf: uploadPdf,
    scanPdfUrl: scanPdfUrl,
    crawlDomain: crawlDomain,
    removeDocument: removeDocument,
    fetchSuggestions: fetchSuggestions,
    startRemediation: startRemediation,
    pollJob: pollJob,
    downloadRemediated: downloadRemediated,
    recommendPlan: recommendPlan
  };
})(window);
