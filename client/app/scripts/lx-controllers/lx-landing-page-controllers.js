/**
 * Created by alexandermarquardt on 2014-07-08.
 */
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global $ */
/* global lxLandingPageConstantsEmbeddedInHtml */

angular.module('LxLandingPage.controllers', ['ngResource'])

    .controller('LxLandingPageController',
    function (
        $location,
        $log,
        $scope,
        lxChatRoomMembersService,
        lxFormsInputService,
        lxLandingPageConstantsService,
        lxSetEnableShowVideoElementsService) {

        // update the serverLoginPageConstantsService with the global vars embedded in the html.
        angular.extend(lxLandingPageConstantsService, lxLandingPageConstantsEmbeddedInHtml);

        $scope.lxMainCtrlDataObj.currentView = 'LxLandingPageView';
        $scope.mainMenuObject.showMainMenu = false;

        $scope.chatboxPanelElementObject.videoIsFocused = false;
        lxSetEnableShowVideoElementsService.lxSetEnableShowVideoElementsFn($scope);

        /*
         The following regular expressions are used for detecting if a user has entered a dis-allowed character into the
         input box. These values are passed from the server so that the server and client are guaranteed to always be
         evaluating the same regex for validity.
         */
        var invalidRoomNamesPattern = new RegExp('[' + lxLandingPageConstantsService.chatRoomNameInvalidCharsForRegex + ']', 'g');
        $scope.validRoomNamesPattern  = new RegExp('^[^' + lxLandingPageConstantsService.chatRoomNameInvalidCharsForRegex + ']+$');

        // The following values are passed from the server and are validated both on the client and on the server.
        $scope.minInputLength = lxLandingPageConstantsService.minRoomChars;
        $scope.maxInputLength = lxLandingPageConstantsService.maxRoomChars;

        $scope.inputRoomObj = {
            chatRoomName: null
        };

        // enterIntoRoom is the function that will be executed when the user clicks the submit button
        $scope.goToRoomUrl = function(chatRoomName) {
            // Just redirect to the room, where the user will be added when the room page is opened.
             $location.path('/' +  chatRoomName);
        };

        lxChatRoomMembersService.clearChatRoomDisplayObject($scope);

        $scope.roomStatus = {};

        $scope.showFormScope = function() {
            $log.debug($scope);
        };

        $scope.highlightInput = lxFormsInputService.highlightInput;

        $scope.$watch('createRoomForm.chatRoomNameInputElem.$viewValue',
            function() {

                var invalidCharacterFeedbackArray = lxFormsInputService.checkForInvalidCharacters(
                    $scope.createRoomForm.chatRoomNameInputElem, invalidRoomNamesPattern);
                var invalidCharacterCount = invalidCharacterFeedbackArray.length;

                if (invalidCharacterCount > 0) {
                    if (invalidCharacterCount === 1) {
                        $scope.invalidCharacterFeedback = invalidCharacterFeedbackArray[0] + ' is not allowed in the chat room name';
                    }
                    else {
                        $scope.invalidCharacterFeedback = invalidCharacterFeedbackArray.slice(0, invalidCharacterFeedbackArray.length - 1).join(',') + ' and ' +
                            invalidCharacterFeedbackArray.slice(-1) + ' are not allowed in the chat room name';
                    }
                }
            }
        );
    });
