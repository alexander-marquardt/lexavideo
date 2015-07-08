
'use strict';

/* global $ */

angular.module('lxMainView.services', [])

    .factory('lxMainViewService',

    function(
        $location,
        $log,
        $routeParams,
        lxAuthenticationHelper,
        lxChatRoomMembersService,
        lxChannelService,
        lxHttpChannelService,
        lxTurnService,
        lxVideoService) {

        var self = {

            // This function logs the user out of the system.
            // This requires
            // 1) closing all current video sessions,
            // 2) closing all currently open chat rooms,
            // 3) removing login/session tokens
            // 4) stopping the heartbeat to the server.
            // 5) close the channel.
            closeAllChatRoomsFn: function ($scope) {
                var clientId, remoteClientId;
                var idx;

                clientId = $scope.lxMainCtrlDataObj.clientId;
                lxChannelService.stopSendingHeartbeat();
                lxHttpChannelService.manuallyDisconnectChannel(clientId, $scope.channelObject);

                for (idx=0; idx<$scope.videoStateInfoObject.currentOpenVideoSessionsList.length; idx++) {
                    remoteClientId = $scope.videoStateInfoObject.currentOpenVideoSessionsList[idx];
                    lxVideoService.showVideoElementsAndStartVideoFn($scope, 'hangupVideoExchange',
                        $scope.lxMainCtrlDataObj.clientId , remoteClientId);
                }

                // loop over the list of room names in reverse, because we are eliminating each element
                // in the list with each iteration of the loop.
                var numRemoved = 0;
                var listLength = $scope.normalizedOpenRoomNamesList.length;
                for (idx=listLength-1; idx>=0; idx --){
                    var normalizedChatRoomName = $scope.normalizedOpenRoomNamesList[idx];
                    lxChatRoomMembersService.removeClientFromRoom($scope, normalizedChatRoomName)
                        .then()['finally'](
                        function () {
                            numRemoved++;
                            if (numRemoved == listLength) {
                                lxAuthenticationHelper.lxRemoveTokenAndSession();
                            }
                        }
                    );
                }

                // In order to prevent the username modal from immediately showing, we wait until
                // the route has changed before clearing the clientId and userId.
                var unbindRouteChange = $scope.$on('$routeChangeSuccess', function() {
                    $scope.lxMainCtrlDataObj.clientId = null;
                    $scope.lxMainCtrlDataObj.userId = null;

                    // re-start the userId and clientId watchers in case the user wishes to login again, without having
                    // to re-load the page.
                    self.watchUserIdThenGetClientId($scope);
                    self.watchClientIdThenInitializeChannel($scope);

                    // Remove this route change event handler.
                    unbindRouteChange();
                });


                $location.path('/');
            },
            // We must wait for the userId to be set before we can create a clientId. If the userId is not set,
            // then a popup will be triggered by the lxMakeSureUserIsLoggedIn directive, which checks the userId
            // when a chat room page is loaded and forces a login if it isn't set.
            watchUserIdThenGetClientId: function($scope) {
                var watchUserId = $scope.$watch(
                    function () {
                        return $scope.lxMainCtrlDataObj.userId;
                    },
                    function (userId) {
                        if (userId) {

                            if (!$scope.lxMainCtrlDataObj.clientId) {
                                lxAuthenticationHelper.lxCallGetAndStoreClientId($scope, userId).then(
                                    function() {
                                        // Kill this watcher once we have gotten the clientId
                                        watchUserId();
                                    }
                                );
                            }
                        }
                    }
                )
            },

            // If clientId is set, then we can initialize the channel
            watchClientIdThenInitializeChannel: function($scope) {
                var watchClientIdBeforeInitializeChannel = $scope.$watch(
                    function () {
                        return $scope.lxMainCtrlDataObj.clientId;
                    },
                    function (clientId, previousClientId) {
                        if (clientId) {
                            $log.info('Calling lxChannelService.initializeChannel due to change in clientId from ' +
                                previousClientId + ' to ' + clientId);
                            lxChannelService.initializeChannel($scope);

                            // Since the previous clientId is no longer valid, we need to update the server to
                            // ensure that the new clientId is placed into all of the rooms that the client
                            // browser believes that he currently has open.
                            // This will only be a single room when the client first logs onto the website, but
                            // if a new clientId is allocated after the user already has a window open, then
                            // all the rooms that they are in should be opened on the server as they are already
                            // open in the client's data structures.
                            // We loop over this list in reverse, so that the last room open will be in position 0
                            // which will display that room as the currently viewed room.
                            if (angular.equals({}, $scope.roomOccupancyDict) && $routeParams.chatRoomName) {
                                // roomOccupancyDict isn't yet set up, so we pull the chatRoomName directly from the URL.
                                lxChatRoomMembersService.handleChatRoomName($scope, $routeParams.chatRoomName);
                            }
                            else {
                                for (var i = $scope.normalizedOpenRoomNamesList.length - 1; i >= 0; i--) {
                                    var chatRoomNameAsWritten = $scope.roomOccupancyDict[$scope.normalizedOpenRoomNamesList[i]].chatRoomNameAsWritten;
                                    lxChatRoomMembersService.handleChatRoomName($scope, chatRoomNameAsWritten);
                                }
                            }

                            // Kill this watch once we have initialized the channel
                            watchClientIdBeforeInitializeChannel();
                        }
                    }
                );
            }
        };
        return self;
    }
);