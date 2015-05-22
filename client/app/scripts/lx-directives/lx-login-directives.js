
'use strict';

angular.module('lxLogin.directives', [])

    .directive('checkForExistingUsernameDirective',
    function(
        $log,

        lxHttpHandleLoginService,
        lxLandingPageConstantsService,
        lxDelayActionService) {

        var timeSinceLastKeypressBeforeHttpCall = 300; // time in milliseconds
        var delayAction = lxDelayActionService.getDelayFn();


        return {
            require: 'ngModel',
            link: function(scope, elem, attrs, ctrl) {

                var inputElement = angular.element(elem)[0];

                /*
                 We watch the input element directly as opposed to the ngModel.$modelValue value,
                 because the ngModel value is only updated when all validity
                 conditions are met, which is not sufficient for providing up-to-date and accurate feedback
                 to the user.
                 */
                scope.$watch(

                    // Define the function that returns the value that is being watched for changes
                    function() {

                        return inputElement.value.toString() + scope.refreshLoginToggler.toString();
                    },

                    /*
                     When the user changes the text input, we provide feedback about the validity of the name that
                     they have selected by checking if the name is available etc. This requires ajax calls to the
                     server.
                     */
                    function() {

                        var checkIfUsernameAvailablePromise = null;

                        /*
                         Note: there is a confusing naming scheme used for the validity values, and in the html the $error.checkForRoomOccupancyIsOk
                         that is accessed is the negation of the 'isValid' value that is set here (ie. if checkForRoomOccupancyIsOk is
                         set to false, then the $error value will be true, and the user will be shown the error message).
                         */
                        ctrl.$setValidity('checkForExistingUsernameIsOk', true);

                        /*
                        Keep track of if the user is still typing or not, and while they are typing we disable the
                        enter button.
                        */
                        ctrl.userIsWaitingForUsernameStatus = true;
                        ctrl.usernameIsAvailableMessage = '';
                        ctrl.usernameIsTakenMessage = '';
                        ctrl.inputCssClass = '';

                        if (ctrl.$valid) {
                            if (inputElement.value) {

                                // We don't want to submit all characters as the user is typing. Only do the
                                // submit once the user has stopped typing or slowed down. This functionality
                                // is provided by the following wrapper.
                                delayAction(function() {

                                    // This is the GET call to the server that will return the status of the room as
                                    // will be indicated by resolution of getRoomPromise.
                                    checkIfUsernameAvailablePromise = lxHttpHandleLoginService.checkIfUsernameAvailable(inputElement.value);
                                    $log.debug('checkIfUsernameAvailablePromise called for: ' + inputElement.value);

                                    checkIfUsernameAvailablePromise.then(
                                        function(response) {

                                            // Modify validity and feedback only if this is a response to the most recently
                                            // typed chatRoomName. This guards against a slow server response that could be
                                            // out-of-date if the user has typed in a new chatRoomName before receiving the
                                            // response.
                                            if (response.data.usernameNormalized === inputElement.value.toLowerCase()) {

                                                if (response.data.usernameAvailable === true) {
                                                    ctrl.usernameIsAvailableMessage = 'Username is available!';
                                                    ctrl.inputCssClass = 'cl-valid-input-glow'
                                                }
                                                else {
                                                    ctrl.usernameIsTakenMessage = 'Username is taken';
                                                    ctrl.inputCssClass = 'cl-invalid-input-glow';
                                                }
                                            }
                                            else {
                                                // This will likely occasionally happen, but if it happens too often then it is likely an indication
                                                // that something is going wrong. This can occur because of server delay in responding
                                                // to recent requests. It is not serious and can be ignored.
                                                $log.warn('Warning: Username ' + response.data.usernameNormalized +
                                                    ' returned from server does not match most recently typed username ' + inputElement.value);
                                            }

                                        },
                                        function(response) {
                                            ctrl.$setValidity('checkForExistingUsernameIsOk', false);
                                            $log.error('checkForExistingUsername - Error: ' + response.statusText);
                                        }
                                    )['finally'](
                                        function () {
                                            ctrl.userIsWaitingForUsernameStatus = false;
                                        }
                                    );

                                }, timeSinceLastKeypressBeforeHttpCall);
                            }

                        }
                        else {
                            // This basically just acts as a place holder that will never really be clickable.
                            ctrl.submitButtonText = 'Enter!';
                            if (ctrl.$dirty ) {
                                ctrl.inputCssClass = 'cl-invalid-input-glow';
                            }
                        }
                    }
                );
            }
        };
    })

    .directive('lxMakeSureUserIsLoggedIn',
    function(
        $log,
        $modal,
        lxHttpHandleLoginService) {

        var showModalWindowFromTemplateUrl = function($scope, htmlTemplateUrl) {
            // Remember the outerScope because the modal isolates the scope and I couldn't figure out how
            // to get code inside the modal to modify values in the inheritance chain.
            var outerScope = $scope;
            var modalInstance = $modal.open({
                templateUrl: htmlTemplateUrl,
                backdrop: 'static',
                controller: function ($scope, $log, $modalInstance) {
                    // refreshLoginToggler is a boolean that we toggle if there is an error creating user. This
                    // will force a watch in a login directive to execute and update user feedback about the
                    // status of the login/user creation.
                    $scope.refreshLoginToggler = false;
                    $scope.submitUsername = function(usernameAsWritten) {
                        var httpPromise = lxHttpHandleLoginService.loginUserOnServer(outerScope, usernameAsWritten);
                        httpPromise.then(
                            function() {
                                $log.debug('userId is: ' + outerScope.lxMainCtrlDataObj.userId);
                                $modalInstance.close();
                            },
                            function() {
                                $scope.refreshLoginToggler = !$scope.refreshLoginToggler;
                            }
                        )
                    };
                }
            });

            modalInstance.result.then(
                function() {
                    $log.log('modal closed ' + htmlTemplateUrl);
                },
                function() {
                    $log.log('modal dismissed ' + htmlTemplateUrl);
                }
            )['finally'](
                function () {
                    $log.log('Closed the modal box for '+ htmlTemplateUrl);
                }
            );
        };


        return {
            restrict: 'A',
            link: function(scope) {

                scope.$watch('lxMainCtrlDataObj.userId',
                function(userId) {
                    if (!userId) {
                        showModalWindowFromTemplateUrl(scope, 'lx-template-cache/lx-login-modal.html');
                    }
                });
            }
        };
    });
