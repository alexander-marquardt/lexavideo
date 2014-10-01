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
        lxUserNotificationService,
        lxTurnService
        ) {



        return {
            restrict: 'A',
            link: function (scope) {

                // Setup the channel and turn. If no exceptions are found returns true, otherwise false
                try {
                    lxUserNotificationService.resetStatus();
                    lxChannelService.openChannel(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject, scope.lxChatRoomOuterCtrl.channelToken);
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
    });

