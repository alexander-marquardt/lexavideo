/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global lxLandingPageConstantsEmbeddedInHtml */

angular.module('lxLandingPage.controllers', ['ngResource'])

    .controller('lxLandingPageCtrl',
    function (
        $location,
        $log,
        $scope,
        lxLandingPageConstantsService,
        lxHttpHandleRoomService,
        lxAppWideConstantsService) {

        // update the serverLoginPageConstantsService with the global vars embedded in the html.
        angular.extend(lxLandingPageConstantsService, lxLandingPageConstantsEmbeddedInHtml);


        /*
         The following regular expressions are used for detecting if a user has entered a dis-allowed character into th
         input box. These values are passed from the server so that the server and client are guaranteed to always be
         evaluating the same regex for validity.
         */
        var invalidRoomNamesPattern = new RegExp('[' + lxLandingPageConstantsService.roomNameInvalidCharsForRegex + ']', 'g');
        $scope.validRoomNamesPattern  = new RegExp('^[^' + lxLandingPageConstantsService.roomNameInvalidCharsForRegex + ']+$');

        // The following values are passed from the server and are validated both on the client and on the server.
        $scope.minInputLength = lxLandingPageConstantsService.minRoomChars;
        $scope.maxInputLength = lxLandingPageConstantsService.maxRoomChars;

        $scope.roomObj = {};
        $scope.roomObj.userName = lxAppWideConstantsService.userName;

        // enterIntoRoom is the function that will be executed when the user clicks the submit button
        $scope.goToRoomUrl = function(roomName) {
            // Just redirect to the room, where the user will be added when the room page is opened.
             $location.path('/' +  roomName);
        };

        // roomStatus.roomStatus.triggerGetNewRoom is placed on the scope and will be watched for changes by the
        // checkForRoomOccupancyDirective for changes. If this value changes, then a new check will be done
        // to see if the room name is available. We simply toggle the value between true and false each time
        // that we need to trigger a new call to getRoom.
        $scope.roomStatus = {};
        $scope.roomStatus.triggerGetNewRoom = true;

        $scope.showFormScope = function() {
            $log.debug($scope);
        };

        $scope.highlightInput =
            function(inputElement) {

                var cssClass;
                if (inputElement.$invalid  && inputElement.$dirty ) {
                    cssClass = 'cl-invalid-input-glow';
                }
                else if (inputElement.$valid && inputElement.$dirty) {

                    // the roomIsEmptyMessage and roomNotFullMessage are set in the checkForRoomOccupancy directive.
                    if (inputElement.roomIsEmptyMessage) {
                        cssClass = 'cl-valid-input-glow';
                    }
                    if (inputElement.roomNotFullMessage) {
                        cssClass = 'cl-warning-input-glow';
                    }
                }
                else {
                    cssClass = '';
                }
                return cssClass;
            };

        $scope.$watch('createRoomForm.roomNameInputElem.$viewValue',
            function(inputValue) {

                // Get the last character that was entered when $error.pattern changed to true.
                // The will set invalidCharacter to the first invalid character in the sequence.
                if ($scope.createRoomForm.roomNameInputElem.$error.pattern) {

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
                        $scope.invalidCharacterFeedback = invalidCharacterFeedbackArray[0] + ' is not allowed in the private chat name';
                    }
                    else  {
                        $scope.invalidCharacterFeedback =  invalidCharacterFeedbackArray.slice(0, invalidCharacterFeedbackArray.length-1).join(',') + ' and ' +
                            invalidCharacterFeedbackArray.slice(-1) + ' are not allowed in the private chat name';
                    }
                }
        });
    });
