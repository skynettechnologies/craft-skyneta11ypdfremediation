/*
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  SkynetA11y PDF Remediation — configuration                        │
 * │                                                                          │
 * │  This is the file to edit. Everything the module needs lives here, and   │
 * │  nothing else has to be changed to run it.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * An empty string means "derive it" — the comment on each field says from what.
 * Nothing here has to be filled in for the module to work.
 *
 * A host application (a CMS plugin, a PHP or Node template) can also inject
 * these values instead of editing this file: set `window.AIOPDF_CONFIG` to an
 * object with any of the same keys, before OR after this script loads, and the
 * values are merged over the defaults below on boot.
 */
(function (global) {
  'use strict';

  var defaults = {
    /** Origin of the AI PDF Remediation backend. */
    apiBaseUrl: 'https://livepdfapi.skynettechnologies.us',

    /**
     * Key for the provisioning endpoint, sent as `X-Api-Key`.
     *
     * SECURITY: this is a browser-side build, so the key is readable by anyone
     * who can load the page. That is acceptable behind an authenticated admin
     * area used only by staff. If the key must never leave your server, point
     * `sessionUrl` below at an endpoint of your own that performs the
     * provisioning call server-side and returns just the session token — then
     * delete this value. See README.md.
     */
    provisionApiKey: 'PDF-REMEDATION-PLAN-CHECK',

    /* ---- The account -------------------------------------------------
     *
     * By default the module asks. Somebody opens it, fills in a name, email and
     * domain at the moment of the first upload or website scan, and that is what
     * the remediation account is registered under — nothing is sent to the
     * service before they submit.
     *
     * Setting BOTH `accountEmail` and `website` below pins the account for the
     * whole install: the dialog is skipped and the page connects on load.
     * Setting only one leaves the dialog in place with that field pre-filled.
     * ------------------------------------------------------------------ */

    /** Name the account is registered under. Pre-fills the dialog. */
    accountName: '',

    /** Address the account is provisioned under. Pre-fills the dialog. */
    accountEmail: '',

    /** Site the account is registered against. Pre-fills the dialog. */
    website: '',

    /**
     * Domain the Website Scan tab crawls.
     *
     * Empty (the default) uses the connected account's domain, falling back to
     * the account's first registered domain when the service does not recognise
     * it.
     */
    activeDomain: '',

    /** Plan new accounts are provisioned on. */
    planId: 'free',

    /** Two-letter country code recorded on the account. */
    country: 'US',

    /** Dashboard the coverage modal's upgrade button links to. */
    dashboardUrl: 'https://ada.skynettechnologies.us',

    /** Autologin link for that button. Empty derives it from the website. */
    upgradeUrl: '',

    /**
     * Server-side session endpoint. When set, sign-in is a single POST to it and
     * `provisionApiKey` is never used or shipped. Left empty by default — see
     * "Keeping the API key off the page" in README.md.
     */
    sessionUrl: '',

    /** CSRF token for the POST above, when the endpoint requires one. */
    csrfToken: '',

    /**
     * Fingerprint of the account this page signs in as. Empty derives it from
     * the website and account email, which is what scopes the cached session
     * token to the account it belongs to.
     */
    accountKey: '',

    /**
     * Tab to open on load: 'upload', 'scan' or 'remediated'.
     *
     * Empty (the default) opens Upload, and lets `?tab=` in the URL pick one, so
     * a link straight to a tab keeps working. Setting it pins the tab and
     * ignores the query string.
     */
    initialTab: '',

    /** localStorage key the session token lives under. */
    tokenKey: 'aiopdf_token'
  };

  var CONFIG = {};

  Object.keys(defaults).forEach(function (key) {
    CONFIG[key] = defaults[key];
  });

  /**
   * Merges host-supplied settings over the defaults. Anything not supplied keeps
   * its default.
   *
   * Called both at load and again from app.js on boot, because a host may put
   * these files in <head> while its own inline `AIOPDF_CONFIG` script sits in
   * the body — so at load time there may be nothing to read yet.
   */
  function configure(next) {
    if (!next) return CONFIG;

    Object.keys(next).forEach(function (key) {
      if (next[key] !== undefined && next[key] !== null) CONFIG[key] = next[key];
    });

    return CONFIG;
  }

  configure(global.AIOPDF_CONFIG);

  global.PdfConfig = {
    get: function () {
      return CONFIG;
    },
    configure: configure
  };
})(window);
