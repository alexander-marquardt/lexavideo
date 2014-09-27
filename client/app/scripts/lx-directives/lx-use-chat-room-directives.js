'use strict';


// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */

angular.module('lxUseChatRoom.directives', [])

    .directive('lxInitializeChannelAndTurnDirective',

    function(
        $log,
        channelService,
        turnService,
        webRtcSessionService,
        lxUseChatRoomVarsService
        ) {


        return {
            restrict: 'A',
            link: function (scope) {

                // Setup the channel and turn. If no exceptions are found returns true, otherwise false
                try {
                    userNotificationService.resetStatus();

                    channelService.openChannel(scope.localVideoObject, scope.remoteVideoObject, scope.videoSignalingObject, channelToken);
                    turnService.maybeRequestTurn();

                    // rtcInitiator is the 2nd person to join the chatroom, not the creator of the chatroom
                    webRtcSessionService.signalingReady = lxUseChatRoomVarsService.rtcInitiator;
                    return true;
                }
                catch (e) {
                    e.message = '\n\tError in setupChannelAndTurn\n\t' + e.message;
                    $log.error(e);
                    return false;
                }
            }
        }
    });

