<?php
namespace skynettechnologies\craftskyneta11ypdfremediation;
use Craft;
use skynettechnologies\craftskyneta11ypdfremediation\assetbundles\AdminSettingsAsset;

$bundle = AdminSettingsAsset::register(Craft::$app->getView());


$resource_path = "@skynettechnologies/craftskyneta11ypdfremediation/resources/";
?>
     <!-- =====================================================================
            SkynetA11y PDF Remediation — section only (no site header/footer)
            Everything below lives inside `.aiopdf-app.aiopdf-embedded`, which scopes
            the stylesheet so it cannot leak into the host page.
            ===================================================================== -->
      <div class="aiopdf-app aiopdf-embedded" data-theme="light" id="aiopdfApp">

      <!-- ---------- Page title (gradient bar) ---------- -->
      <div class="aiopdf_dashboard-page-title-wrapper">
        <div class="aiopdf_dashboard-page-title">
          <h1 style="display:none">SkynetA11y PDF Remediation</h1>
          <div class="subtitle" id="pageSubtitle">
            Add files or scan document URLs for AI-powered accessibility remediation.
          </div>

          <!-- Who this workspace is connected as. Informational only: there is
               no switch here, because the account belongs to the site rather
               than to whoever happens to be looking at the page. Host code can
               still call PdfRemediation.disconnect() to reset it. -->
          <div class="aiopdf-account-bar" id="accountBar" hidden>
            <span><b data-role="domain"></b> · <span data-role="email"></span></span>
          </div>

          <!-- Which plan the account is on and how much of it is left. Filled
               in from /api/auth/me, which carries planName, planPages and
               pagesRemaining, and recounted after every run. -->
          <div class="aiopdf-plan-bar" id="planBar" hidden>
            <span class="status-chip ready" data-role="plan"></span>
            <span class="status-chip" data-role="pages" hidden></span>
            <a class="btn btn-gradient btn-sm aiopdf-plan-upgrade" data-role="upgrade"
              target="_blank" rel="noopener noreferrer" hidden>
              <span data-icon="crown" data-size="16"></span> Upgrade
            </a>
          </div>
        </div>
      </div>

      <!-- ---------- Tabs ---------- -->
      <div class="aiopdf_dashboard-pdf-remediation-type-list-tab">
        <ul>
          <li>
            <button type="button" class="aiopdf_btn aiopdf_btn-primary active" data-tab="upload" id="tabBtnUpload">
              <span class="tab-ico" data-icon="upload" data-size="25"></span> Upload
            </button>
          </li>
          <li>
            <button type="button" class="aiopdf_btn" data-tab="scan" id="">
              <span class="tab-ico" data-icon="link" data-size="25"></span> Website Scan
            </button>
          </li>
          <li>
            <button type="button" class="aiopdf_btn" data-tab="remediated" id="tabBtnRemediated">
              <span class="tab-ico" data-icon="doc" data-size="25"></span> Remediated
            </button>
          </li>
        </ul>
      </div>

      <!-- =================================================================
           TAB 1 — UPLOAD
           ================================================================= -->
      <section class="aiopdf-tab-panel" id="panelUpload">

        <!-- Drop zone -->
        <div class="panel">
          <div class="upload-split upload-split-single">
            <div class="dropzone" id="dropzone" style="padding:44px 16px" tabindex="0" role="button"
              aria-label="Drag and drop a PDF file here, or click to browse">
              <div class="dz-icon" data-icon="doc" data-size="26"></div>
              <span id="dropzoneLabel">Drag and Drop file here</span>
            </div>
          </div>

          <div class="dz-note" style="padding-bottom:10px;margin-top:0">
            <span>PDF format only</span><span class="dot">&bull;</span>
            <span>Up to 50 MB</span><span class="dot">&bull;</span>
            <span style="color:var(--accent)">Unencrypted files</span>
            
          </div>
          <div class="dz-note" style="padding-bottom:18px;margin-top:0;color: #292828;">
        Password-protected PDFs are not supported.
    </div>
        </div>

        <!-- Documents table -->
        <div class="panel table-panel">
          <div class="filters-row">
            <h3>Documents</h3>
            <div class="grow"></div>
            <div class="search-box">
              <span data-icon="search" data-size="16"></span>
              <input class="input" id="uploadSearch" type="search" placeholder="Search documents"
                aria-label="Search documents" />
            </div>
            <div class="filter-group">
              <label for="uploadPerPage">Items per page</label>
              <select class="select select-arrow" id="uploadPerPage">
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <div class="inline-progress" id="uploadProgress" hidden>
            <div class="processing-label" style="font-size:15.5px">AI remediation in progress…</div>
            <div class="progress-track" style="height:9px">
              <div class="progress-fill" data-role="fill" style="width:4%"></div>
            </div>
          </div>

          <div class="table-responsive" id="uploadTableWrap">
            <table class="data-table" id="uploadTable">
              <thead>
                <tr>
                  <th style="width:44px">
                    <input type="checkbox" class="aiocheckbox" id="uploadSelectAll" aria-label="Select all documents" />
                  </th>
                  <th>File Name</th>
                  <th style="text-align:center">Source</th>
                  <th style="text-align:center">Pages</th>
                  <th style="width:280px;text-align:center">Action</th>
                </tr>
              </thead>
              <tbody id="uploadTbody"></tbody>
            </table>
            <div class="aiopdf_dashboard-table-pagination-main" id="uploadPagination"></div>
          </div>

          <div class="empty-state" id="uploadEmpty" hidden></div>

          <div class="bulk-footer">
            <span class="bulk-icon" data-icon="doc" data-size="20"></span>
            <div class="bulk-meta">
              <span>Selected: <b id="uploadSelCount">0</b> documents</span>
              <span class="bulk-sep"></span>
              <span>Total: <b id="uploadSelPages">0</b> pages</span>
            </div>
            <div class="bulk-actions">
              <button  type="button" class="btn btn-delete" id="uploadRemoveSelected" disabled>
                <span data-icon="trash" data-size="20"></span> Remove Selected
              </button>
              <button  type="button" class="btn btn-gradient" id="uploadStartSelected" disabled>
                <span data-icon="sparkles" data-size="20"></span> Add Selected for Remediation
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- =================================================================
           TAB 2 — WEBSITE SCAN
           ================================================================= -->
      <section class="aiopdf-tab-panel" id="panelScan" hidden>
        <div class="panel">
          <div class="filters-row">
            <button type="button" class="btn btn-outline btn-sm" id="crawlBtn" hidden></button>
            <div class="grow"></div>
            <div class="filters-actions">
              <div class="search-box">
                <span data-icon="search" data-size="16"></span>
                <input class="input" id="scanSearch" type="search" placeholder="Search documents"
                  aria-label="Search scanned documents" />
              </div>
              <div class="filter-group">
                <label for="scanStatus">Status</label>
                <select class="select select-arrow" id="scanStatus">
                  <option value="all">All status</option>
                  <option value="scanning">Scanning</option>
                  <option value="pending">Pending scan</option>
                  <option value="ready">Pending</option>
                  <option value="remediated">Remediated</option>
                </select>
              </div>
              <div class="filter-group">
                <label for="scanPerPage">Items per page</label>
                <select class="select select-arrow" id="scanPerPage">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>
          </div>

          <div class="inline-progress" id="scanProgress" hidden>
            <div class="processing-label" style="font-size:15.5px">AI remediation in progress…</div>
            <div class="progress-track" style="height:9px">
              <div class="progress-fill" data-role="fill" style="width:4%"></div>
            </div>
          </div>

          <div class="table-responsive" id="scanTableWrap">
            <table class="data-table" id="scanTable">
              <thead>
                <tr>
                  <th style="width:44px">
                    <input type="checkbox" class="aiocheckbox" id="scanSelectAll" aria-label="Select all documents" />
                  </th>
                  <th>File Name / Source</th>
                  <th style="width:100px;text-align:center">Pages</th>
                  <th style="width:160px;text-align:center">Status</th>
                </tr>
              </thead>
              <tbody id="scanTbody"></tbody>
            </table>
            <div class="aiopdf_dashboard-table-pagination-main" id="scanPagination"></div>
          </div>

          <div class="empty-state" id="scanEmpty" hidden></div>

          <div class="bulk-footer">
            <span class="bulk-icon" data-icon="doc" data-size="20"></span>
            <div class="bulk-meta">
              <span>Selected: <b id="scanSelCount">0</b> documents</span>
              <span class="bulk-sep"></span>
              <span>Total: <b id="scanSelPages">0</b> pages</span>
            </div>
            <div class="bulk-actions">
              <button  type="button"class="btn btn-gradient" id="scanStartSelected" disabled>
                <span data-icon="sparkles" data-size="20"></span> Add Selected for Remediation
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- =================================================================
           TAB 3 — REMEDIATED
           ================================================================= -->
      <section class="aiopdf-tab-panel" id="panelRemediated" hidden>
        <div class="panel">
          <div class="filters-row">
            <h3 style="font-size:1.5rem">Remediated PDFs</h3>
            <div class="grow"></div>
            <div class="search-box">
              <span data-icon="search" data-size="16"></span>
              <input class="input" id="remSearch" type="search" placeholder="Search remediated PDFs"
                aria-label="Search remediated PDFs" />
            </div>
            <div class="filter-group">
              <select class="select select-arrow" id="remSource" aria-label="Filter by source">
                <option value="all">All sources</option>
                <option value="file">Upload PDF</option>
                <option value="url">Scan PDF URL</option>
                <option value="web">Website Scan</option>
              </select>
            </div>
            <div class="filter-group">
              <label for="remPerPage">Items per page</label>
              <select class="select select-arrow" id="remPerPage">
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <div class="table-responsive" id="remTableWrap">
            <table class="data-table" id="remTable">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th class="text-center">Added From</th>
                  <th class="text-center">Remediated On</th>
                  <th class="text-center" style="width:100px">Pages</th>
                  <th style="width:310px;text-align:right"></th>
                </tr>
              </thead>
              <tbody id="remTbody"></tbody>
            </table>
            <div class="aiopdf_dashboard-table-pagination-main" id="remPagination"></div>
          </div>

          <div class="empty-state" id="remEmpty" hidden></div>
        </div>
      </section>

      <!-- Hidden file input driving the drop zone -->
      <input type="file" id="fileInput" accept="application/pdf,.pdf" multiple hidden />

      <!-- =================================================================
           MODALS
           ================================================================= -->

      <!--
          Account details.

          The workspace does NOT gate itself behind this: everything above is on
          screen from the start, and this dialog opens only at the moment an
          action has to reach the service — the first upload, or the first
          website scan. Once submitted, the action carries on by itself.
      -->
      <div class="modal-backdrop" id="accountModal" hidden>
        <div class="modal aiopdf-account-modal" role="dialog" aria-modal="true"
          aria-labelledby="accountTitle">
          <div class="sug-head" style="margin-bottom:18px">
            <div>
              <h3 id="accountTitle" style="margin-bottom:4px">First, a few details</h3>
              <div class="sug-sub" data-role="prompt"></div>
            </div>
            <button type="button" class="icon-btn close-btn-model" data-role="close" aria-label="Close">
              <span data-icon="x" data-size="16"></span>
            </button>
          </div>

          <form id="accountForm" novalidate>
            <div class="form-row">
              <div class="field">
                <label for="accountName">Name<span class="req">*</span></label>
                <input id="accountName" class="input" type="text" placeholder="Acme Corporation"
                  autocomplete="organization" aria-describedby="accountName-hint" />
                <div class="form-error" id="accountName-error" hidden></div>
                <div class="aiopdf-field-hint" id="accountName-hint">Your name, or your organisation’s.</div>
              </div>

              <div class="field">
                <label for="accountEmail">Email address<span class="req">*</span></label>
                <input id="accountEmail" class="input" type="email" placeholder="you@example.com"
                  autocomplete="email" aria-describedby="accountEmail-hint" />
                <div class="form-error" id="accountEmail-error" hidden></div>
                <div class="aiopdf-field-hint" id="accountEmail-hint">Identifies the account and its plan.</div>
              </div>
            </div>

            <div class="field">
              <label for="accountDomain">Website domain<span class="req">*</span></label>
              <input id="accountDomain" class="input" type="text" placeholder="example.com"
                autocomplete="url" aria-describedby="accountDomain-hint" />
              <div class="form-error" id="accountDomain-error" hidden></div>
              <div class="aiopdf-field-hint" id="accountDomain-hint">
                The site these PDFs belong to. Change it if this is not it.
              </div>
            </div>

            <div class="rule-callout error" style="margin:4px 0 20px" data-role="failure" hidden>
              <span class="icon" data-icon="warning" data-size="20"></span>
              <div>
                <strong>That did not work</strong>
                <p data-role="failure-text"></p>
              </div>
            </div>

            <div class="modal-actions" style="margin-top:8px;justify-content:flex-end">
              <button type="button" class="btn btn-outline btn-sm" data-role="cancel">Cancel</button>
             <button type="button" class="btn btn-gradient btn-sm" data-role="submit">
  <span data-icon="sparkles" data-size="17"></span> Save and continue
