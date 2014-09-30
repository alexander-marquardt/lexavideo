'use strict';



angular.module('lxUseChatRoom.directives', [])

    .directive('lxInitializeChannelAndTurnDirective',

    function(
        $log,
        lxChannelService,
        lxChannelSupportService,
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
                    lxChannelService.openChannel(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject, scope.lxUseChatRoomOuterCtrl.channelToken);
                    lxTurnService.maybeRequestTurn();

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

