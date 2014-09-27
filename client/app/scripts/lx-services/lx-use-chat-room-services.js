/**
 * Created by alexandermarquardt on 2014-09-27.
 */
'use strict';

angular.module('lxUseChatRoom.services', [])

    .factory('lxInitializeRoomService',

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

        var userId = lxAppWideConstantsService.userId;

        function setupChannelAndTurn() {
            // Setup the channel and turn. If no exceptions are found returns true, otherwise false
            try {
                userNotificationService.resetStatus();

                channelService.openChannel(localVideoObject, remoteVideoObject, videoSignalingObject, channelToken);
                turnService.maybeRequestTurn();

                // rtcInitiator is the 2nd person to join the chatroom, not the creator of the chatroom
                webRtcSessionService.signalingReady = lxUseChatRoomVarsService.rtcInitiator;
                return true;
            }
            catch(e) {
                e.message = '\n\tError in setupChannelAndTurn\n\t' + e.message;
                $log.error(e);
                return false;
            }
        }

        return {

            addUserToRoomAndSetupChannel : function() {

                // userJoinedRoom will be returned as the result of this function, and indicates if the
                // user was able to join the room and if everything was setup correctly. If not, then
                // the user will be directed back to the landing page so that they can join a new room.
                var userSuccessfullyEnteredRoom = false;

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
                                userSuccessfullyEnteredRoom = setupChannelAndTurn();
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
                else {
                    /* The user is already in a chat room, but we still ned to setup the channel and turn etc. */
                    userSuccessfullyEnteredRoom = setupChannelAndTurn();
                }
                if (!userSuccessfullyEnteredRoom) {
                    $log.warn('User was not able to enter room: ' + lxUseChatRoomConstantsService.roomName)
                }
                return userSuccessfullyEnteredRoom;
            }
        }
    });
