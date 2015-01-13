/**
 * Created by alexandermarquardt on 2014-09-27.
 */
'use strict';

angular.module('lxChatRoom.services', [])

    .factory('lxInitializeRoomService',

    function(
        $log,
        $location,
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

            addUserToRoom : function(scope) {

                var deferredUserSuccessfullyEnteredRoom = $q.defer();

                $log.log('Initializing; room=' + scope.roomOccupancyObject.chatRoomName + '.');


                var roomObj = {};
                roomObj.chatRoomName = scope.roomOccupancyObject.chatRoomName;

                // Pass userId when creating/entering into the room, because if this is the first user to
                // enter a given room name, then they will be stored as the "creator" of that room
                roomObj.userId = lxAppWideConstantsService.userId;

                lxHttpHandleRoomService.enterIntoRoom(roomObj).then(
                    function(data){
                        if (data.statusString === 'roomJoined') {
                            // everything OK
                            deferredUserSuccessfullyEnteredRoom.resolve(data);
                        }
                        else {
                            // something went wrong - redirect back to login with an appropriate errorString
                            failedToEnterRoom($log.warn, roomObj.chatRoomName, data.statusString, deferredUserSuccessfullyEnteredRoom);
                        }
                    },
                    function(data) {
                        // Failed to enter into the room. The 'data' returned from the reject is actually an object
                        // containing another object called 'data'.
                        failedToEnterRoom($log.error, roomObj.chatRoomName, data.data.statusString, deferredUserSuccessfullyEnteredRoom);
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
        function VideoExchangeSettingsObject() {
            // Note: the following values are "requests" for camera access, because they only enable the display
            // of the video elements and show the access prompt that the user must click on before actual camera
            // "access" is given. After this, there is a get user media request from the browser
            // that the user will have to accept in order to access their camera and microphone (if we have
            // enabled ssh, then the get user media request result should be remembered for future sessions)

            // localVideoEnabledSetting and remoteVideoEnabledSetting can be the following values:
            //    'waitingForEnableVideoExchangePermission': user has not made any request for a video exchange
            //    'enableVideoExchange': user has activated video elements
            //    'doNotEnableVideoExchange': user has denied activation of video elements
            this.localVideoEnabledSetting = 'waitingForEnableVideoExchangePermission';
            this.remoteVideoEnabledSetting = 'waitingForEnableVideoExchangePermission';
        }


        function RemoteVideoObject(remoteHdVideoElem) {
            this.remoteHdVideoElem = remoteHdVideoElem;
            this.isAudioMuted = true;
        }

        return {
            createVideoExchangeSettingsObject: function () {
                return new VideoExchangeSettingsObject();
            },
            createRemoteVideoObject: function(remoteHdVideoElem) {
                return new RemoteVideoObject(remoteHdVideoElem);
            }
        };


    });




