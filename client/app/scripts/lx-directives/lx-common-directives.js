/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';

// define externally defined variables so that jshint doesn't give warnings


var checkCompatibilityDirectives = angular.module('lxCheckCompatibility.directives', []);


checkCompatibilityDirectives.directive('lxCheckIfSystemSupportsWebRtcDirective',
    function(lxCheckIfSystemSupportsWebRtcService){

    return {
        restrict: 'A',
        scope: {}, // restrict scope so that we don't pollute other scopes
        link: function(scope) {
            lxCheckIfSystemSupportsWebRtcService.checkBrowserVersionToSeeIfGetUserMediaSupported(scope);
        }
    };
});