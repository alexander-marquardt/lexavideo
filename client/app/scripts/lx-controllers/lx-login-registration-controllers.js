/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings

angular.module('lxLoginRegistration.controllers', ['ngResource'])
    .controller('lxLoginRegistrationCtrl', function ($scope, $resource) {

        var handleRoomUrl = '/_lx/handle_room/';
        var RoomResource = $resource(handleRoomUrl + ':roomName', {roomName: '@roomName'});
        $scope.createRoom = function(roomObj) {
            new RoomResource(roomObj).$save().then(function(){

            }, function() {

            });
        };
    });
