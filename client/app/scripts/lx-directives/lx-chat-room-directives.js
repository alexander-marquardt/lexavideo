'use strict';



angular.module('lxChatRoom.directives', [])

    .directive('lxInitializeChannelDirective',

    function(
        $log,
        $window,
        lxChannelService,
        lxHttpChannelService
        ) {



        return {
            restrict: 'A',
            link: function (scope) {

//                // Setup the channel and turn. If no exceptions are found returns true, otherwise false
//                try {
//                    lxChannelService.openChannel(scope);
//
//                    $window.onbeforeunload = function () {
//                        $log.debug('Manually disconnecting channel on window unload event.');
//                        lxHttpChannelService.manuallyDisconnectChannel(scope.lxChatRoomCtrl.clientId);
//                    };
//
//
//                    return true;
//                }
//                catch (e) {
//                    e.message = '\n\tError in lxInitializeChannelDirective\n\t' + e.message;
//                    $log.error(e);
//                    return false;
//                }
            }
        };
    })

    .directive('lxInitializeTurnDirective',
    function(
        $log,
        lxTurnService
        ) {

        return {
            restrict: 'A',
            link: function() {
                try {
                    lxTurnService.maybeRequestTurn();
                }
                catch (e) {
                    e.message = '\n\tError in lxInitializeTurnDirective\n\t' + e.message;
                    $log.error(e);
                    return false;
                }
            }
        };
    })

    // Directive that will control signalling between two users about the type of video that they wish to transmit.
    // (ie. HD Video or Ascii Video)
    .directive('lxVideoNegotiationDirective',
    function (
        lxSelectAndNegotiateVideoTypeService) {


        return {
            restrict: 'A',
            link: function(scope) {
                lxSelectAndNegotiateVideoTypeService.watchForVideoSettingsChanges (scope);
            }
        };
    })


    .directive('lxAccessCameraAndMicrophoneDirective',
    function(
        lxAccessCameraAndMicrophoneService)
    {

        return {
            restrict: 'A',
            link: function(scope) {
                lxAccessCameraAndMicrophoneService.showModalsAndArrowsForGrantingCameraAndMicrophoneAccess(scope);
            }
        };
    });
