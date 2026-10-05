/*
 * SkynetA11y PDF Remediation — workspace behaviour.
 *
 * Three screens (Upload, Website Scan, Remediated), the account dialog, the
 * suggestions / confirmation / plan-coverage modals, and the job poller. No site
 * header, sidebar or footer is drawn — the section is meant to be dropped into
 * the host page's content area.
 *
 * The workspace is never gated behind sign-in: it is on screen from the start,
 * and account details are asked for at the moment an action first has to reach
 * the service (see `requireAccount`).
 */
(function (global) {
  'use strict';

  var API = global.PdfApi;
  var ACCOUNT = global.PdfAccount;

  function config() {
    return global.PdfConfig.get();
  }

  /* =================================================================== *
   * State
   * =================================================================== */
  var state = {
    tab: 'upload',
    user: null,
    plans: [],

    /** The remediation account, or null until somebody connects one. */
    account: null,
    /**
     * What has been typed into the account dialog.
     *
     * Held here rather than read off the inputs, which are cleared when the
     * dialog closes: cancelling would otherwise throw away a half-filled form,
     * and the next upload would ask for the same details from scratch.
     */
    accountDraft: { name: '', email: '', domain: '' },
    /** Why the dialog is open, and what to run once it is answered. */
    accountPrompt: null,

    /** Full unpaginated document list — drives remediation eligibility. */
    documents: [],
    /** Ids ticked in the tables, across pages. */
    selected: new Set(),

    /** The remediation job currently being polled. */
    job: null,
    jobTimer: null,

    upload: { page: 1, perPage: 10, search: '', docs: [], total: 0 },
    scan: { page: 1, perPage: 10, search: '', status: 'all', docs: [], total: 0 },
    rem: { page: 1, perPage: 10, search: '', source: 'all', docs: [], total: 0 },

    /** Pending action for the confirmation modal. */
    confirm: null,
    /** What the plan-coverage modal is showing. */
    partial: null,
    loaders: 0
  };

  var SUBTITLES = {
    upload: 'Add files for AI-powered accessibility remediation.',
    scan: 'Scan this website for PDFs and check their accessibility issues.',
    remediated: 'View, download, and manage completed remediated PDFs.'
  };

  /* =================================================================== *
   * Small helpers
   * =================================================================== */
function $(id) {
  if (!id) {
    return null;
  }

  // Admin/settings view uses the "settings-" prefix for all IDs.
  // Keep already-prefixed IDs working as they are.
  if (id.indexOf('settings-') === 0) {
    return document.getElementById(id);
  }

  return document.getElementById('settings-' + id);
}
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function icon(name, size) {
    return global.Icons.get(name, size);
  }

  function show(el, visible) {
    if (el) el.hidden = !visible;
  }

  function plural(count, word) {
    return count + ' ' + word + (count === 1 ? '' : 's');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  /** Debounces search inputs so a keystroke does not fire a request each time. */
  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      var self = this;
      global.clearTimeout(timer);
      timer = global.setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }

  var toastTimer;
  function toast(message, kind) {
    var el = $('toast');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = message;
    show(el, true);
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      show(el, false);
    }, 4200);
  }

  /** Reference-counted so overlapping fetches do not hide each other's loader. */
  function loading(on) {
    state.loaders = Math.max(0, state.loaders + (on ? 1 : -1));
    show($('tableLoader'), state.loaders > 0);
  }

  function errorMessage(e) {
    return (e && e.message) || 'Something went wrong. Please try again.';
  }

  /**
   * Surfaces a failed sign-in rather than an opaque failure. A 401 only reaches
   * here after the API layer has already tried to re-issue the session once.
   */
  function handleRequestError(e, fallback) {
    if (e && e.status === 401) {
      toast('Could not authenticate with the remediation service.', 'error');
      return;
    }
    toast(errorMessage(e) || fallback, 'error');
  }

  /* =================================================================== *
   * The account
   * =================================================================== */

  /**
   * Runs `action` when there is an account, and otherwise asks for one first and
   * runs it afterwards.
   *
   * This is what replaces gating the whole page behind a sign-in screen: the
   * workspace is always visible, and the details are requested at the moment
   * they are actually needed — the first upload, or the first crawl. `prompt`
   * says which, so the dialog explains why it appeared.
   */
  function requireAccount(action, prompt) {
    if (state.account) return action(state.account);

    state.accountPrompt = { prompt: prompt, action: action };
    openAccountModal();

    return undefined;
  }

  function openAccountModal() {
    var modal = $('accountModal');

    modal.querySelector('[data-role="prompt"]').textContent =
      (state.accountPrompt && state.accountPrompt.prompt) ||
      'Remediation runs under an account for your website.';

    $('accountName').value = state.accountDraft.name || '';
    $('accountEmail').value = state.accountDraft.email || '';
    $('accountDomain').value = state.accountDraft.domain || '';

    setAccountErrors({});
    showAccountFailure(null);
    setAccountSubmitting(false);
    show(modal, true);
    $('accountName').focus();
  }

  /**
   * Closes the dialog, keeping whatever was typed.
   *
   * Cancelling costs nothing: the next upload or crawl opens it again with the
   * same values still in the fields.
   */
  function closeAccountModal() {
    state.accountPrompt = null;
    show($('accountModal'), false);
  }

  function readAccountDraft() {
    return {
      name: $('accountName').value,
      email: $('accountEmail').value,
      domain: $('accountDomain').value
    };
  }

function setAccountErrors(errors) {
  ['name', 'email', 'domain'].forEach(function (field) {
    var id =
      'account' +
      field.charAt(0).toUpperCase() +
      field.slice(1);

    var error = $(id + '-error');
    var hint = $(id + '-hint');
    var input = $(id);

    if (errors[field]) {
      if (error) {
        error.textContent = errors[field];
        show(error, true);
      }

      if (hint) {
        show(hint, false);
      }

      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute(
          'aria-describedby',
          'settings-' + id + '-error'
        );
      }
    } else {
      if (error) {
        show(error, false);
      }

      if (hint) {
        show(hint, true);
      }

      if (input) {
        input.removeAttribute('aria-invalid');
        input.setAttribute(
          'aria-describedby',
          'settings-' + id + '-hint'
        );
      }
    }
  });
}

  function showAccountFailure(message) {
    var callout = $('accountModal').querySelector('[data-role="failure"]');

    if (!message) {
      show(callout, false);
      return;
    }

    callout.querySelector('[data-role="failure-text"]').textContent = message;
    show(callout, true);
  }

/**
 * Enable / disable account form controls while saving.
 */
