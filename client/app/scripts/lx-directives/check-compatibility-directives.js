/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */

var UNSUPPORTED_DEVICES = $.browser.ipad || $.browser.iphone;
var SUPPORTED_BROWSERS = $.browser.mozilla || $.browser.chrome || $.browser.opera;

var checkCompatibilityDirectives = angular.module('checkCompatibility.directives', []);

var ModalInstanceCtrl = function($scope, $log, $modalInstance) {
    $scope.ok = function () {
        $modalInstance.close();
    };
};

function showModalWindow($modal, $log, templateUrl) {
    var modalInstance = $modal.open({
        templateUrl: templateUrl,
        controller: ModalInstanceCtrl
    });

    modalInstance.result.finally(function () {
        $log.log('Closed browser-is-not-supported modal box');
    });
}

checkCompatibilityDirectives.directive('lxCheckIfBrowserIsSupported', function($templateCache, $modal, $log){


    var checkBrowserVersionToSeeIfGetUserMediaSupported = function() {

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

        //var mozillaRequiredVersion = 28; // firefox
        //var chromeRequiredVersion = 30;
        //var operaRequiredVersion = 20;


        if (true || UNSUPPORTED_DEVICES) {
            showModalWindow($modal, $log, 'lx-template-cache/ios-is-not-supported-modal.html');
        }
        else if (true || !(SUPPORTED_BROWSERS)) {
            showModalWindow($modal, $log, 'lx-template-cache/browser-is-not-supported-modal.html');
        }
    };

    return {
        restrict: 'A',
        scope: {}, // restrict scope so that we don't pollute other scopes
        link: function(scope) {
            checkBrowserVersionToSeeIfGetUserMediaSupported(scope);
        }
    };
});