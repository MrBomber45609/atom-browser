// ================================================================
// ATOM SHIELD — Module 3: Google Publisher Tag (GPT) Mock
// ================================================================
// Complete mock of the googletag API. This prevents JS errors
// when ad scripts try to call googletag functions, and makes
// detection scripts think ads loaded normally.
// Only runs on NON-YouTube sites.
// ================================================================

(function () {
    'use strict';

    var AS = window.__atomShield;
    if (!AS || AS.skip || AS.isYT) return;

    var noop = AS.noop;
    var noopNull = AS.noopNull;
    var noopArray = AS.noopArray;
    var noopObj = AS.noopObj;
    var noopTrue = AS.noopTrue;

    var slotMock = {
        addService: function () { return slotMock; },
        clearCategoryExclusions: noop,
        clearTargeting: function () { return slotMock; },
        defineSizeMapping: function () { return slotMock; },
        get: noopNull,
        getAdUnitPath: function () { return ''; },
        getAttributeKeys: noopArray,
        getCategoryExclusions: noopArray,
        getDomId: function () { return ''; },
        getResponseInformation: noopNull,
        getSlotElementId: function () { return ''; },
        getSlotId: noopObj,
        getTargeting: noopArray,
        getTargetingKeys: noopArray,
        set: function () { return slotMock; },
        setCategoryExclusion: function () { return slotMock; },
        setClickUrl: function () { return slotMock; },
        setCollapseEmptyDiv: function () { return slotMock; },
        setTargeting: function () { return slotMock; },
        updateTargetingFromMap: function () { return slotMock; },
    };

    var pubadsMock = {
        addEventListener: function () { return pubadsMock; },
        clear: noop,
        clearCategoryExclusions: function () { return pubadsMock; },
        clearTargeting: function () { return pubadsMock; },
        collapseEmptyDivs: noop,
        disableInitialLoad: noop,
        display: noop,
        enableAsyncRendering: noop,
        enableLazyLoad: noop,
        enableSingleRequest: noop,
        enableVideoAds: noop,
        get: noopNull,
        getAttributeKeys: noopArray,
        getName: function () { return 'publisher_ads'; },
        getSlots: noopArray,
        getTargeting: noopArray,
        getTargetingKeys: noopArray,
        isInitialLoadDisabled: noopTrue,
        refresh: noop,
        removeEventListener: function () { return pubadsMock; },
        set: function () { return pubadsMock; },
        setCategoryExclusion: function () { return pubadsMock; },
        setCentering: noop,
        setForceSafeFrame: function () { return pubadsMock; },
        setLocation: function () { return pubadsMock; },
        setPrivacySettings: function () { return pubadsMock; },
        setPublisherProvidedId: function () { return pubadsMock; },
        setSafeFrameConfig: function () { return pubadsMock; },
        setTargeting: function () { return pubadsMock; },
        setVideoContent: function () { return pubadsMock; },
        updateCorrelator: noop,
    };

    var gt = window.googletag || {};
    var cmdQ = gt.cmd || [];

    gt.apiReady = true;
    gt.pubadsReady = true;
    gt.cmd = { push: function (fn) { try { fn(); } catch (e) { } }, length: 0 };
    gt.companionAds = function () { return { addEventListener: noop, enableSyncLoading: noop, setRefreshUnfilledSlots: noop }; };
    gt.content = function () { return { addEventListener: noop, setContent: noop }; };
    gt.defineSlot = function () { return slotMock; };
    gt.defineOutOfPageSlot = function () { return slotMock; };
    gt.destroySlots = noop;
    gt.disablePublisherConsole = noop;
    gt.display = noop;
    gt.enableServices = noop;
    gt.getVersion = function () { return ''; };
    gt.pubads = function () { return pubadsMock; };
    gt.setAdIframeTitle = noop;
    gt.sizeMapping = function () {
        return { addSize: function () { return this; }, build: noopArray };
    };

    window.googletag = gt;

    // Replay queued commands
    for (var i = 0; i < cmdQ.length; i++) {
        try { cmdQ[i](); } catch (e) { }
    }

})();