function setAccountSubmitting(on) {
  var modal = $('settings-accountModal');

  if (!modal) {
    return;
  }

  var submit = modal.querySelector('[data-role="submit"]');

  if (!submit) {
    return;
  }

  submit.disabled = on;

  submit.innerHTML = on
    ? icon('spinner', 17) + ' Setting up…'
    : icon('sparkles', 17) + ' Save and continue';

  var cancel = modal.querySelector('[data-role="cancel"]');
  var close = modal.querySelector('[data-role="close"]');

  if (cancel) {
    cancel.disabled = on;
  }

  if (close) {
    close.disabled = on;
  }

  [
    'settings-accountName',
    'settings-accountEmail',
    'settings-accountDomain'
  ].forEach(function (id) {
    var field = $(id);

    if (field) {
      field.disabled = on;
    }
  });
}

  /**
   * Registers the submitted details with the service and, once accepted, makes
   * them this page's account.
   *
   * The details are stored *before* the call, not after: the session token is
   * filed under a key derived from the account, so it has to be resolvable by
   * the time `provisionSession` stores one. A failure clears them again, so a
   * rejected attempt leaves nothing behind.
   */
  function connect(values) {
    var saved = ACCOUNT.writeAccount(values);

    if (!saved) {
      return Promise.reject(new Error('Enter a name, an email address and a domain.'));
    }

    return API.provisionSession(saved)
      .catch(function (e) {
        ACCOUNT.clearAccount();
        API.setToken(null);
        throw e;
      })
      .then(function () {
        state.account = saved;
        state.accountDraft = saved;
        renderAccountBar();

        /* Carry on with whatever they were doing when the dialog appeared. */
        var pending = state.accountPrompt && state.accountPrompt.action;

        closeAccountModal();

        return boot().then(function () {
          if (pending) pending(saved);
        });
      });
  }

  /**
   * Forgets the account and its session. The next action asks again — with the
   * previous details still in the dialog, since changing one field is the usual
   * reason for coming here.
   *
   * Not offered anywhere in the workspace: the account belongs to the site, not
   * to whoever is looking at the page, so switching it is a deliberate act by
   * host code (`PdfRemediation.disconnect()`) rather than a link in the header.
   */
  function disconnect() {
    API.setActiveJobId(null);
    API.setToken(null);
    state.accountDraft = ACCOUNT.resolveAccount() || state.accountDraft;
    ACCOUNT.clearAccount();
    state.account = null;
    state.user = null;
    state.documents = [];
    state.selected = new Set();
    global.clearInterval(state.jobTimer);
    state.job = null;
    renderAccountBar();
    renderPlanBar();
    renderJobProgress();
    refreshCurrentTable();
  }

  /** Names the account the workspace is working under. Read-only. */
  function renderAccountBar() {
    var bar = $('accountBar');

    if (!state.account) {
      show(bar, false);
      return;
    }

    bar.querySelector('[data-role="domain"]').textContent = state.account.domain;
    bar.querySelector('[data-role="email"]').textContent = state.account.email;
    show(bar, true);
  }

  /** Amber from here on: the plan is nearly gone. */
  var PLAN_WARN_AT = 80;

  /**
   * Which plan the account is on and how much of it is left, under the account
   * line.
   *
   * Everything comes from `GET /api/auth/me`, which returns `planName`,
   * `planPages` and `pagesRemaining` on the user — so there is nothing to join
   * against the plans list and no extra request to make. The same response comes
   * back with a started run, and the page reads it again when a job finishes,
   * which is what makes the count fall live rather than going stale until the
   * next reload.
   *
   * Hidden until the user is loaded, and the pages chip is dropped (keeping the
   * plan's name) if the service ever answers without a page allowance — a plan
   * with no ceiling has nothing to count down.
   */
