'use strict';



angular.module('lxChatRoom.directives', [])

    .directive('lxInitializeChannelAndTurnDirective',

    function(
        $log,
        $window,
        lxChannelService,
        lxChannelSupportService,
        lxHttpChannelService,
        lxWebRtcSessionService,
        lxUseChatRoomVarsService,
        lxTurnService
        ) {



        return {
            restrict: 'A',
            link: function (scope) {

                // Setup the channel and turn. If no exceptions are found returns true, otherwise false
                try {
                    lxChannelService.openChannel(scope);
                    lxTurnService.maybeRequestTurn();

                    $window.onbeforeunload = function () {
                        $log.debug('Manually disconnecting channel on window unload event.');
                        lxHttpChannelService.manuallyDisconnectChannel(scope.lxChatRoomOuterCtrl.clientId);
                    };


                    return true;
                }
                catch (e) {
                    e.message = '\n\tError in lxInitializeChannelAndTurnDirective\n\t' + e.message;
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
        lxVideoSettingsNegotiationService) {


        return {
            restrict: 'A',
            link: function(scope) {
                lxVideoSettingsNegotiationService.watchForVideoSettingsChanges (scope);
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
