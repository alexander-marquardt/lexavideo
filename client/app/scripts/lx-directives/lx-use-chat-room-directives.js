'use strict';


// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global viewportSize */

angular.module('lxUseChatRoom.directives', [])


    .directive('lxAddUserToRoomAndSetupChannelDirective',
    function(
        $log,
        $location,
        $window,
        channelService,
        lxHttpHandleRoomService,
        lxAppWideConstantsService,
        lxAppWideVarsService,
        lxUseChatRoomConstantsService,
        messageService,
        userNotificationService
        ) {

        return {
            restrict: 'A',
            link: function (scope) {

                var userId = lxAppWideConstantsService.userId;

                // Send BYE on refreshing(or leaving) a demo page
                // to ensure the room is cleaned for next session.
                $window.onbeforeunload = function () {
                    messageService.sendMessage('sdp', {type: 'bye'});
                };


                $log.log('Initializing; room=' + lxUseChatRoomConstantsService.roomName + '.');

                if (!lxAppWideVarsService.userIsAlreadyInARoom) {
                    var roomObj = {};
                    roomObj.roomName = lxUseChatRoomConstantsService.roomName;
                    roomObj.userId = lxAppWideConstantsService.userId;

                    var promise = lxHttpHandleRoomService.enterIntoRoom(roomObj);
                    promise.then(
                        function(data){
                            if (data.statusString === 'roomCreated' || data.statusString === 'roomJoined') {
                                // everything OK - we can now set up the channel and turn

                                userNotificationService.resetStatus();
                                // NOTE: AppRTCClient.java searches & parses this line; update there when
                                // changing here.

                                // TODO - This is where we need to add this user to the room and setup the channelToken and turnUrl.

                                channelService.openChannel(localVideoObject, remoteVideoObject, videoSignalingObject, channelToken);
                                turnService.maybeRequestTurn();

                                // rtcInitiator is the 2nd person to join the chatroom, not the creator of the chatroom
                                webRtcSessionService.signalingReady = lxUseChatRoomVarsService.rtcInitiator;

                            }
                            else {
                                // something went wrong - redirect back to login with an appropriate errorString
                                $log.warn('User cannot enter the room. Status is: ' + data.statusString);
                                $location.path('/error/' + roomObj.roomName + '/' + data.statusString);
                            }
                        },
                        function(data) {
                            $log.error('Failed to directly use the URL roomName to create or enter into room: ' +
                                roomObj.roomName + ' statusString: ' + data.statusString);
                            $location.path('/error/' + roomObj.roomName + '/' + data.statusString);
                        }
                    );
                }
            }
        }
    });