function renderPlanBar() {
  var bar = $('planBar');
  var user = state.user;

 

  if (!state.account || !user || !user.planName) {
  
    show(bar, false);
    return;
  }


  var allowance = Number(user.planPages);
 

  var remaining = Math.max(0, Number(user.pagesRemaining) || 0);
 

  var metered = isFinite(allowance) && allowance > 0;


  var used = metered
    ? Math.min(allowance, Math.max(0, allowance - remaining))
    : 0;

 

  var percent = metered
    ? Math.min(100, Math.round((used / allowance) * 100))
    : 0;


  var tone = remaining <= 0
    ? 'error'
    : percent >= PLAN_WARN_AT
      ? 'pending'
      : 'completed';



  bar.querySelector('[data-role="plan"]').textContent = user.planName;

  var pages = bar.querySelector('[data-role="pages"]');



  pages.className = 'status-chip ' + tone;

  pages.textContent =
    remaining.toLocaleString() +
    ' pages remaining';



  show(pages, metered);

  var upgrade = bar.querySelector('[data-role="upgrade"]');
  var target = API.upgradeUrl();



  if (target) {
    upgrade.href = target;
  } else {
    upgrade.removeAttribute('href');
  }

  show(upgrade, Boolean(target));
  show(bar, true);


}
  /* =================================================================== *
   * Tabs
   * =================================================================== */
  function switchTab(tab) {
    state.tab = tab;
    state.selected = new Set();

    ['upload', 'scan', 'remediated'].forEach(function (name) {
      var btn = document.querySelector('[data-tab="' + name + '"]');
      btn.classList.toggle('aiopdf_btn-primary', name === tab);
      btn.classList.toggle('active', name === tab);
      show($('panel' + name.charAt(0).toUpperCase() + name.slice(1)), name === tab);
    });

    $('pageSubtitle').textContent = SUBTITLES[tab];

    // The panels here are persistent rather than remounted, so the tab switch
    // is what keeps eligibility current.
    reloadDocuments();

    if (tab === 'upload') loadUploadTable();
    else if (tab === 'scan') loadScanTable();
    else loadRemediatedTable();
  }

  /* =================================================================== *
   * Pagination
   * =================================================================== */
  function renderPagination(container, view, onChange) {
    var totalPages = Math.ceil(view.total / view.perPage) || 0;
    var start = view.total === 0 ? 0 : (view.page - 1) * view.perPage + 1;
    var end = Math.min(view.page * view.perPage, view.total);

    // A three-page window centred as closely as possible on the current page.
    var startPage = Math.max(1, view.page - 1);
    var endPage = Math.min(totalPages, startPage + 2);
    var pages = [];
    for (var i = startPage; i <= endPage; i++) pages.push(i);

    var first = view.page === 1;
    var last = view.page === totalPages || totalPages === 0;

    function item(label, target, disabled, active) {
      return (
        '<li class="page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '') + '">' +
        '<button class="page-link" data-page="' + target + '"' + (disabled ? ' disabled' : '') + '>' +
        label + '</button></li>'
      );
    }

    container.innerHTML =
      '<div class="record-count"><strong>Showing ' + start + ' - ' + end +
      ' of ' + view.total + ' item(s)</strong></div>' +
      '<ul class="pagination">' +
      item('&laquo;', 1, first) +
      item('&lsaquo;', view.page - 1, first) +
      pages
        .map(function (p) {
          return item(String(p), p, false, p === view.page);
        })
        .join('') +
      item('&rsaquo;', view.page + 1, last) +
      item('&raquo;', totalPages || 1, last) +
      '</ul>';

    container.querySelectorAll('.page-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = Number(btn.getAttribute('data-page'));
        if (!target || target < 1 || target > totalPages || target === view.page) return;
        onChange(target);
        global.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  /* =================================================================== *
   * Eligibility helpers
   *
   * Selection spans the WHOLE queue, not just the visible page — so these read
   * from `state.documents` (the full list) rather than the table's page.
   * =================================================================== */
  function uploadQueue() {
    return state.documents.filter(function (d) {
      return d.source !== 'web' && d.status === 'ready';
    });
  }

  function scanQueue() {
    var domain = activeDomain();
    return state.documents.filter(function (d) {
      return d.source === 'web' && d.domain === domain && d.status === 'ready';
    });
  }

  function readyDocs() {
    return state.tab === 'scan' ? scanQueue() : uploadQueue();
  }

  function selectedReady() {
    return readyDocs().filter(function (d) {
      return state.selected.has(d.id);
    });
  }

  /**
   * The domain the Website Scan tab crawls: the configured selection when the
   * account actually owns it, otherwise the account's first domain.
   *
   * Empty until there is an account, which is why the tab labels its button
   * from `scanDomain()` instead — the button is on screen before anybody has
   * connected, and clicking it is one of the things that asks them to.
   */
  function activeDomain() {
    var domains = (state.user && state.user.domains) || [];
    var wanted = API.activeDomain();
    if (wanted && domains.indexOf(wanted) !== -1) return wanted;
    return domains[0] || '';
  }

  /** What the Website Scan tab shows it will crawl, connected or not. */
  function scanDomain() {
    return activeDomain() || ACCOUNT.defaultDomain();
  }

  function refreshBulkFooter() {
    var sel = selectedReady();
    var pages = sel.reduce(function (sum, d) {
      return sum + (d.pages || 0);
    }, 0);
    var busy = Boolean(state.job && state.job.status === 'processing');
    var prefix = state.tab === 'scan' ? 'scan' : 'upload';

    $(prefix + 'SelCount').textContent = String(sel.length);
    $(prefix + 'SelPages').textContent = String(pages);
    $(prefix + 'StartSelected').disabled = sel.length === 0 || busy;
    if (prefix === 'upload') $('uploadRemoveSelected').disabled = sel.length === 0 || busy;

    // "Select all" reflects the eligible documents on the visible page.
    var view = state.tab === 'scan' ? state.scan : state.upload;
    var eligibleOnPage = view.docs.filter(function (d) {
      return d.status === 'ready';
    });
    var box = $(prefix + 'SelectAll');
    box.checked =
      eligibleOnPage.length > 0 &&
      eligibleOnPage.every(function (d) {
        return state.selected.has(d.id);
      });
  }

  /**
   * Keeps the full list in sync so eligibility survives a page change.
   *
   * A no-op until there is an account: with no session every request would only
   * 401, and the workspace is on screen from the start.
   */
  function reloadDocuments() {
    if (!state.account) {
      state.documents = [];
      refreshBulkFooter();
      return Promise.resolve();
    }

    return API.fetchDocuments()
      .then(function (docs) {
        state.documents = docs;
        refreshBulkFooter();
      })
      .catch(function () {
        /* the paginated tables still render — this list only gates selection */
      });
  }

  /* =================================================================== *
   * Upload tab
   * =================================================================== */
  function loadUploadTable() {
    var view = state.upload;

    if (!state.account) {
      view.docs = [];
      view.total = 0;
      renderUploadTable();
      return Promise.resolve();
    }

    loading(true);
    return API.fetchDocumentsPage({
      type: 'upload',
      page: view.page,
      perPage: view.perPage,
      search: view.search
    })
      .then(function (r) {
        view.docs = r.documents || [];
        view.total = r.total || 0;
        renderUploadTable();
      })
      .catch(function (e) {
        view.docs = [];
        view.total = 0;
        renderUploadTable();
        handleRequestError(e, 'Could not load documents.');
      })
      .finally(function () {
        loading(false);
      });
  }

  function renderUploadTable() {
    var view = state.upload;
    var busy = Boolean(state.job && state.job.status === 'processing');
    var hasSelection = selectedReady().length > 0;

    if (!view.docs.length) {
      show($('uploadTableWrap'), false);
      var empty = $('uploadEmpty');
      empty.textContent = view.search
        ? 'No documents match your search.'
        : 'No documents in the queue — add a PDF above to get started.';
      show(empty, true);
      refreshBulkFooter();
      return;
    }

    show($('uploadEmpty'), false);
    show($('uploadTableWrap'), true);

    $('uploadTbody').innerHTML = view.docs
      .map(function (doc) {
        var scanning = doc.status === 'pending_scan' || doc.status === 'scanning';
        var pagesCell = scanning
          ? '<span class="status-chip scanning">Scanning…</span>'
          : doc.status === 'processing'
            ? '<span class="status-chip processing">Processing</span>'
            : String(doc.pages == null ? '—' : doc.pages);

        return (
          '<tr>' +
          '<td><input type="checkbox" class="aiocheckbox" data-select="' + esc(doc.id) + '"' +
          (state.selected.has(doc.id) ? ' checked' : '') +
          (doc.status !== 'ready' ? ' disabled' : '') +
          ' aria-label="Select ' + esc(doc.name) + '" /></td>' +

          '<td><div class="doc-cell">' +
          '<span class="mini-icon' + (doc.source === 'url' ? ' link' : '') + '">' +
          (doc.source === 'url' ? icon('link', 16) : 'PDF') + '</span>' +
          '<div style="min-width:0">' + esc(doc.name) +
          (doc.sourceUrl ? '<span class="doc-sub">' + esc(doc.sourceUrl) + '</span>' : '') +
          '</div></div></td>' +

          '<td style="text-align:center"><span class="src-chip ' + esc(doc.source) + '">' +
          (doc.source === 'url' ? 'URL' : 'File') + '</span></td>' +

          '<td style="text-align:center">' + pagesCell + '</td>' +

          '<td style="text-align:center"><div class="row-actions">' +
          (doc.status === 'processing'
            ? ''
            : '<button type="button" class="link-danger" data-remove="' + esc(doc.id) + '"' +
              (hasSelection || busy ? ' disabled' : '') + '>' +
              icon('x', 14) + ' Remove</button>') +
          '</div></td>' +
          '</tr>'
        );
      })
      .join('');

    renderPagination($('uploadPagination'), view, function (page) {
      view.page = page;
      loadUploadTable();
    });

    refreshBulkFooter();
  }

  /** Validates the dropped/chosen files, then asks for an account if needed. */
  function handleFiles(files) {
    if (!files || !files.length) return;

    var accepted = [];
    Array.prototype.forEach.call(files, function (file) {
      if (!/\.pdf$/i.test(file.name)) {
        toast('PDF format only — please choose a .pdf file.', 'error');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast('File is too large. Up to 50 MB is allowed.', 'error');
        return;
      }
      accepted.push(file);
    });
    if (!accepted.length) return;

    requireAccount(
      function () {
        sendFiles(accepted);
      },
      'Before ' + plural(accepted.length, 'file') +
        ' can be remediated, we need to know who this is for.'
    );
  }

  function sendFiles(accepted) {
    $('dropzoneLabel').textContent = 'Uploading…';
    loading(true);

    Promise.all(
      accepted.map(function (file) {
        return API.uploadPdf(file).catch(function (e) {
          handleRequestError(e, 'Upload failed');
          return null;
        });
      })
    )
      .then(function (docs) {
        var ok = docs.filter(Boolean).length;
        if (ok) toast(plural(ok, 'file') + ' uploaded.', 'success');
      })
      .finally(function () {
        $('dropzoneLabel').textContent = 'Drag and Drop file here';
        loading(false);
        reloadDocuments();
        loadUploadTable();
      });
  }

  /* =================================================================== *
   * Website Scan tab
   * =================================================================== */
  function statusChip(doc) {
    switch (doc.status) {
      case 'scanning':
        return '<span class="status-chip scanning">' + icon('spinner', 13) + ' Scanning</span>';
      case 'pending_scan':
        return (
          '<button class="status-chip pending" style="border:none;cursor:pointer" ' +
          'title="Click to scan now" data-scan="' + esc(doc.id) + '">' +
          icon('warning', 13) + ' Pending scan</button>'
        );
      case 'ready':
        // Scanned and awaiting remediation — labelled "Pending" so it reads
        // consistently with the other pending states.
        return '<span class="status-chip ready">' + icon('info', 12) + ' Pending</span>';
      case 'processing':
        return '<span class="status-chip processing">' + icon('spinner', 13) + ' Remediating</span>';
      case 'remediated':
        return '<span class="status-chip remediated">' + icon('check', 12) + ' Remediated</span>';
      default:
        return '<span class="status-chip error">Error</span>';
    }
  }

  function loadScanTable() {
    var view = state.scan;
    var domain = activeDomain();

    if (!state.account || !domain) {
      view.docs = [];
      view.total = 0;
      renderScanTable();
      return Promise.resolve();
    }

    loading(true);
    return API.fetchDocumentsPage({
      type: 'scan',
      page: view.page,
      perPage: view.perPage,
      search: view.search,
      status: view.status,
      domain: domain
    })
      .then(function (r) {
        view.docs = r.documents || [];
        view.total = r.total || 0;
        renderScanTable();
      })
      .catch(function (e) {
        view.docs = [];
        view.total = 0;
        renderScanTable();
        handleRequestError(e, 'Could not load scanned documents.');
      })
      .finally(function () {
        loading(false);
      });
  }
function renderScanTable() {
  var view = state.scan;
  var domain = scanDomain();

  var crawlBtn = $('settings-crawlBtn');

  if (crawlBtn) {
    show(crawlBtn, Boolean(domain));

    if (domain && !crawlBtn.dataset.busy) {
      crawlBtn.textContent = 'Find PDFs on ' + domain;
    }
  }

  if (!view.docs.length) {
    show($('settings-scanTableWrap'), false);

    var empty = $('settings-scanEmpty');

    if (empty) {
      empty.textContent = !domain
        ? 'Add a website domain to your account to start scanning it for PDFs.'
        : view.search || view.status !== 'all'
          ? 'No documents match your search/filter.'
          : 'No scanned documents yet — click "Find PDFs on ' +
            domain +
            '" above.';

      show(empty, true);
    }

    refreshBulkFooter();
    return;
  }

  show($('settings-scanEmpty'), false);
  show($('settings-scanTableWrap'), true);

  var tbody = $('settings-scanTbody');

  if (!tbody) {
    refreshBulkFooter();
    return;
  }

  tbody.innerHTML = view.docs
    .map(function (doc) {
      return (
        '<tr>' +
        '<td><input type="checkbox" class="aiocheckbox" data-select="' +
        esc(doc.id) +
        '"' +
        (state.selected.has(doc.id) ? ' checked' : '') +
        (doc.status !== 'ready' ? ' disabled' : '') +
        ' aria-label="Select ' +
        esc(doc.name) +
        '" /></td>' +

        '<td><div class="doc-cell"><span class="mini-icon">PDF</span>' +
        '<div style="min-width:0">' +
        esc(doc.name) +
        '<span class="doc-sub">Source: ' +
        (doc.sourceUrl
          ? '<a href="' +
            esc(doc.sourceUrl) +
            '" target="_blank" rel="noreferrer">' +
            esc(doc.sourceUrl) +
            '</a>'
          : 'Uploaded file') +
        '</span></div></div></td>' +

        '<td style="text-align:center">' +
        (doc.pages || '—') +
        '</td>' +

        '<td style="text-align:center">' +
        statusChip(doc) +
        '</td>' +

        '</tr>'
      );
    })
    .join('');

  var pagination = $('settings-scanPagination');

  if (pagination) {
    renderPagination(
      pagination,
      view,
      function (page) {
        view.page = page;
        loadScanTable();
      }
    );
  }

  refreshBulkFooter();
}

  /** The crawl button: asks for account details first when there are none. */
  function startCrawl() {
    var label = scanDomain();

    requireAccount(
      function (acct) {
        runCrawl(activeDomain() || acct.domain);
      },
      'To scan ' + (label || 'your website') +
        ' for PDFs, we need to know which account the results belong to.'
    );
  }

 function runCrawl(domain) {
  var btn = $('settings-crawlBtn');

  if (!btn) {
    return;
  }

  if (!domain || btn.dataset.busy) {
    return;
  }

    btn.dataset.busy = '1';
    btn.disabled = true;
    btn.innerHTML = icon('spinner', 15) + ' Crawling ' + esc(domain) + '…';

    API.crawlDomain(domain)
      .then(function (res) {
        var coverage =
          res.pagesCrawled + ' page' + (res.pagesCrawled === 1 ? '' : 's') + ' crawled' +
          (res.sitemapUrlsFound > 0 ? ', ' + res.sitemapUrlsFound + ' from sitemap' : '');

        // Large sites are swept across several runs — each picks up where the
        // last left off, so say so rather than implying full coverage.
        var truncated = res.truncated
          ? res.sitemapUrlsFound > 0
            ? ' — this is a large site (' + res.sitemapUrlsFound +
              ' pages in its sitemap), so not every page could be checked in one pass; run it again to sweep the next part of the site.'
            : ' — this is a large site, so not every page could be checked in one pass; run it again to keep discovering more.'
          : '';

        if (res.found === 0) {
          toast('No PDF links found on ' + domain + ' (' + coverage + ').' + truncated);
        } else if (res.added === 0) {
          toast('Found ' + res.found + ' PDF' + (res.found === 1 ? '' : 's') + ' on ' + domain +
            ' — all already in your list (' + coverage + ').' + truncated);
        } else {
          toast('Found ' + res.found + ' PDF' + (res.found === 1 ? '' : 's') + ' on ' + domain +
            ' — added ' + res.added + ' new (' + coverage + '). Scanning…' + truncated, 'success');
          // Kick off the scan for each newly discovered document.
          Promise.all(
            (res.documents || []).map(function (d) {
              return API.scanPdfUrl(d.id).catch(function () {
                return null;
              });
            })
          ).then(function () {
            reloadDocuments();
            loadScanTable();
          });
        }
      })
      .catch(function (e) {
        handleRequestError(e, 'Could not crawl the website.');
      })
      .finally(function () {
        delete btn.dataset.busy;
        btn.disabled = Boolean(state.job && state.job.status === 'processing');
        btn.textContent = 'Find PDFs on ' + domain;
        reloadDocuments();
        loadScanTable();
      });
  }

  /* =================================================================== *
   * Remediated tab
   * =================================================================== */
  function loadRemediatedTable() {
    var view = state.rem;

    if (!state.account) {
      view.docs = [];
      view.total = 0;
      renderRemediatedTable();
      return Promise.resolve();
    }

    loading(true);
    return API.fetchDocumentsPage({
      type: 'remediated',
      page: view.page,
      perPage: view.perPage,
      search: view.search,
      source: view.source
    })
      .then(function (r) {
        view.docs = r.documents || [];
        view.total = r.total || 0;
        renderRemediatedTable();
      })
      .catch(function (e) {
        view.docs = [];
        view.total = 0;
        renderRemediatedTable();
        handleRequestError(e, 'Could not load remediated PDFs.');
      })
      .finally(function () {
        loading(false);
      });
  }

  function renderRemediatedTable() {
    var view = state.rem;

    if (!view.docs.length) {
      show($('remTableWrap'), false);
      var empty = $('remEmpty');
      empty.textContent =
        view.search || view.source !== 'all'
          ? 'No remediated PDFs match your search/filter.'
          : 'No remediated PDFs yet — run AI remediation from the Upload or Website Scan tab.';
      show(empty, true);
      return;
    }

    show($('remEmpty'), false);
    show($('remTableWrap'), true);

    $('remTbody').innerHTML = view.docs
      .map(function (doc) {
        var label =
          doc.source === 'web' ? 'Website Scan' : doc.source === 'url' ? 'Scan PDF URL' : 'Upload PDF';
        var name = doc.remediatedName || doc.name;

        return (
          '<tr>' +
          '<td><div class="doc-cell"><span class="mini-icon purple">PDF</span>' + esc(name) + '</div></td>' +
          '<td class="text-center"><span class="src-chip ' + esc(doc.source) + '">' + label + '</span></td>' +
          '<td class="text-center">' + formatDate(doc.remediatedAt) + '</td>' +
          '<td class="text-center">' + (doc.remediatedPages != null ? doc.remediatedPages : doc.pages) + '</td>' +
          '<td class="actions-column" style="text-align:right"><div class="table-actions">' +
          '<button class="btn btn-soft btn-sm" style="white-space:nowrap; display: none;" data-suggest="' + esc(doc.id) + '">' +
          icon('sparkles', 16) + ' AI Suggestions</button>' +
          '<button class="btn btn-outline btn-sm" data-download="' + esc(doc.id) +
          '" data-name="' + esc(name) + '">' + icon('download', 16) + ' Download</button>' +
          '</div></td>' +
          '</tr>'
        );
      })
      .join('');

    renderPagination($('remPagination'), view, function (page) {
      view.page = page;
      loadRemediatedTable();
    });
  }

  /* =================================================================== *
   * Remediation + job polling
   * =================================================================== */
  function startRemediation(allowPartial) {
    var docs = selectedReady();
    if (!docs.length) {
      toast('Select at least one scanned document that is ready to remediate.', 'error');
      return;
    }

    loading(true);
    API.startRemediation(
      docs.map(function (d) {
        return d.id;
      }),
      allowPartial
    )
      .then(function (res) {
        state.selected = new Set();
        state.user = res.user || state.user;
        renderPlanBar();
        setJob(res.job);
        refreshCurrentTable();
      })
      .catch(function (e) {
        if (e && (e.code === 'PAGE_LIMIT' || e.code === 'PARTIAL_REQUIRED')) {
          openCoverageModal(e);
        } else {
          handleRequestError(e, 'Could not start remediation.');
        }
      })
      .finally(function () {
        loading(false);
      });
  }

  function setJob(job) {
    state.job = job;

    // Remembered so a page reload can pick the run back up — the service keeps
    // working whether or not this tab is open.
    API.setActiveJobId(job && job.status === 'processing' ? job.id : null);

    renderJobProgress();
    refreshBulkFooter();
    refreshCurrentTable();

    global.clearInterval(state.jobTimer);
    if (!job || job.status !== 'processing') return;

    pollUntilDone(job.id);
  }

  /**
   * Polls the active job once a second. Only the progress bar repaints on each
   * tick — the rows do not change until the job completes.
   */
  function pollUntilDone(jobId) {
    global.clearInterval(state.jobTimer);

    state.jobTimer = global.setInterval(function () {
      API.pollJob(jobId)
        .then(function (data) {
          state.job = data.job;
          state.user = data.user || state.user;
          renderJobProgress();
          renderPlanBar();

          if (data.job && data.job.status === 'completed') {
            global.clearInterval(state.jobTimer);
            API.setActiveJobId(null);
            toast('Remediation complete! Files are ready in the Remediated tab.', 'success');

            /* The run has just spent pages, so the plan meter is now wrong. The
               poll may carry a fresh `user`, but it is not guaranteed to — one
               read settles it either way. */
            API.fetchMe()
              .then(function (me) {
                state.user = me || state.user;
                renderPlanBar();
              })
              .catch(function () {
                /* the count stays as it was until the next load */
              });

            reloadDocuments();
            switchTab('remediated');
            global.setTimeout(function () {
              state.job = null;
              renderJobProgress();
              refreshBulkFooter();
              refreshCurrentTable();
            }, 1200);
          }
        })
        .catch(function () {
          global.clearInterval(state.jobTimer);
          API.setActiveJobId(null);
          state.job = null;
          renderJobProgress();
          refreshBulkFooter();
          refreshCurrentTable();
        });
    }, 1000);
  }

  /**
   * Picks a running job back up after a reload.
   *
   * Without this the progress bar disappears on refresh even though the service
   * is still working — the rows just sit on "Processing" with nothing counting
   * down. The id is remembered alongside the session token; one poll says
   * whether it is still going.
   */
  function resumeJob() {
    var id = API.activeJobId();

    if (!id) return Promise.resolve();

    return API.pollJob(id)
      .then(function (data) {
        if (data.job && data.job.status === 'processing') {
          state.job = data.job;
          state.user = data.user || state.user;
          renderJobProgress();
          renderPlanBar();
          pollUntilDone(id);
          return;
        }

        /* Finished, or gone, while the page was closed. */
        API.setActiveJobId(null);
      })
      .catch(function () {
        API.setActiveJobId(null);
      });
  }

  function renderJobProgress() {
    var active = Boolean(state.job && state.job.status === 'processing');
    var width = Math.max(state.job ? state.job.progress || 0 : 0, 4) + '%';

    ['uploadProgress', 'scanProgress'].forEach(function (id) {
      var el = $(id);
      show(el, active);
      el.querySelector('[data-role="fill"]').style.width = width;
    });
  }

  function refreshCurrentTable() {
    if (state.tab === 'upload') loadUploadTable();
    else if (state.tab === 'scan') loadScanTable();
    else loadRemediatedTable();
  }

  /* =================================================================== *
   * Confirmation modal
   * =================================================================== */
  function openConfirm(options) {
    var modal = $('confirmModal');
    modal.querySelector('h2').textContent = options.title;
    modal.querySelector('[data-role="message"]').innerHTML =
      esc(options.message) + (options.itemName ? ' <strong>' + esc(options.itemName) + '</strong>' : '');
    modal.querySelector('[data-role="confirm"]').textContent = options.confirmText || 'Remove';
    state.confirm = options.onConfirm;
    show(modal, true);
  }

  function closeConfirm() {
    state.confirm = null;
    show($('confirmModal'), false);
  }

  function removeDocuments(ids) {
    loading(true);
    Promise.all(
      ids.map(function (id) {
        return API.removeDocument(id).catch(function (e) {
          handleRequestError(e, 'Failed to remove document');
          return null;
        });
      })
    ).finally(function () {
      ids.forEach(function (id) {
        state.selected.delete(id);
      });
      loading(false);
      reloadDocuments();
      refreshCurrentTable();
    });
  }

  /* =================================================================== *
   * AI Suggestions modal
   * =================================================================== */
  function openSuggestions(docId) {
    var modal = $('suggestionsModal');
    var sub = modal.querySelector('[data-role="sub"]');
    var body = modal.querySelector('[data-role="body"]');

    sub.textContent = '';
    body.innerHTML =
      '<div class="empty-state">' + icon('spinner', 18) + ' Analysing document…</div>';
    show(modal, true);

    API.fetchSuggestions(docId)
      .then(function (data) {
        var items = (data.items || []).slice().sort(function (a, b) {
          // Failed checks first, then passed.
          return a.status === b.status ? 0 : a.status === 'failed' ? -1 : 1;
        });

        sub.textContent =
          data.documentName + ' · ' + data.pages + ' page' + (data.pages === 1 ? '' : 's') + ' · ' +
          items.length + ' check' + (items.length === 1 ? '' : 's') + ' on the ' +
          (data.analyzed === 'remediated' ? 'remediated' : 'original') + ' file' +
          (data.deepScan ? ' (deep tag scan)' : '');

        var summary =
          '<div class="sug-summary">' +
          '<span class="status-chip completed">' + icon('check', 12) + ' ' + data.passed + ' passed</span>' +
          (data.failed > 0
            ? '<span class="status-chip pending">' + icon('warning', 13) + ' ' + data.failed + ' to fix</span>'
            : '<span class="status-chip completed">All checks passed</span>') +
          '</div>';

        var list =
          '<div class="sug-list">' +
          items
            .map(function (item, idx) {
              return (
                '<div class="sug-item ' + esc(item.status) + '" data-sug="' + idx + '">' +
                '<button class="sug-row" data-toggle="' + idx + '" aria-expanded="false">' +
                '<span class="sug-dot ' + esc(item.status) + '">' +
                (item.status === 'passed' ? icon('check', 12) : icon('warning', 13)) + '</span>' +
                '<span class="sug-title">' + esc(item.title) + '</span>' +
                '<span class="sug-detail">' + esc(item.detail) + '</span>' +
                (item.willAutoFix
                  ? '<span class="src-chip file sug-fixchip">Fixed by AI Remediation</span>'
                  : '') +
                '<span class="sug-caret">&#9656;</span>' +
                '</button>' +
                '<div class="sug-body" hidden>' +
                '<p><b>What this means</b><br />' + esc(item.plain) + '</p>' +
                '<p><b>Why it matters</b><br />' + esc(item.why) + '</p>' +
                '<p><b>How it ' + (item.status === 'passed' ? 'was' : 'gets') + ' fixed</b><br />' +
                esc(item.fix) + '</p>' +
                '<div class="sug-example">' +
                '<div class="sug-example-col before"><div class="sug-example-label">Before</div>' +
                '<pre>' + esc(item.example && item.example.before) + '</pre></div>' +
                '<div class="sug-example-col after"><div class="sug-example-label">After</div>' +
                '<pre>' + esc(item.example && item.example.after) + '</pre></div>' +
                '</div></div></div>'
              );
            })
            .join('') +
          '</div>';

        var footnote =
          data.analyzed === 'original' && data.failed > 0
            ? '<p class="sug-footnote">These issues are repaired automatically when you run ' +
              '<b>Add Selected for Remediation</b> on this document.</p>'
            : '';

        body.innerHTML = summary + list + footnote;

        body.querySelectorAll('[data-toggle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var panel = btn.nextElementSibling;
            var open = panel.hidden;
            panel.hidden = !open;
            btn.setAttribute('aria-expanded', String(open));
            btn.querySelector('.sug-caret').innerHTML = open ? '&#9662;' : '&#9656;';
          });
        });
      })
      .catch(function (e) {
        body.innerHTML =
          '<div class="form-error">' + esc(errorMessage(e) || 'Could not analyse this document.') + '</div>';
      });
  }

  /* =================================================================== *
   * Plan coverage modal
   *
   * Opens for whichever way the service refused a run.
   *
   * `PARTIAL_REQUIRED` — the plan covers some of the selection, so the modal
   * offers both upgrading and continuing with the covered pages.
   * `PAGE_LIMIT` — the plan is exhausted (`pagesRemaining: 0`), so there is
   * nothing to continue with and only the upgrade path is offered.
   *
   * Both carry `totalPages` and `pagesRemaining`, and their `error` string is
   * the sentence to show, so the service stays in charge of the wording.
   * =================================================================== */
  function openCoverageModal(error) {
    var data = (error && error.data) || {};
    var covered = data.pagesRemaining || 0;
    var total = data.totalPages || 0;
    var message = (error && error.message) || '';

    var modal = $('partialModal');
    var isFree = state.user && state.user.planId === 'free';

    /* Nothing is covered, so there is nothing to continue with. Keyed off the
       number rather than the code, so a PAGE_LIMIT that ever arrives with pages
       left still offers the choice. */
    var canContinue = covered > 0;

    state.partial = { covered: covered, total: total, canContinue: canContinue };

    modal.querySelector('[data-role="icon"]').innerHTML = icon(canContinue ? 'info' : 'warning', 24);

    modal.querySelector('[data-role="title"]').textContent = canContinue
      ? isFree
        ? 'Free trial covers the first ' + covered + ' pages'
        : 'Your current plan covers ' + covered + ' of ' + total + ' pages'
      : message || "You've used all pages included in your current plan.";

    modal.querySelector('[data-role="body"]').textContent = canContinue
      ? 'Your PDF' + (total === covered ? '' : 's') + ' contain ' + total +
        ' pages. Upgrade to process all pages, or continue with the ' + covered +
        ' pages included in your current plan.'
      : 'The documents you selected contain ' + total.toLocaleString() + ' pages, and your ' +
        (isFree ? 'free trial' : 'plan') + ' has no pages left. Upgrade to carry on remediating.';

    var accept = modal.querySelector('[data-role="accept"]');
    accept.checked = false;

    modal.querySelector('[data-role="accept-label"]').textContent =
      'Continue with my ' + (isFree ? 'free plan' : 'current plan') + ' (' + covered + ' pages)';

    // Two buttons either way — Cancel replaces the continue action when there is
    // nothing to continue with — so the row stays balanced.
    show(modal.querySelector('[data-role="accept-row"]'), canContinue);
    show(modal.querySelector('[data-role="continue"]'), canContinue);
    show(modal.querySelector('[data-role="cancel"]'), !canContinue);
    modal.querySelector('[data-role="continue"]').disabled = true;
    modal.querySelector('[data-role="upgrade-label"]').textContent = canContinue
      ? 'Recommended Plan'
      : 'Upgrade Plan';

    var pill = modal.querySelector('[data-role="recommended"]');
    var plan = API.recommendPlan(state.plans, total);
    if (plan) {
      pill.querySelector('[data-role="recommended-text"]').innerHTML =
        'Recommended: <b>' + esc(plan.name) + '</b>' +
        '<span style="color:var(--text-muted)"> — ' + plan.pages.toLocaleString() +
        ' pages · $' + plan.price.toLocaleString() + '</span>';
    }
    show(pill, Boolean(plan));

    show(modal, true);
  }

  function closePartial() {
    state.partial = null;
    show($('partialModal'), false);
  }

  /* =================================================================== *
   * Wiring
   * =================================================================== */
  function bindTabs() {
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });
  }

