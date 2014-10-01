'use strict';

angular.module('lxHttp.services', [])

    .factory('lxHttpHandleRoomService',
    function (
        $log,
        $resource
        ) {

        var handleRoomUrl = '/_lx/handle_room/';
        var RoomResource = $resource(handleRoomUrl + ':roomName', {roomName: '@roomName'});

        return {
            enterIntoRoom : function(roomObj) {
                // this will either create a room object on the server, or enter into an existing room corresponding
                // to roomName.
                return new RoomResource(roomObj).$save();
            },


            getRoom : function(roomName) {

                var roomObj = null;
                if (roomName) {
                    roomObj = RoomResource.get({roomName:roomName});
                    roomObj.$promise.then(function(data) {
                        $log.debug('getRoom function - returned object: ' + angular.toJson(data));

                    }, function() {
                        throw new Error('lxHandleRoomService.getRoom - server error');
                    });
                }
                return roomObj;
            }
        };
    })
    .factory('lxHttpChannelService',
    function (
        $log,
        $http) {

        return {
            manuallyDisconnectChannel: function(clientId) {
                // If we know that the user is disconnecting from the page, then we may want to send
                // a message to the server immediately, so that the room will be vacated instantly. This
                // is useful for cases where the user clicks on the reload button so that they are removed
                // from the room before the attempt to reload the page is made.

                $http.post('/_lx/channel/manual_disconnect/', 'from=' + clientId, {
                    // post as form data, not as the default json
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded;'}
                }).success(function(){
                    $log.info('Successfully send manual disconnect to server for clientId: ' + clientId);
                }).error(function(){
                    $log.warn('Failed to send manual disconnect to server for clientId: ' + clientId);
                });

            }
        };
    });

