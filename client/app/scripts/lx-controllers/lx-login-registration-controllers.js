/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings

angular.module('lxLoginRegistration.controllers', ['ngResource'])
    .controller('lxLoginRegistrationCtrl', function ($log, $scope, $resource) {

        var handleRoomUrl = '/_lx/handle_room/';
        var RoomResource = $resource(handleRoomUrl + ':roomName', {roomName: '@roomName'});

        $scope.minInputLength = 3;
        $scope.maxInputLength = 25;

        $scope.createRoom = function(roomObj) {
            new RoomResource(roomObj).$save().then(function(){

            }, function() {
                $log.warn('Failed to create room ' + roomObj.roomName);
            });
        };

        $scope.showFormScope = function() {
            $log.debug($scope);
        };


        $scope.highlightInput = function(inputElement) {

            var cssClass;
            if (inputElement.$invalid  && inputElement.$dirty ) {
                cssClass = 'cl-invalid-input-glow';
            }
            else if (inputElement.$valid && inputElement.$dirty) {
                cssClass = 'cl-valid-input-glow';
            }
            else {
                cssClass = '';
            }
            return cssClass;
        };


        $scope.$watch('createRoomForm.roomNameInputElem.$error.pattern', function(newVal) {
            $log.debug('Pattern: ' + $scope.createRoom.roomName);
            $scope.patternError = $scope.createRoom.roomName;
        });


        $scope.getValidRoomNamePattern = function() {
            /* Make sure that unicode characters don't cause crashes.
               Try testing the javascript and the server with the following string: Iñtërnâtiônàlizætiøn☃💩
               The following characters are reserved and should not be allowed in room names.
                        $&+,/:;=?@"<>#%{}|\^~[]

               We also forbid the following characters because they may confuse the server
                        '/' (forward slash), \s (blank space),

               We also forbid the following characters, just in case we want to use them for internal purposes in the future
                        '*', '''

               (note that in the regexp below, that '\', '[', ']', and '/' are escaped with '\'.
             */
            return /^[^$&+,/:;=?@"<>#%{}|\\^~\[\]\/\s*'+]+$/;
        };
    });
