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
        lxHttpHandleRoomService,
        lxAppWideConstantsService,
        lxAppWideVarsService,
        lxUseChatRoomConstantsService
        ) {

        var failedToEnterRoom = function(errorLogFn, roomName, statusString, deferredUserSuccessfullyEnteredRoom) {
            var errorMsg = 'User was not able to enter into the room ' +
                roomName + ' due to server status: ' + statusString;
            deferredUserSuccessfullyEnteredRoom.reject(errorMsg);
            errorLogFn(errorMsg);
        };

        return {

            addUserToRoomAndSetupChannel : function() {

                var deferredUserSuccessfullyEnteredRoom = $q.defer();

                $log.log('Initializing; room=' + lxUseChatRoomConstantsService.roomName + '.');


                var roomObj = {};
                roomObj.roomName = lxUseChatRoomConstantsService.roomName;
                roomObj.userId = lxAppWideConstantsService.userId;

                lxHttpHandleRoomService.enterIntoRoom(roomObj).then(
                    function(data){
                        if (data.statusString === 'roomCreated' || data.statusString === 'roomJoined') {
                            // everything OK
                            deferredUserSuccessfullyEnteredRoom.resolve(data);
                        }
                        else {
                            // something went wrong - redirect back to login with an appropriate errorString
                            failedToEnterRoom($log.warn, roomObj.roomName, data.statusString, deferredUserSuccessfullyEnteredRoom);
                        }
                    },
                    function(data) {
                        // Failed to enter into the room. The 'data' returned from the reject is actually an object
                        // containing another object called 'data'.
                        failedToEnterRoom($log.error, roomObj.roomName, data.data.statusString, deferredUserSuccessfullyEnteredRoom);
                    }
                );

                return deferredUserSuccessfullyEnteredRoom.promise;
            }
        };
    });
