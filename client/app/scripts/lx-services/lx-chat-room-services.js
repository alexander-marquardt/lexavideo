/**
 * Created by alexandermarquardt on 2014-09-27.
 */
'use strict';

angular.module('lxChatRoom.services', [])

    .factory('lxInitializeRoomService',

    function(
        $log,
        $location,
        $routeParams,
        $window,
        $q,
        lxChannelService,
        lxHttpChannelService,
        lxHttpHandleRoomService,
        lxAppWideConstantsService
        ) {

        var failedToEnterRoom = function(errorLogFn, chatRoomName, statusString, deferredUserSuccessfullyEnteredRoom) {
            var errorObject = {
                statusString: statusString,
                pageNameThatCausedError: chatRoomName,
                pageUrlThatCausedError: $location.path()
            };

            deferredUserSuccessfullyEnteredRoom.reject(errorObject);
            errorLogFn(errorObject);
        };

        return {

            addUserToRoom : function() {

                // For now, we pull the room name from the URL - this will likely change in future versions
                // of our code.
                var chatRoomNameAsWritten = $routeParams.chatRoomName;
                var deferredUserSuccessfullyEnteredRoom = $q.defer();

                $log.log('addUserToRoom called: ' + chatRoomNameAsWritten + '. Adding userId: ' + lxAppWideConstantsService.userId);


                var roomObj = {};
                roomObj.chatRoomNameAsWritten = chatRoomNameAsWritten;

                // Pass userId when creating/entering into the room, because if this is the first user to
                // enter a given room name, then they will be stored as the "creator" of that room
                roomObj.userId = lxAppWideConstantsService.userId;

                lxHttpHandleRoomService.enterIntoRoom(roomObj).then(
                    function(response){
                        if (response.data.statusString === 'roomJoined') {
                            // everything OK
                            deferredUserSuccessfullyEnteredRoom.resolve(response.data);
                        }
                        else {
                            // something went wrong - redirect back to login with an appropriate errorString
                            failedToEnterRoom($log.warn, roomObj.chatRoomNameAsWritten, response.data.statusString, deferredUserSuccessfullyEnteredRoom);
                        }
                    },
                    function(response) {
                        // Failed to enter into the room. The 'data' returned from the reject is actually an object
                        // containing another object called 'data'.
                        failedToEnterRoom($log.error, roomObj.chatRoomNameAsWritten, response.data.statusString, deferredUserSuccessfullyEnteredRoom);
                    }
                );

                return deferredUserSuccessfullyEnteredRoom.promise;
            }
        };
    })

    /*
    The following factory creates an object that corresponds to the video-settings exchange between
    two clients.
     */
    .factory('lxCreateChatRoomObjectsService',
    function() {

        return {
            createVideoExchangeSettingsObject: function () {
                // Note: the following values are "requests" for camera access, because they only enable the display
                // of the video elements and show the access prompt that the user must click on before actual camera
                // "access" is given. After this, there is a get user media request from the browser
                // that the user will have to accept in order to access their camera and microphone (if we have
                // enabled ssh, then the get user media request result should be remembered for future sessions)
                return {
                    localVideoEnabledSetting: 'waitingForPermissionToEnableVideoExchange',
                    remoteVideoEnabledSetting: 'waitingForPermissionToEnableVideoExchange',
                    rtcInitiator: false
                };
            },
            createRemoteVideoElementsObject: function(remoteHdVideoElem) {
                return {
                    remoteHdVideoElem: remoteHdVideoElem,
                    isAudioMuted: false
                };
            }
        };
    });




