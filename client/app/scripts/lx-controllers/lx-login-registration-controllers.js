/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global loginConstantsEmbeddedInHtml */

angular.module('lxLoginRegistration.controllers', ['ngResource'])
    .controller('lxLoginRegistrationCtrl', function ($log, $scope, lxHandleRoomService) {


        $scope.minInputLength = loginConstantsEmbeddedInHtml.minRoomChars;
        $scope.maxInputLength = loginConstantsEmbeddedInHtml.maxRoomChars;
        $scope.invalidCharacter = ''; // used for displaying which invalid characters have been entered.

        $scope.createRoom = lxHandleRoomService.createRoom;



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


        /*
        Make sure that unicode characters don't cause crashes.
        Try testing the javascript and the server with the following string: Iñtërnâtiônàlizætiøn☃💩

        The following characters are reserved and should not be allowed in room names.
                 $&+,/:;=?@"<>#%{}|\^~[]

        We also forbid the following characters because they may confuse the server
                 '/' (forward slash), \s (blank space),

        We also forbid the following characters, just in case we want to use them for internal purposes in the future
                 '*', '''

        (note that in the regexp below, that '\', '[', ']', and '/' are escaped with '\'.
        */
        var invalidRoomNamesPattern =    /[$&+,/:;=?@"<>#%{}|\\^~\[\]\/\s*'+]/g;
        $scope.validRoomNamesPattern = /^[^$&+,/:;=?@"<>#%{}|\\^~\[\]\/\s*'+]+$/;


        $scope.$watch('createRoomForm.roomNameInputElem.$viewValue', function(inputValue) {
            if ($scope.createRoomForm.roomNameInputElem.$error.pattern) {
                // Get the last character that was entered when $error.pattern changed to true.
                // The will set invalidCharacter to the first invalid character in the sequence.
                var invalidCharacterFeedbackArray = [];
                var invalidCharacterSet = {}; // used to ensure that we report each character only once
                var invalidCharacterCount = 0;

                var invalidCharactersArray = inputValue.match(invalidRoomNamesPattern);

                angular.forEach(invalidCharactersArray, function(invalidCharacter) {
                    if (!(invalidCharacter in invalidCharacterSet)) {
                        invalidCharacterSet[invalidCharacter] = 'In';
                        invalidCharacterCount ++;

                        if (invalidCharacter.match(/\s/)) {
                            var blankStr = 'blank space';
                            invalidCharacterFeedbackArray.push(blankStr);
                        } else {
                            invalidCharacterFeedbackArray.push(invalidCharacter);
                        }
                    }
                });

                if (invalidCharacterCount === 1) {
                    $scope.invalidCharacterFeedback = invalidCharacterFeedbackArray[0] + ' is not allowed in the room name';
                }
                else  {
                    $scope.invalidCharacterFeedback =  invalidCharacterFeedbackArray.slice(0, invalidCharacterFeedbackArray.length-1).join(',') + ' and ' +
                        invalidCharacterFeedbackArray.slice(-1) + ' are not allowed in the room name';
                }
            }
        });
    });
