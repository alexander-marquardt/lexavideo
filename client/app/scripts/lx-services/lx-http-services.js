'use strict';

angular.module('lxHttp.services', [])

    .factory('lxHttpHandleRoomService',
    function ($log,
              $resource,
              $location,
              lxAppWideVarsService) {

        var handleRoomUrl = '/_lx/handle_room/';
        var RoomResource = $resource(handleRoomUrl + ':roomName', {roomName: '@roomName'});

        var self = {
            enterIntoRoom : function(roomObj) {
                // this will either create a room object on the server, or enter into an existing room corresponding
                // to roomName.
                return new RoomResource(roomObj).$save();
            },

            enterIntoRoomFromLandingPage : function(roomObj, roomStatus) {

                var promise = self.enterIntoRoom(roomObj, roomStatus);
                promise.then(function(data){

                    // Redirect the user to the room that they have just created/entered into.
                    if (data.statusString === 'roomCreated' || data.statusString === 'roomJoined') {
                        lxAppWideVarsService.userIsAlreadyInARoom = true;
                        $location.path('/' + roomObj.roomName);
                    } else {
                        // Room was not created - give user an indication that they need to try a different
                        // room name. By toggling triggerGetNewRoom we will cause a new getRoom to
                        // execute inside checkForRoomOccupancyDirective.
                        roomStatus.triggerGetNewRoom = !roomStatus.triggerGetNewRoom;
                    }
                }, function() {
                    roomStatus.triggerGetNewRoom = !roomStatus.triggerGetNewRoom;
                    e.message = '\n\tFailed to create or enter into room: ' + roomObj.roomName + '\n\t' + e.message;
                    $log.error(e);
                });
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
        return self;

    });

