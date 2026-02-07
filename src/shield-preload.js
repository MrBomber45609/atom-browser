// ================================================================
// ATOM SHIELD — Pre-DOM Injection Script
// ================================================================
// This preload script runs BEFORE page scripts, enabling early
// interception of YouTube's ad-related data structures.
// 
// Key insight from uBlock Origin: ytInitialPlayerResponse is parsed
// BEFORE dom-ready, so we need to trap it at document-start.
// ================================================================

const { webFrame } = require('electron');

// Script to inject into the page context BEFORE any page scripts run
const INJECTION_SCRIPT = `
(function() {
    'use strict';
    
    // Skip if already injected
    if (window.__atomShieldPreload) return;
    window.__atomShieldPreload = true;
    
    // Only run on YouTube
    var host = window.location.hostname || '';
    if (!host.includes('youtube.com') && !host.includes('youtu.be')) return;
    
    // ====== AD DATA STRIPPING ======
    var adKeys = ['adPlacements', 'adSlots', 'playerAds', 'adBreakParams', 'adBreakHeartbeatParams'];
    
    function stripAdsDeep(obj, depth) {
        if (!obj || typeof obj !== 'object' || depth > 8) return obj;
        
        try {
            // Remove ad arrays
            for (var i = 0; i < adKeys.length; i++) {
                var key = adKeys[i];
                if (Array.isArray(obj[key])) {
                    obj[key] = [];
                } else if (obj[key]) {
                    delete obj[key];
                }
            }
            
            // Remove ad break renderer
            if (obj.adBreakRenderer) delete obj.adBreakRenderer;
            
            // Recurse into known nested objects
            if (obj.playerResponse) stripAdsDeep(obj.playerResponse, depth + 1);
            if (obj.response) stripAdsDeep(obj.response, depth + 1);
        } catch (e) {}
        
        return obj;
    }
    
    // ====== EARLY TRAP: ytInitialPlayerResponse ======
    function createTrap(propName) {
        var value = undefined;
        var originalValue = window[propName];
        
        // If already set, strip it now
        if (originalValue && typeof originalValue === 'object') {
            stripAdsDeep(originalValue, 0);
            value = originalValue;
        }
        
        try {
            Object.defineProperty(window, propName, {
                configurable: true,
                enumerable: true,
                get: function() { return value; },
                set: function(newVal) {
                    if (newVal && typeof newVal === 'object') {
                        stripAdsDeep(newVal, 0);
                    }
                    value = newVal;
                }
            });
        } catch(e) {
            console.log('[Atom Shield] Could not trap ' + propName);
        }
    }
    
    // Set up traps immediately
    createTrap('ytInitialPlayerResponse');
    createTrap('ytInitialData');
    
    console.log('[Atom Shield] Pre-DOM traps active');
})();
`;

// Inject the script into the page context at document-start
try {
    webFrame.executeJavaScript(INJECTION_SCRIPT, true).catch(() => { });
} catch (e) {
    // Ignore errors
}