function bindAccount() {
  var modal = $('settings-accountModal');

  // Account modal is not available on this page.
  // Do not try to bind account events.
  if (!modal) {
    return;
  }

  modal.addEventListener('click', function (e) {
    var submitButton = modal.querySelector('[data-role="submit"]');
    var busy = submitButton ? submitButton.disabled : false;

    if (busy) {
      return;
    }

    // Close when clicking outside the modal,
    // or clicking Close / Cancel.
    if (
      e.target === modal ||
      (e.target.closest && e.target.closest('[data-role="close"]')) ||
      (e.target.closest && e.target.closest('[data-role="cancel"]'))
    ) {
      closeAccountModal();
      return;
    }

    // Handle Save and continue as a normal button.
    if (
      submitButton &&
      (e.target === submitButton ||
       (e.target.closest && e.target.closest('[data-role="submit"]')))
    ) {
      e.preventDefault();
      submitAccount();
    }
  });

  // Keep the draft current on every keystroke.
  [
    'settings-accountName',
    'settings-accountEmail',
    'settings-accountDomain'
  ].forEach(function (id) {
    var field = $(id);

    if (!field) {
      return;
    }

    field.addEventListener('input', function () {
      state.accountDraft = readAccountDraft();
      showAccountFailure(null);
    });
  });
}


