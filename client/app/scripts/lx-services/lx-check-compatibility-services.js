/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';
/* global $ */

var lxCheckCompatibility = angular.module('lxCheckCompatibility.services', []);

function checkIfBrowserVersionIsSupported () {

    /* Supported browsers and OSes
     ***********************************
     * Information from general internet search:
     * Firefox: windows, mac, linux, android : Since version 24. Current version is 31 (all platforms).
     * Chrome: desktop: 23, android: 28. Current version: 36 (all platforms)
     * Opera: Android 20
     ***********************************
     * Information from caniuse.com -- this seems to be too conservative.
     * Firefox: 30
     * Chrome desktop: 27
     * Chrome Android: 36
     * Opera (not mini): 23 - is incorrect - have installed 22 on android and it has webRTC (23 not available on android yet)
     ************************************
     * We use the information from the general internet search as a minimum version number, but if possible we select the
     * current version minus a few revisions so that users are not forced to upgrade just to use webRtc
     */


    var mozillaRequiredVersion = 28; // firefox
    var chromeRequiredVersion = 30;
    var operaRequiredVersion = 20;

    if ($.browser.mozilla && $.browser.version <  mozillaRequiredVersion ||
        $.browser.chrome && $.browser.version < chromeRequiredVersion ||
        $.browser.opera && $.browser.version < operaRequiredVersion) {
        // The users browser is out of date and needs to be updated before they can access the website.
        return false;
    } else {
        return true;
    }

}

lxCheckCompatibility.factory('lxCheckCompatibilityService', function () {
    // Provides flags that are used for checking if the current device/browser is supported.

    return {
        isIosDevice : $.browser.ipad || $.browser.iphone,
        supportedBrowser : $.browser.mozilla || $.browser.chrome || $.browser.opera,
        browserVersionIsSupported : checkIfBrowserVersionIsSupported()
    };
});