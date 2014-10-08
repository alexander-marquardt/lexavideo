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
    })

    // Directive that will control signalling between two users about the type of video that they wish to transmit.
    // (ie. HD Video or Ascii Video)
    .directive('lxVideoNegotiationDirective',
    function (
        $log,
        lxStreamService,
        lxVideoSettingsNegotiationService) {


        function watchLocalStream() {
            $log.debug('Executing watch on lxStreamService.localStream');
            return lxStreamService.localStream;
        }

        return {
            restrict: 'A',
            link: function(scope) {

                var watchListener = scope.$watch(watchLocalStream, function() {
                                        // if the user has not enabled their video, then they cannot transmit video. In the case of HD
                    // video we cannot establish a peer connection until video is enabled. We need to give feedback
                    // encouraging them to enable their video.
                    if (!lxStreamService.localStream) {
                        scope.videoSignalingObject.videoSignalingStatusForUserFeedback = 'mustEnableVideoToStartTransmission';
                    } else {
                        lxVideoSettingsNegotiationService.watchForVideoSettingsChanges (scope);
                        watchListener(); // removes the watcher
                    }
                })
            }
        }
    });