'use strict';



angular.module('lxUseChatRoom.directives', [])

    .directive('lxInitializeChannelAndTurnDirective',

    function(
        $log,
        channelService,
        channelServiceSupport,
        webRtcSessionService,
        lxUseChatRoomVarsService,
        userNotificationService,
        turnService
        ) {



        return {
            restrict: 'A',
            link: function (scope) {

                // Setup the channel and turn. If no exceptions are found returns true, otherwise false
                try {
                    userNotificationService.resetStatus();
                    channelService.openChannel(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject, scope.lxUseChatRoomOuterCtrl.channelToken);
                    turnService.maybeRequestTurn();

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

