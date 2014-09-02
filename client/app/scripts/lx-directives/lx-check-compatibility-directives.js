/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';

// define externally defined variables so that jshint doesn't give warnings


var checkCompatibilityDirectives = angular.module('lxCheckCompatibility.directives', []);


checkCompatibilityDirectives.directive('lxCheckIfBrowserIsSupported', function($templateCache, $modal, $log, lxCheckCompatibilityService, lxModalSupportService){


    var checkBrowserVersionToSeeIfGetUserMediaSupported = function() {


        if (lxCheckCompatibilityService.isIosDevice) {
            lxModalSupportService.showStandardModalWindow('lx-template-cache/ios-is-not-supported-modal.html');
        }
        else if (!lxCheckCompatibilityService.isSupportedBrowser) {
            lxModalSupportService.showStandardModalWindow('lx-template-cache/browser-is-not-supported-modal.html');
        }
        else if (!lxCheckCompatibilityService.browserVersionIsSupported) {
            lxModalSupportService.showStandardModalWindow('lx-template-cache/browser-version-is-not-supported-modal.html');
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