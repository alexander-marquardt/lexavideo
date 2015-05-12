/**
 * Created by alexandermarquardt on 2014-09-27.
 */
'use strict';

angular.module('lxChatRoom.services', [])

    .factory('lxChatRoomMembersService',

    function(
        $log,
        $location,
        $routeParams,
        $window,
        $q,
        lxAppWideConstantsService,
        lxChannelService,
        lxHttpChannelService,
        lxHttpHandleRoomService,
        lxShowNumMessagesService,
        lxJs
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

        var createOrGetRoom = function(chatRoomNameAsWritten) {

            // For now, we pull the room name from the URL - this will likely change in future versions
            // of our code.
            var deferredUserSuccessfullyEnteredRoom = $q.defer();

            $log.log('addUserToRoom called: ' + chatRoomNameAsWritten + '. Adding userId: ' + lxAppWideConstantsService.userId);


            var roomObj = {};
            roomObj.chatRoomNameAsWritten = chatRoomNameAsWritten;

            // Pass userId when creating/entering into the room, because if this is the first user to
            // enter a given room name, then they will be stored as the "creator" of that room
            roomObj.userId = lxAppWideConstantsService.userId;

            lxHttpHandleRoomService.createOrGetRoomOnServer(roomObj).then(
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
                    // Failed to enter into the room. The 'response' returned from the reject is actually an object
                    // containing a field called 'data'.
                    failedToEnterRoom($log.error, roomObj.chatRoomNameAsWritten, response.data.statusString, deferredUserSuccessfullyEnteredRoom);
                }
            );

            return deferredUserSuccessfullyEnteredRoom.promise;
        };

        var addClientToRoomWhenChannelReady = function($scope, chatRoomId) {
            var innerWaitForChannelReady = function() {
                if (!$scope.channelObject.channelIsAlive) {
                    $timeout(innerWaitForChannelReady, 100);
                } else {
                    // Add the user to the room, now that the channel is open
                    lxHttpChannelService.addClientToRoom($scope.lxMainViewCtrl.clientId,
                        $scope.lxMainViewCtrl.userId, chatRoomId);
                }
            };
            innerWaitForChannelReady();
        };

        function setChatPanelDictAndChatRoomDisplay($scope, chatRoomId) {

            // since we are resetting the number of unseen messages for this chat panel, we need to subtract it
            // from the "global" unseenMessageCount before zeroing it.
            if (chatRoomId in $scope.chatPanelDict) {
                lxShowNumMessagesService.subtractNumMessagesSeen($scope.trackUnseenMessageCountObject,
                    $scope.chatPanelDict[chatRoomId]);
            }

            $scope.chatPanelDict[chatRoomId] = {
                chatPanelIsGlued: true,
                numMessagesSinceLastTimeBottomOfPanelWasViewed: 0,
                chatPanelIsCurrentlyVisible: true
            };

            $scope.chatRoomDisplayObject.chatPanelObject = $scope.chatPanelDict[chatRoomId];
            $scope.chatRoomDisplayObject.chatRoomId = chatRoomId;
        }


        var self = {

            removeClientFromRoomClientSide: function(scope, normalizedChatRoomName) {

                var chatRoomId = scope.roomOccupancyDict[normalizedChatRoomName].chatRoomId;
                delete scope.chatPanelDict[chatRoomId];
                delete scope.roomOccupancyDict[normalizedChatRoomName];

                // remove the room name from normalizedOpenRoomNamesList
                lxJs.removeItemFromList(normalizedChatRoomName, scope.normalizedOpenRoomNamesList);

                if (angular.equals({}, scope.roomOccupancyDict)) {
                    if (scope.videoStateInfoObject.numOpenVideoExchanges >= 1) {
                        $location.path('/:none:');
                    }
                    else {
                        $location.path('/');
                    }
                }
                else {
                    // If there are chat rooms available, then we open the one in the first position in
                    // normalizedOpenRoomNamesList, since it is used as a stack (see comment
                    // above normalizedOpenRoomNamesList for more info).
                    normalizedChatRoomName = scope.normalizedOpenRoomNamesList[0];
                    var chatRoomNameAsWritten = scope.roomOccupancyDict[normalizedChatRoomName].chatRoomNameAsWritten;
                    $location.path('/' + chatRoomNameAsWritten);
                }
            },

            clearChatRoomDisplayObject: function($scope) {
                $scope.chatRoomDisplayObject.chatPanelObject = null;
                $scope.chatRoomDisplayObject.chatRoomId = null;
            },

            handleChatRoomNameFromUrl: function($scope) {
                var chatRoomNameAsWritten = $routeParams.chatRoomName;
                if (chatRoomNameAsWritten !== ':none:') {
                    createOrGetRoom(chatRoomNameAsWritten).then(function (data) {
                        $scope.receivedChatMessageObject[data.chatRoomId] = {};

                        addClientToRoomWhenChannelReady($scope, data.chatRoomId);

                        setChatPanelDictAndChatRoomDisplay($scope, data.chatRoomId);

                        // Push the normalizedRoomName to to first location in normalizedOpenRoomNamesList.
                        lxJs.removeItemFromList(data.normalizedChatRoomName, $scope.normalizedOpenRoomNamesList);
                        $scope.normalizedOpenRoomNamesList.unshift(data.normalizedChatRoomName);

                    }, function (errorEnteringIntoRoomInfoObj) {
                        // The following sets an error on a global object that will be picked up by the javascript
                        // when the user is sent back to the main landing page, at which point the user will
                        // be shown a message indicating that there was an error, and another chance to go into
                        // a different room.
                        $scope.mainGlobalControllerObj.errorEnteringIntoRoomInfoObj = errorEnteringIntoRoomInfoObj;
                        $location.path('/');
                    });
                }
                else {
                    if ($scope.videoStateInfoObject.numOpenVideoExchanges >= 1) {
                        // We should only ever get to the ":none:" room if the user is still viewing video after closing
                        // all of their open chats. Therefore, set videoIsFocused to true.
                        $scope.chatboxPanelElementObject.videoIsFocused = true;
                        self.clearChatRoomDisplayObject($scope);
                    }
                    else {
                        // Otherwise, this use has attempted to directly enter into the ":none:" room, which is never allowed
                        // redirect them back to the landing page.
                        $location.path('/');
                    }
                }
            }
        };
        return self;
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
            createRemoteVideoElementsObject: function(remoteMiniVideoElem) {
                return {
                    remoteMiniVideoElem: remoteMiniVideoElem,
                    isAudioMuted: false
                };
            }
        };
    });




