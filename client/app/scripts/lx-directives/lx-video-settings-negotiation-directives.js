/**
 * Created by alexandermarquardt on 2014-09-03.
 */

'use strict';

var lxSelectVideoTypePreferenceDirectives = angular.module('lxVideoNegotiation.directives', []);


var  showMessageInVideoWindow = function(scope, elem, message, $compile) {
    elem.removeClass('ng-hide');
    elem.html('');
    var el = angular.element('<p class="cl-video-overlay-text"/>');
    el.html(message);
    var compiledEl = $compile(el)(scope);
    elem.append(compiledEl);
};

var removeMessageInVideoWindow = function(scope, elem) {
    elem.addClass('ng-hide');
};


lxSelectVideoTypePreferenceDirectives.directive('lxDisplayRemoteVideoStatus',
    function(
        $compile,
        $log
    ) {

    return {
        restrict: 'A',
        template: '<div class="cl-video-overlay cl-show-hide-fade ng-hide" ></nav>',
        link : function(scope, elem) {
            var message;
            var overlayElem = angular.element(elem).find('div.cl-video-overlay');

            scope.$watch('videoExchangeObject.remoteVideoEnabledSetting', function(remoteVideoSetting) {

                switch(remoteVideoSetting) {
                    case 'waitingForEnableVideoExchangePermission':
                        message = 'We are waiting for the remote user to agree to exchange video';
                        showMessageInVideoWindow(scope, overlayElem, message, $compile);
                        break;

                    case 'doNotEnableVideoExchange':
                        message = 'Remote user has denied your request to exchange video';
                        showMessageInVideoWindow(scope, overlayElem, message, $compile);
                        break;

                    case 'enableVideoExchange':
                        message = 'Attempting to establish video connection';
                        showMessageInVideoWindow(scope, overlayElem, message, $compile);
                        break;

                    $log.debug(message);
                }
            });
        }
    };
});

lxSelectVideoTypePreferenceDirectives.directive('lxDisplayLocalVideoStatus',
    function(
        lxStreamService,
        $compile
    ) {

    return {
        restrict: 'A',
        template: '<div class="cl-video-overlay cl-show-hide-fade ng-hide" ></nav>',
        link: function (scope, elem) {
            var message;
            var overlayElem = angular.element(elem).find('div.cl-video-overlay');

            var watchLocalStream = function() {
                return !!lxStreamService.localStream
            };

            scope.$watch(watchLocalStream, function(localStream) {
                if (!localStream) {
                    message = '<a href="" ng-click="showCameraAndMicrophoneInstructions()">' +
                        'Click here</a> to to activate video. ';
                    showMessageInVideoWindow(scope, overlayElem, message, $compile);
                } else {
                    removeMessageInVideoWindow(scope, elem);
                }
            });
        }
    }
});
