The **SkynetA11y PDF Remediation Application** brings **PDF Accessibility Remediation for WCAG & PDF/UA Compliance** directly into your Craft CMS backend. It is both a **PDF Accessibility Checker** and an **AI Remediation Tool**: upload documents or crawl your website for them, let AI repair the accessibility barriers automatically, review every check that was applied, and download conformant files — without leaving your CMS.

It fixes the barriers that make PDFs unusable with assistive technology: missing tags, incorrect reading order, inaccessible forms and tables, images without alternate text, and absent document structure, language and metadata.

It supports compliance with **WCAG 2.0, 2.1, 2.2, PDF/UA, ADA, Section 508, AODA, and EN 301 549 (EAA)**. With plain-language explanations and before/after examples for every check, even non-technical users can understand what was fixed and why it mattered.

This plugin is designed for:

- Businesses of all sizes
- Enterprises
- Government and public sector entities
- Website owners
- E-commerce platforms
- Development and maintenance agencies

[**Start with a free AI remediation trial — up to 5 pages!**](https://www.skynettechnologies.com/pdf-accessibility-remediation)

## Why SkynetA11y PDF Remediation?

PDFs are where accessibility compliance quietly fails. A site can pass every
page-level audit and still publish hundreds of untagged documents — reports,
forms, invoices, policies — that screen readers cannot navigate at all.

Remediating them by hand is slow and expensive. This plugin makes it a routine
part of publishing: documents are discovered, repaired and re-checked inside the
CMS your team already uses, so accessible PDFs become the default rather than a
project.

## Key Features

- **AI PDF Remediation** – Automated repair of tags, reading order, alt text, headings, tables and metadata.
- **PDF Accessibility Checker** – Every check reported individually, expandable to a plain-language explanation and a before/after example.
- **Upload or Crawl** – Add files by drag and drop, add a PDF by URL, or sweep your website for every linked PDF.
- **Free Trial** – The free plan covers your first 5 pages; paid plans scale from 50 to 10,000 pages.
- **Bulk Remediation** – Select any number of documents and process them in one run, with live progress.
- **Deep Tag Scan** – Post-remediation verification against the document's tag tree, not just its declared metadata.
- **Authenticated Downloads** – Remediated files are delivered over an authenticated session, never a public link.
- **Zero Configuration** – No settings screen and no API keys to paste; the plugin registers your site automatically on first use.
- **Integration with All in One Accessibility® Dashboard** – Plans, usage and billing stay in one place.

## Compliance Standards Supported

- WCAG 2.0, 2.1, 2.2
- PDF/UA (ISO 14289)
- ADA
- Section 508
- AODA
- EN 301 549 (EU / European Accessibility Act)

## How It Works

1. **Add Your PDFs** – Upload files, paste a document URL, or crawl your website for every PDF it links to.
2. **Run AI Remediation** – Select documents and process them in bulk; progress is reported live.
3. **Review & Download** – Inspect each accessibility check with its explanation and before/after example, then download the conformant file.

## Getting Started

1. Visit [PDF Accessibility Remediation](https://www.skynettechnologies.com/pdf-accessibility-remediation).
2. Install the plugin (see **Setup** below).
3. Open **SkynetA11y PDF Remediation** in the Craft backend — your site is registered automatically on the free plan.
4. Add PDFs, remediate, and download the results.

## Who Can Benefit?

- Website Owners & Businesses
- Developers & Web Agencies
- Government & Public Sector Organizations
- Education, Healthcare & Financial Institutions
- Legal & Compliance Teams
- Publishers & Content Teams
- E-commerce & SaaS Platforms

## Installation

Follow the steps below to install the **SkynetAccessibility Video Subtitle** module for Craft CMS.

### Prerequisites

- Craft Version 5*

### 1. Open your project root directory

Make sure you are in the **root folder** of your Craft CMS project.

---

### 2. Require the module via Composer

Run the following command in your terminal:

```bash```
composer require skynettechnologies/craft-skyneta11ypdfremediation
php craft plugin/install craft-skyneta11ypdfremediation

### Requirements

- Craft CMS v5 (built and tested against v4.4 / Laravel 12)
- PHP 7.4+ with the `curl` extension
- Outbound HTTPS to the remediation service

## CORS Policy Configuration

To avoid CORS policy issues, ensure the following URLs are allowed in your website. These URLs should be added to your CORS configuration or trusted domains list.

| **Domain**                                   | **Description**                     | **Usage**                              |
|----------------------------------------------|-------------------------------------|----------------------------------------|
| `https://livepdfapi.skynettechnologies.us`  | SkynetA11y PDF Remediation API              | Documents, remediation jobs, downloads |
| `https://ada.skynettechnologies.us` | All in One Accessibility® Dashboard | Plan upgrades via autologin            |

## Instructions

1. Update your server's CORS configuration to include these URLs.
2. Ensure wildcard subdomains (`*`) are supported where necessary.
3. Verify the application functionality by testing requests to these domains.
4. If issues persist, consult the documentation for CORS configuration guidance.

### Configuration

- There is no settings screen. Everything the plugin needs is derived from your site, so it works the moment it is
  installed. Open **SkynetA11y PDF Remediation** from the main menu to
  start using it.


## Screenshots

![SkynetA11y-PDF-Remediation-Feature1](https://www.skynettechnologies.com/sites/default/files/SkynetA11yPDFRemediation/SkynetA11y-PDF-Remediation-Feature1.jpg)
![SkynetA11y-PDF-Remediation-Feature2](https://www.skynettechnologies.com/sites/default/files/SkynetA11yPDFRemediation/SkynetA11y-PDF-Remediation-Feature2.jpg)
![SkynetA11y-PDF-Remediation-Feature3](https://www.skynettechnologies.com/sites/default/files/SkynetA11yPDFRemediation/SkynetA11y-PDF-Remediation-Feature3.jpg)


## Submit a Support Request

Please visit our **[support page](https://www.skynettechnologies.com/report-accessibility-problem)** and fill out the form. Our team will get back to you as soon as possible.

## Send Us an Email

Alternatively, you can send an email to our support team:
**[hello@skynettechnologies.com](mailto:hello@skynettechnologies.com)**

## Accessibility Partnership Opportunities

### **[Accessibility Agency Partnership](https://www.skynettechnologies.com/agency-partners)**

Partner with us as an agency to provide comprehensive accessibility solutions to your existing clients. Get access to exclusive resources, training, and support to help you implement and manage accessibility features effectively.

### **[Accessibility Affiliate Partnership](https://www.skynettechnologies.com/affiliate-partner)**

Join our affiliate program and earn hefty commissions by promoting SkynetA11y PDF Remediation. Share our accessibility solution within your network and help businesses improve their document accessibility while generating additional revenue.

For more details, please visit **[Accessibility Partnership Opportunities Page](https://www.skynettechnologies.com/partner-program)**.

## Credits

This **SkynetA11y PDF Remediation Application** is developed and maintained by **[Skynet Technologies USA LLC](https://www.skynettechnologies.com)**