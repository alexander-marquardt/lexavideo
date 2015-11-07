/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
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
        lxLandingPageConstantsService
        ) {

        // update the serverLoginPageConstantsService with the global vars embedded in the html.
        angular.extend(lxLandingPageConstantsService, lxLandingPageConstantsEmbeddedInHtml);

        $scope.lxMainCtrlDataObj.currentView = 'LxLandingPageView';
        $scope.mainMenuObject.showMainMenu = false;

        $scope.chatboxPanelElementObject.videoIsFocused = false;

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