/**
 * Handle account save without normal form submission.
 */
function submitAccount() {
  var values = readAccountDraft();

  state.accountDraft = values;

  var errors = ACCOUNT.validateAccount(values);

  setAccountErrors(errors);
  showAccountFailure(null);

  if (Object.keys(errors).length) {
    return;
  }

  setAccountSubmitting(true);

  connect(values)
    .catch(function (err) {
      showAccountFailure(
        errorMessage(err) ||
        'Could not set this up. Please try again.'
      );
    })
    .finally(function () {
      setAccountSubmitting(false);
    });
}



  function bindUploadTab() {
    var dropzone = $('dropzone');
    var fileInput = $('fileInput');

    dropzone.addEventListener('click', function () {
      fileInput.click();
    });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('drag');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('drag');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('drag');
      handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', function () {
      handleFiles(fileInput.files);
      fileInput.value = '';
    });

    $('uploadSearch').addEventListener(
      'input',
      debounce(function (e) {
        state.upload.search = e.target.value.trim();
        state.upload.page = 1; // a new search must not strand us on an empty page
        loadUploadTable();
      }, 350)
    );

    $('uploadPerPage').addEventListener('change', function (e) {
      state.upload.perPage = Number(e.target.value);
      state.upload.page = 1;
      loadUploadTable();
    });

    $('uploadSelectAll').addEventListener('change', function (e) {
      state.upload.docs
        .filter(function (d) {
          return d.status === 'ready';
        })
        .forEach(function (d) {
          if (e.target.checked) state.selected.add(d.id);
          else state.selected.delete(d.id);
        });
      renderUploadTable();
    });

    $('uploadTbody').addEventListener('change', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-select');
      if (!id) return;
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      renderUploadTable();
    });

    $('uploadTbody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove]');
      if (!btn || btn.disabled) return;
      var id = btn.getAttribute('data-remove');
      var doc = state.upload.docs.filter(function (d) {
        return d.id === id;
      })[0];
      openConfirm({
        title: 'Remove Document',
        message: 'Are you sure you want to remove',
        itemName: (doc ? doc.name : 'this document') + '?',
        onConfirm: function () {
          removeDocuments([id]);
        }
      });
    });

    $('uploadRemoveSelected').addEventListener('click', function () {
      var ids = selectedReady().map(function (d) {
        return d.id;
      });
      if (!ids.length) return;
      openConfirm({
        title: 'Remove Document',
        message: 'Are you sure you want to remove the selected document?',
        onConfirm: function () {
          removeDocuments(ids);
        }
      });
    });

    $('uploadStartSelected').addEventListener('click', function () {
      startRemediation(false);
    });
  }

  function bindScanTab() {
    $('crawlBtn').addEventListener('click', startCrawl);

    $('scanSearch').addEventListener(
      'input',
      debounce(function (e) {
        state.scan.search = e.target.value.trim();
        state.scan.page = 1;
        loadScanTable();
      }, 350)
    );

    $('scanStatus').addEventListener('change', function (e) {
      state.scan.status = e.target.value;
      state.scan.page = 1;
      loadScanTable();
    });

    $('scanPerPage').addEventListener('change', function (e) {
      state.scan.perPage = Number(e.target.value);
      state.scan.page = 1;
      loadScanTable();
    });

    $('scanSelectAll').addEventListener('change', function (e) {
      state.scan.docs
        .filter(function (d) {
          return d.status === 'ready';
        })
        .forEach(function (d) {
          if (e.target.checked) state.selected.add(d.id);
          else state.selected.delete(d.id);
        });
      renderScanTable();
    });

    $('scanTbody').addEventListener('change', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-select');
      if (!id) return;
      if (e.target.checked) state.selected.add(id);
      else state.selected.delete(id);
      renderScanTable();
    });

    $('scanTbody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-scan]');
      if (!btn) return;
      loading(true);
      API.scanPdfUrl(btn.getAttribute('data-scan'))
        .catch(function (e2) {
          handleRequestError(e2, 'Scan failed');
        })
        .finally(function () {
          loading(false);
          reloadDocuments();
          loadScanTable();
        });
    });

    $('scanStartSelected').addEventListener('click', function () {
      startRemediation(false);
    });
  }

  function bindRemediatedTab() {
    $('remSearch').addEventListener(
      'input',
      debounce(function (e) {
        state.rem.search = e.target.value.trim();
        state.rem.page = 1;
        loadRemediatedTable();
      }, 350)
    );

    $('remSource').addEventListener('change', function (e) {
      state.rem.source = e.target.value;
      state.rem.page = 1;
      loadRemediatedTable();
    });

    $('remPerPage').addEventListener('change', function (e) {
      state.rem.perPage = Number(e.target.value);
      state.rem.page = 1;
      loadRemediatedTable();
    });

    $('remTbody').addEventListener('click', function (e) {
      var suggest = e.target.closest('[data-suggest]');
      if (suggest) {
        openSuggestions(suggest.getAttribute('data-suggest'));
        return;
      }
      var download = e.target.closest('[data-download]');
      if (!download) return;

      download.disabled = true;
      API.downloadRemediated(
        download.getAttribute('data-download'),
        download.getAttribute('data-name')
      ).then(function (ok) {
        download.disabled = false;
        if (!ok) toast('Could not download this file.', 'error');
      });
    });
  }

  function bindModals() {
    var confirmModal = $('confirmModal');
    confirmModal.addEventListener('click', function (e) {
      if (e.target.closest('[data-role="confirm"]')) {
        var action = state.confirm;
        closeConfirm();
        if (action) action();
      } else if (e.target.closest('[data-role="cancel"]') || e.target.closest('[data-role="close"]')) {
        closeConfirm();
      }
    });

    var sugModal = $('suggestionsModal');
    sugModal.addEventListener('click', function (e) {
      // Click the backdrop, or the close button, to dismiss.
      if (e.target === sugModal || e.target.closest('[data-role="close"]')) {
        show(sugModal, false);
      }
    });

    var partialModal = $('partialModal');
    partialModal.addEventListener('click', function (e) {
      if (e.target === partialModal || e.target.closest('[data-role="cancel"]')) {
        closePartial();
        return;
      }
      if (e.target.closest('[data-role="upgrade"]')) {
        // Autologin link — signs the operator into the accessibility dashboard
        // for this site and lands them on its PDF plans page. Opened in a new
        // tab so the workspace, and any selection in it, is left untouched.
        var target = API.upgradeUrl();
        if (target) {
          global.open(target, '_blank', 'noopener,noreferrer');
        } else {
          toast('Open the Plans page in the dashboard to upgrade.', 'info');
        }
        return;
      }
      if (e.target.closest('[data-role="continue"]')) {
        closePartial();
        startRemediation(true);
      }
    });
    partialModal.querySelector('[data-role="accept"]').addEventListener('change', function (e) {
      partialModal.querySelector('[data-role="continue"]').disabled = !e.target.checked;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeConfirm();
      closePartial();
      show($('suggestionsModal'), false);
      if (!$('accountModal').querySelector('[data-role="submit"]').disabled) closeAccountModal();
    });
  }

  /* =================================================================== *
   * Boot
   * =================================================================== */
  /**
   * The tab to open on load. The host may name one, otherwise the URL is read
   * directly so a link straight to a tab keeps working. Falls back to Upload.
   */
  function initialTab() {
    var tabs = ['upload', 'scan', 'remediated'];
    var wanted = config().initialTab;

    if (!wanted) {
      try {
        wanted = new URLSearchParams(global.location.search).get('tab');
      } catch (e) {
        wanted = null;
      }
    }

    return tabs.indexOf(wanted) !== -1 ? wanted : 'upload';
  }

  /**
   * Signs in and loads what the account owns.
   *
   * With no account there is nothing to sign in as and no dialog has been
   * submitted yet, so nothing is sent: the workspace simply shows itself empty
   * and waits for the first upload or scan to ask. This is what replaced
   * provisioning silently against a made-up `no-reply@` address.
   */
  function boot() {
    if (!state.account) {
      renderAccountBar();
      renderPlanBar();
      reloadDocuments();
      refreshCurrentTable();
      return Promise.resolve();
    }

    loading(true);

    return API.ensureSession()
      .then(function (ok) {
        if (!ok) toast('Could not sign in to the remediation service.', 'error');
        return API.fetchMe();
      })
      .then(function (user) {
        
        state.user = user;
        renderPlanBar();

        return resumeJob();
      })
      .catch(function () {
        state.user = null;
      })
      .finally(function () {
        loading(false);
        renderAccountBar();
        renderPlanBar();
        reloadDocuments();
        refreshCurrentTable();
      });
  }

  function init() {
    // A host's settings may land after this file is parsed (some put these
    // scripts in <head>), so apply them here before anything else.
    global.PdfConfig.configure(global.AIOPDF_CONFIG);

    global.Icons.hydrate(document);
    API.adoptTokenFromQuery();

    state.account = ACCOUNT.resolveAccount();
    state.accountDraft = ACCOUNT.accountDefaults();

    bindTabs();
    bindAccount();
    bindUploadTab();
    bindScanTab();
    bindRemediatedTab();
    bindModals();

    // Plans are public and only feed the upgrade recommendation, so they load
    // whether or not an account is connected — and a failure here must not stop
    // the tables.
    API.fetchPlans()
      .then(function (plans) {
        state.plans = plans;
      })
      .catch(function () {
        state.plans = [];
      });

    state.tab = initialTab();
    switchTab(state.tab);
    renderAccountBar();
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Exposed for host pages that need to drive the section (and for tests). */
  global.PdfRemediation = {
    state: state,
    switchTab: switchTab,
    reload: function () {
      reloadDocuments();
      refreshCurrentTable();
    },
    disconnect: disconnect
  };
})(window);
