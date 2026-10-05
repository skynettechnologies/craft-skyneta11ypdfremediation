/*
 * Inline SVG icon set — a straight port of src/components/Icons.tsx.
 *
 * `Icons.get(name, size)` returns markup; `Icons.hydrate(root)` replaces every
 * `[data-icon]` placeholder inside `root` with its SVG, so static markup in
 * index.html can declare icons without hand-writing the paths.
 */
(function (global) {
  'use strict';

  var STROKE =
    'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

  var PATHS = {
    doc:
      '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    upload:
      '<path d="M12 16V4m0 0 -4.5 4.5M12 4l4.5 4.5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    link:
      '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 10h-15Z"/><path d="M5 21h14"/>',
    warning: '<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4m0 3v.01"/>',
    info: '<path d="M12 11v6m0-10v.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    download:
      '<path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    trash:
      '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    spinner: '<path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5" opacity="0.9"/>'
  };

  // Stroke width differs per icon in the original set.
  var WIDTHS = {
    doc: 2,
    check: 3,
    upload: 2.2,
    link: 2.2,
    x: 2.6,
    crown: 2,
    warning: 2.2,
    info: 2.2,
    search: 2.2,
    download: 2.2,
    trash: 2,
    spinner: 2.6
  };

  function get(name, size) {
    size = size || 20;

    // Filled icons — no stroke.
    if (name === 'sparkles') {
      return (
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M11 3l1.7 4.8L17.5 9.5l-4.8 1.7L11 16l-1.7-4.8L4.5 9.5l4.8-1.7Z"/>' +
        '<path d="M18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z"/></svg>'
      );
    }

    var body = PATHS[name];
    if (!body) return '';

    var svg =
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' + STROKE +
      ' stroke-width="' + (WIDTHS[name] || 2) + '" aria-hidden="true">' + body + '</svg>';

    // The spinner ships wrapped in the animation span, same as the React icon.
    return name === 'spinner' ? '<span class="spin">' + svg + '</span>' : svg;
  }

  /** Replaces every `[data-icon]` placeholder under `root` with its SVG. */
  function hydrate(root) {
    var nodes = (root || document).querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.innerHTML = get(el.getAttribute('data-icon'), Number(el.getAttribute('data-size')) || 20);
    }
  }

  global.Icons = { get: get, hydrate: hydrate };
})(window);
