/**
 * Created by alexandermarquardt on 2014-09-27.
 */
'use strict';

/* global $ */

angular.module('lxChatRoom.services', [])

    .factory('lxChatRoomMembersService',

    function(
        $log,
        $location,
        $routeParams,
        $timeout,
        $window,
        $q,
        lxAppWideConstantsService,
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

        var createOrGetRoom = function(chatRoomNameAsWritten, userId) {

            // For now, we pull the room name from the URL - this will likely change in future versions
            // of our code.
            var deferredUserSuccessfullyEnteredRoom = $q.defer();

            lxJs.assert(userId, 'userId is not set');
            $log.log('addUserToRoom called: ' + chatRoomNameAsWritten + '. Adding userId: ' + userId);


            var roomObj = {};
            roomObj.chatRoomNameAsWritten = chatRoomNameAsWritten;

            // Pass userId when creating/entering into the room, because if this is the first user to
            // enter a given room name, then they will be stored as the "creator" of that room
            roomObj.userId = userId;

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
                    lxJs.assert($scope.lxMainCtrlDataObj.clientId, 'clientId must be set before adding user to a room');
                    lxHttpChannelService.addClientToRoom($scope.lxMainCtrlDataObj.clientId,
                        $scope.lxMainCtrlDataObj.userId, chatRoomId);
                }
            };
            innerWaitForChannelReady();
        };

        function setChatPanelDictAndChatRoomDisplay($scope, chatRoomId, chatRoomNameNormalized) {

            // since we are resetting the number of unseen messages for this chat panel, we need to subtract it
            // from the "global" unseenMessageCount before zeroing it.
            if (chatRoomId in $scope.chatPanelDict) {
                lxShowNumMessagesService.subtractNumMessagesSeen($scope.trackUnseenMessageCountObject,
                    $scope.chatPanelDict[chatRoomId]);
            }

            $scope.chatPanelDict[chatRoomId] = {
                chatPanelIsGlued: true,
                numMessagesSinceLastTimeBottomOfPanelWasViewed: 0,
                chatRoomNameNormalized: chatRoomNameNormalized
            };

            $scope.chatRoomDisplayObject.chatPanelObject = $scope.chatPanelDict[chatRoomId];
            $scope.chatRoomDisplayObject.chatRoomId = chatRoomId;
        }


        var self = {

            removeClientFromRoomClientSide: function(scope, chatRoomNameNormalized) {

                var chatRoomId = scope.roomOccupancyDict[chatRoomNameNormalized].chatRoomId;
                delete scope.chatPanelDict[chatRoomId];
                delete scope.roomOccupancyDict[chatRoomNameNormalized];

                // remove the room name from normalizedOpenRoomNamesList
                lxJs.removeItemFromList(chatRoomNameNormalized, scope.normalizedOpenRoomNamesList);

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
                    chatRoomNameNormalized = scope.normalizedOpenRoomNamesList[0];
                    var chatRoomNameAsWritten = scope.roomOccupancyDict[chatRoomNameNormalized].chatRoomNameAsWritten;
                    $location.path('/' + chatRoomNameAsWritten);
                }
            },

            clearChatRoomDisplayObject: function($scope) {
                $scope.chatRoomDisplayObject.chatPanelObject = null;
                $scope.chatRoomDisplayObject.chatRoomId = null;
            },


            /* handleChatRoomIdFromServerUpdate makes sure that the client has the same chat panels open as
               the server thinks that the client has open. If the client doesn't have a chat panel open and
               receives an update from the server that indicates that the server thinks that the client has
               a given chat panel open, then that chat panel will be added to the list of open chat panels for
               the client. This will only be added if it is not already in the chatPanelDict.
               Note that we don't switch the view to the panel that is opened because this is all happening in the
               background based on server to client communications received over the channel.
             */
            handleChatRoomIdFromServerUpdate: function(scope, chatRoomId, chatRoomNameNormalized) {

                // Only add and initialize the chatRoomId to chatPanelDict if it is not already there.
                if (!(chatRoomId in scope.chatPanelDict)) {
                    scope.chatPanelDict[chatRoomId] = {
                        chatPanelIsGlued: true,
                        numMessagesSinceLastTimeBottomOfPanelWasViewed: 0,
                        chatRoomNameNormalized: chatRoomNameNormalized
                    };

                    // This "if" is probably not totally necessary, but doesn't cost much and guarantees that
                    // we don't add the same room twice.
                    if ($.inArray(chatRoomNameNormalized, scope.normalizedOpenRoomNamesList) === -1) {

                        // Push the chat room to the end of this list because we don't necessarily receive
                        // them in any particular oder from the server.
                        scope.normalizedOpenRoomNamesList.push(chatRoomNameNormalized);
                    }

                    if ($.inArray(chatRoomId, scope.receivedChatMessageObject) === -1) {
                        scope.receivedChatMessageObject[chatRoomId] = {};
                    }
                }
            },

            stackChatRoomNameOnNormalizedOpenRoomNamesList: function(chatRoomNameNormalized, normalizedOpenRoomNamesList) {
                // Push the normalizedRoomName to to first location in normalizedOpenRoomNamesList.
                lxJs.removeItemFromList(chatRoomNameNormalized, normalizedOpenRoomNamesList);
                normalizedOpenRoomNamesList.unshift(chatRoomNameNormalized);
            },

            handleChatRoomName: function($scope, chatRoomNameAsWritten) {
                if (chatRoomNameAsWritten !== ':none:') {

                    lxJs.assert($scope.lxMainCtrlDataObj.userId, 'userId must be set before creating or getting room');
                    lxJs.assert($scope.lxMainCtrlDataObj.clientId, 'clientId must be set before creating or getting room');

                    createOrGetRoom(chatRoomNameAsWritten, $scope.lxMainCtrlDataObj.userId).then(function (data) {
                        $scope.receivedChatMessageObject[data.chatRoomId] = {};
                        addClientToRoomWhenChannelReady($scope, data.chatRoomId);
                        setChatPanelDictAndChatRoomDisplay($scope, data.chatRoomId, data.chatRoomNameNormalized);
                        self.stackChatRoomNameOnNormalizedOpenRoomNamesList(data.chatRoomNameNormalized, $scope.normalizedOpenRoomNamesList);

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




