/*
# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
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

angular.module('LxLogin.controllers', [])

    .controller('LxLoginModalController',
    function(
        $scope,
        lxFormsInputService,
        lxAppWideConstantsService
        ) {

        // For now, we just use the same patterns and lengths for user names, as we do for room names. This should
        // probably be changed at some point in the future. More extensive documentation of these regular expressions
        // is available in constants.py.
        var invalidUsernamesPattern = new RegExp('[' + lxAppWideConstantsService.usernameInvalidCharsForRegex + ']', 'g');
        $scope.validUsernamesPattern  = new RegExp('^[^' + lxAppWideConstantsService.usernameInvalidCharsForRegex + ']+$');

        // The following values are passed from the server and are validated both on the client and on the server.
        $scope.usernameMinChars = lxAppWideConstantsService.usernameMinChars;
        $scope.usernameMaxChars = lxAppWideConstantsService.usernameMaxChars;

        $scope.inputUsernameObj = {
            usernameAsWritten: null
        };

        $scope.highlightInput = lxFormsInputService.highlightInput;

        $scope.$watch('loginUserForm.usernameInputElem.$viewValue',
            function() {

                var invalidCharacterFeedbackArray = lxFormsInputService.checkForInvalidCharacters(
                    $scope.loginUserForm.usernameInputElem, invalidUsernamesPattern);
                var invalidCharacterCount = invalidCharacterFeedbackArray.length;

                if (invalidCharacterCount > 0) {
                    if (invalidCharacterCount === 1) {
                        $scope.invalidCharacterFeedback = invalidCharacterFeedbackArray[0] + ' is not allowed in the username';
                    }
                    else {
                        $scope.invalidCharacterFeedback = invalidCharacterFeedbackArray.slice(0, invalidCharacterFeedbackArray.length - 1).join(',') + ' and ' +
                            invalidCharacterFeedbackArray.slice(-1) + ' are not allowed in the username';
                    }
                }
            }
        );
    });
