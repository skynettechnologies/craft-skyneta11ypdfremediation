/*
 * The remediation account this page signs in as.
 *
 * Earlier builds invented an identity from the page's own hostname —
 * `no-reply@www.example.com` — and provisioned silently on boot. This one does
 * not: somebody enters a real name, email and domain once, and that is what the
 * account is registered under. Nothing is sent to the service until they submit.
 *
 * Because this is a browser-side build with no server of its own, the details
 * live in the operator's own browser, next to the session token they produce.
 * That is per-browser rather than per-install: a second operator fills the
 * dialog in once too. Provisioning is idempotent, so entering the same email
 * lands on the same account and the same document queue — it is not a second
 * registration.
 *
 * `config.accountEmail` and `config.website`, when both are set, stand in for a
 * submitted dialog: the page connects without asking. Set either one alone and
 * it is treated as a default that pre-fills the dialog instead.
 */
(function (global) {
  'use strict';

  var ACCOUNT_KEY = 'aiopdf_account';

  function config() {
    return global.PdfConfig.get();
  }

  /** Trims a value to a string, tolerating null/undefined. */
  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * Normalises a domain the way the service wants it: a bare host, no scheme, no
   * port, no trailing path. `https://Example.com:8080/docs` → `example.com`.
   */
  function normaliseDomain(value) {
    var domain = text(value);

    if (!domain) return '';

    if (domain.indexOf('//') !== -1) {
      try {
        domain = new URL(domain).hostname;
      } catch (e) {
        domain = domain.split('//').pop();
      }
    }

    return domain
      .split('/')[0]
      .split('?')[0]
      .replace(/:\d+$/, '')
      .replace(/^\.+|\.+$/g, '')
      .toLowerCase();
  }

  /** A complete account, or null. */
  function shape(source) {
    if (!source) return null;

    var account = {
      name: text(source.name),
      email: text(source.email).toLowerCase(),
      domain: normaliseDomain(source.domain)
    };

    return account.name && account.email && account.domain ? account : null;
  }

  /** The account saved from the dialog, or null if nobody has connected yet. */
  function readAccount() {
    try {
      return shape(JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'));
    } catch (e) {
      /* storage unavailable, or the entry is not JSON */
      return null;
    }
  }

  /** Persists a submitted account. Returns the normalised form, or null. */
  function writeAccount(values) {
    var account = shape(values);

    if (!account) return null;

    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    } catch (e) {
      /* storage unavailable — the session still works until the tab closes */
    }

    return account;
  }

  function clearAccount() {
    try {
      localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) {
      /* nothing to clear */
    }
  }

  /**
   * The account the page should sign in as: a pinned one from config.js,
   * otherwise whatever was submitted through the dialog.
   */
  function resolveAccount() {
    var c = config();
    var pinned = shape({
      name: c.accountName || c.website,
      email: c.accountEmail,
      domain: c.website
    });

    return pinned || readAccount();
  }

  /** Whether the page can talk to the service without asking for details. */
  function hasAccount() {
    return Boolean(resolveAccount());
  }

  /**
   * The domain to offer before anybody has said otherwise: the host this page is
   * served from, or a configured `website` when one is pinned.
   *
   * This is a *suggestion in a field the operator can edit*, not an identity the
   * module invents and registers on its own — which is the whole difference from
   * the old `no-reply@<host>` behaviour.
   */
  function defaultDomain() {
    return normaliseDomain(config().website || global.location.hostname);
  }

  /** Values the dialog opens with. */
  function accountDefaults() {
    var stored = readAccount();

    if (stored) return stored;

    var c = config();

    return {
      name: text(c.accountName),
      email: text(c.accountEmail),
      domain: defaultDomain()
    };
  }

  /** Basic shape check, so an obvious typo is caught before the round trip. */
  function validateAccount(values) {
    var errors = {};

    if (!text(values.name)) {
      errors.name = 'Enter the name this account should be registered under.';
    }

    var email = text(values.email);

    if (!email) {
      errors.email = 'Enter an email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'That does not look like an email address.';
    }

    var domain = normaliseDomain(values.domain);

    if (!domain) {
      errors.domain = 'Enter the website these PDFs belong to.';
    } else if (domain.indexOf('.') === -1) {
      errors.domain = 'Enter a full domain, such as example.com.';
    }

    return errors;
  }

  global.PdfAccount = {
    ACCOUNT_KEY: ACCOUNT_KEY,
    normaliseDomain: normaliseDomain,
    readAccount: readAccount,
    writeAccount: writeAccount,
    clearAccount: clearAccount,
    resolveAccount: resolveAccount,
    hasAccount: hasAccount,
    defaultDomain: defaultDomain,
    accountDefaults: accountDefaults,
    validateAccount: validateAccount
  };
})(window);
