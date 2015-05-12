/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
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

        $scope.lxMainViewCtrl.currentView = 'lxLandingPageCtrl';
        $scope.mainMenuObject.showMainMenu = false;

        $scope.videoStateInfoObject.enableShowVideoElements = false;
        $scope.chatboxPanelElementObject.videoIsFocused = false;
        $('.cl-ng-view').one('animationend webkitAnimationEnd oAnimationEnd MSAnimationEnd', function(){
            $scope.$apply(function() {
                $scope.videoStateInfoObject.enableShowVideoElements = true;
            });
        });

        /*
         The following regular expressions are used for detecting if a user has entered a dis-allowed character into th
         input box. These values are passed from the server so that the server and client are guaranteed to always be
         evaluating the same regex for validity.
         */
        var invalidRoomNamesPattern = new RegExp('[' + lxLandingPageConstantsService.chatRoomNameInvalidCharsForRegex + ']', 'g');
        $scope.validRoomNamesPattern  = new RegExp('^[^' + lxLandingPageConstantsService.chatRoomNameInvalidCharsForRegex + ']+$');

        // The following values are passed from the server and are validated both on the client and on the server.
        $scope.minInputLength = lxLandingPageConstantsService.minRoomChars;
        $scope.maxInputLength = lxLandingPageConstantsService.maxRoomChars;

        $scope.roomObj = {};
        $scope.roomObj.userName = lxAppWideConstantsService.userName;

        // enterIntoRoom is the function that will be executed when the user clicks the submit button
        $scope.goToRoomUrl = function(chatRoomName) {
            // Just redirect to the room, where the user will be added when the room page is opened.
             $location.path('/' +  chatRoomName);
        };

        // TODO - refactor this - combine with code in chat-room-controller
        function clearChatRoomDisplayObject($scope) {
            $scope.chatRoomDisplayObject.chatPanelObject = null;
            $scope.chatRoomDisplayObject.chatRoomId = null;
        }
        clearChatRoomDisplayObject($scope);

        $scope.roomStatus = {};

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

        $scope.$watch('createRoomForm.chatRoomNameInputElem.$viewValue',
            function(inputValue) {

                // Get the last character that was entered when $error.pattern changed to true.
                // The will set invalidCharacter to the first invalid character in the sequence.
                if ($scope.createRoomForm.chatRoomNameInputElem.$error.pattern) {

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
                        $scope.invalidCharacterFeedback = invalidCharacterFeedbackArray[0] + ' is not allowed in the chat room name';
                    }
                    else  {
                        $scope.invalidCharacterFeedback =  invalidCharacterFeedbackArray.slice(0, invalidCharacterFeedbackArray.length-1).join(',') + ' and ' +
                            invalidCharacterFeedbackArray.slice(-1) + ' are not allowed in the chat room name';
                    }
                }
        });
    });
