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
