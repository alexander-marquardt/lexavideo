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
    });

