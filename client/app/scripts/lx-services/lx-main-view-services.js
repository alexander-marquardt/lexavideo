
'use strict';

/* global $ */

angular.module('lxMainView.services', [])

    .factory('lxMainViewService',

    function(
        lxAuthenticationHelper,
        lxChatRoomMembersService,
        lxVideoService) {

        return {

            // This function logs the user out of the system.
            // This requires
            // 1) closing all current video sessions,
            // 2) closing all currently open chat rooms,
            // 3) removing login/session tokens
            // 4) stopping the heartbeat to the server.
            // 5) close the channel.
            closeAllChatRoomsFn: function ($scope) {
                var clientId;
                var idx;
                for (idx=0; idx<$scope.videoStateInfoObject.currentOpenVideoSessionsList.length; idx++) {
                    clientId = $scope.videoStateInfoObject.currentOpenVideoSessionsList[idx];
                    lxVideoService.showVideoElementsAndStartVideoFn($scope, 'hangupVideoExchange', clientId);
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
            }
        }
    });