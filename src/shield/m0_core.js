// ================================================================
// ATOM SHIELD — Module 0: Core Utilities
// Shared helpers used by all other modules.
// ================================================================

// CRITICAL: Do not run in sandboxed iframes or about:blank frames.
// WebView2's AddScriptToExecuteOnDocumentCreated injects into ALL
// frames including sandboxed ones. Running there causes errors and
// can break YouTube's player iframes.
if (
    window.location.href === 'about:blank' ||
    window.location.protocol === 'about:' ||
    window.location.protocol === 'data:' ||
    window.location.protocol === 'blob:'
) {
    // Set flag so subsequent modules also bail out
    window.__atomShield = { skip: true };
} else {

    window.__atomShield = window.__atomShield || {};

    (function (AS) {
        'use strict';

        AS.skip = false;

        // --- Noop functions ---
        AS.noop = function () { };
        AS.noopTrue = function () { return true; };
        AS.noopFalse = function () { return false; };
        AS.noopNull = function () { return null; };
        AS.noopArray = function () { return []; };
        AS.noopObj = function () { return {}; };

        // --- Site detection ---
        AS.host = (window.location.hostname || '').toLowerCase();
        AS.isYT = AS.host.includes('youtube.com');

        // --- Safe CSS injection (Trusted Types compatible) ---
        AS.injectCSS = function (css) {
            try {
                var s = document.createElement('style');
                s.textContent = css;
                (document.head || document.documentElement).appendChild(s);
            } catch (e) { }
        };

        // --- DOM Observer Optimized (v2) ---
        AS.observeDOM = function (selectors, callback) {
            try {
                var target = document.documentElement || document.body;
                if (!target) return null;

                // Pre-compile ignore list for performance (Speedometer check)
                var IGNORE_TAGS = {
                    'SCRIPT': 1, 'STYLE': 1, 'LINK': 1, 'META': 1, 'HEAD': 1, 'TITLE': 1,
                    'BR': 1, 'HR': 1, 'WBR': 1
                };

                var ob = new MutationObserver(function (muts) {
                    // Limit processing time per frame
                    var start = performance.now();

                    for (var i = 0; i < muts.length; i++) {
                        if (performance.now() - start > 5) break; // Hard limit 5ms per callback

                        var nodes = muts[i].addedNodes;
                        if (!nodes || nodes.length === 0) continue;

                        for (var j = 0; j < nodes.length; j++) {
                            var n = nodes[j];
                            if (n.nodeType !== 1) continue; // Element only

                            // Fast tag check
                            if (IGNORE_TAGS[n.tagName]) continue;

                            try {
                                // Direct match
                                if (n.matches && n.matches(selectors)) {
                                    callback(n);
                                }
                                // Deep scan only for containers
                                else if (n.tagName === 'DIV' || n.tagName === 'IFRAME' || n.tagName === 'INS' || n.tagName === 'SECTION' || n.tagName === 'ASIDE') {
                                    // Use getElementsByTagName instead of querySelectorAll for slightly better perf on specific tags if possible, 
                                    // but querySelectorAll with limited scope is okay.
                                    // Don't scan entire subtree if it's huge?
                                    var kids = n.querySelectorAll(selectors);
                                    for (var k = 0; k < kids.length; k++) callback(kids[k]);
                                }
                            } catch (e) { }
                        }
                    }
                });
                ob.observe(target, { childList: true, subtree: true });
                return ob;
            } catch (e) { return null; }
        };

        // --- Safe toString override ---
        AS.hideFunction = function (fn, name) {
            try {
                Object.defineProperty(fn, 'toString', {
                    value: function () { return 'function ' + (name || '') + '() { [native code] }'; }
                });
            } catch (e) { }
        };

    })(window.__atomShield);

} // end of about:blank guard