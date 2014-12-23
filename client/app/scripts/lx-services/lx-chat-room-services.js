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

            addUserToRoomAndSetupChannel : function() {

                var deferredUserSuccessfullyEnteredRoom = $q.defer();

                $log.log('Initializing; room=' + lxUseChatRoomConstantsService.chatRoomName + '.');


                var roomObj = {};
                roomObj.chatRoomName = lxUseChatRoomConstantsService.chatRoomName;
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
    });
