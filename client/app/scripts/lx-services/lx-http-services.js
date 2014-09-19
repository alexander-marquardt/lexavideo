'use strict';

/* global $ */

angular.module('lxHttp.services', [])



    .factory('lxHandleRoomService', function ($log, $resource) {


        var handleRoomUrl = '/_lx/handle_room/';
        var RoomResource = $resource(handleRoomUrl + ':roomName', {roomName: '@roomName'});

        return {
            createRoom : function(roomObj) {
                var roomResource = new RoomResource(roomObj).$save();

                roomResource.then(function(){
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
                        throw new Error('lxHandleRoomService.getRoom - failed to get response from server');
                    });
                }
                return roomObj;
            }
        };

    });