</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Remove confirmation -->
      <div class="modal-overlay" id="confirmModal" hidden>
        <div class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
          <div class="modal-header">
            <h2 id="confirmTitle">Remove Document</h2>
            <button type="button" class="modal-close" data-role="close" aria-label="Close">
              <span data-icon="x" data-size="16"></span>
            </button>
          </div>
          <div class="modal-body">
            <p data-role="message"></p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-delete" data-role="confirm">Remove</button>
            <button type="button" class="btn-cancel" data-role="cancel">Cancel</button>
          </div>
        </div>
      </div>

      <!-- AI Suggestions -->
      <div class="modal-backdrop" id="suggestionsModal" hidden>
        <div class="modal suggestions-modal" role="dialog" aria-modal="true" aria-labelledby="sugHeading">
          <div class="sug-head">
            <div>
              <h3 id="sugHeading" style="margin-bottom:4px">
                <span data-icon="sparkles" data-size="18"></span> AI Suggestions
              </h3>
              <div class="sug-sub" data-role="sub"></div>
            </div>
            <button class="icon-btn close-btn-model" data-role="close" aria-label="Close">
              <span data-icon="x" data-size="16"></span>
            </button>
          </div>
          <div data-role="body"></div>
        </div>
      </div>

      <!--
          Plan coverage.

          Serves both ways the service can refuse a run. PARTIAL_REQUIRED covers
          part of the selection, so the checkbox and "Start AI Remediation" are
          shown. PAGE_LIMIT means the plan is used up — there is nothing to
          continue with, so those are hidden and Cancel takes their place.
      -->
      <div class="modal-backdrop" id="partialModal" hidden>
        <div class="modal" style="width:540px" role="dialog" aria-modal="true" aria-labelledby="partialHeading">
          <div style="display:flex;gap:14px;align-items:flex-start">
            <span class="notice-icon" style="width:48px;height:48px;flex-shrink:0" data-role="icon"></span>
            <div>
              <h3 id="partialHeading" style="margin-bottom:8px" data-role="title"></h3>
              <p style="margin:0;color:var(--text-soft);font-size:15px;line-height:1.6;font-weight:600"
                data-role="body"></p>
            </div>
          </div>

          <div class="notice-pill" style="margin-top:16px;margin-bottom:0;width:100%" data-role="recommended" hidden>
            <span data-icon="crown" data-size="18"></span>
            <span data-role="recommended-text"></span>
          </div>

          <label class="aiocheckbox-row" style="margin:16px 0 0;cursor:pointer" data-role="accept-row">
            <input type="checkbox" data-role="accept" />
            <span data-role="accept-label"></span>
          </label>

          <div class="modal-actions" style="margin-top:22px;justify-content:space-between">
            <button class="btn btn-outline btn-sm" data-role="cancel" hidden>Cancel</button>
            <button class="btn btn-gradient btn-sm" data-role="upgrade">
              <span data-icon="crown" data-size="17"></span> <span data-role="upgrade-label">Recommended Plan</span>
            </button>
            <button class="btn btn-primary btn-sm" data-role="continue" disabled>
              <span data-icon="sparkles" data-size="17"></span> Start AI Remediation
            </button>
          </div>
        </div>
      </div>

      <!-- Full-screen table loader -->
    <div class="aioa_dashboard-fullscreen-loader"
     id="tableLoader"
     role="alert"
     aria-live="polite"
     hidden>
    <div class="aioa_dashboard-loader">

  <img
        src="<?= $bundle->baseUrl ?>/Image/icon-spinner.svg"
        alt=""
    >
        <span class="visually-hidden">Loading page…</span>
    </div>
</div>

      <!-- Toast -->
      <div class="toast" id="toast" role="status" hidden></div>
    </div>
