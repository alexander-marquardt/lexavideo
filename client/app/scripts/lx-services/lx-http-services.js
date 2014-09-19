'use strict';

angular.module('lxHttp.services', [])

    .factory('lxHttpHandleRoomService', function ($log, $resource) {

        var handleRoomUrl = '/_lx/handle_room/';
        var RoomResource = $resource(handleRoomUrl + ':roomName', {roomName: '@roomName'});

        return {
            createRoom : function(roomObj) {
                var roomResource = new RoomResource(roomObj).$save();

                roomResource.then(function(data){

                }, function() {
                    $log.warn('Failed to create room ' + roomObj.roomName);
                });

                return roomResource;
            },

            getRoom : function(roomName) {

                var roomObj = null;
                if (roomName) {
                    roomObj = RoomResource.get({roomName:roomName});
                    roomObj.$promise.then(function(data) {
                        $log.debug('Got object: ' + data);

                    }, function() {
                        throw new Error('lxHandleRoomService.getRoom - server error');
                    });
                }
                return roomObj;
            }
        };

    });

