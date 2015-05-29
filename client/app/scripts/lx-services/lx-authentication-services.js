'use strict';

angular.module('lxAuthentication.services', [])


    .factory('lxAuthenticationHelper',
    function(
        $log,
        $window,
        $q,
        lxHttpHandleLoginService,
        jwtHelper,
        lxJs
        ) {

        function generateNewUniqueClientId(userId) {
            var uniqueClientIdentifier = Math.floor((Math.random() * 1000000000));
            var clientId = userId + '|' + uniqueClientIdentifier;
            return clientId;
        }

        function lxGetAndStoreClientId(scope, userId) {
            // Checks if a clientId is set in the sessionStorage and if it corresponds to the current userId.
            // If a matching clientId is stored it will be written to lxMainCtrlDataObj.clientId.
            // If it is not available then a new clientId will be generated, written to sessionStorage, and
            // also written to lxMainCtrlDataObj.clientId.

            lxJs.assert(userId, 'userId must be passed into lxGetAndStoreClientId');

            // The clientId is unique for each connection that a user makes to the server (ie. each new browser
            // window/device that they connect from). In order to create a unique clientID, we append the userId with
            // a randomly generated number with a billion possibilities. This should prevent the user
            // from being assigned two clientIds that clash.
            // We attempt to pull clientId out of sessionStorage so that the "client" will see the same open chats
            // even if they reload a tab/window. Read about sessionStorage for more information.
            var clientId = null;


            if ($window.sessionStorage.clientId) {
                clientId = $window.sessionStorage.clientId;
                var splitArr = clientId.split('|');
                var useIdFromClientId = parseInt(splitArr[0]);

                // If the userId pulled from the clientId in sessionStorage doesn't match the userId located in the
                // localStorage, then the localStorage userId wins. In this case,
                // generate a new clientId from the userId. This can happen if a new user logs in, but there is
                // still old client data in the sessionStorage.
                if (useIdFromClientId !== userId) {
                    clientId = generateNewUniqueClientId(userId);
                }
            } else {
                clientId = generateNewUniqueClientId(userId);

            }
            $window.sessionStorage.clientId = clientId;

            lxJs.assert(clientId, 'lxGetAndStoreClientId: clientId is not set');
            var createClientPromise = lxHttpHandleLoginService.createClientOnServer(clientId);
            createClientPromise.then(
                function () {
                    $log.info('lxGetAndStoreClientId: New clientId ' + clientId + ' was written to server.');
                    scope.lxMainCtrlDataObj.clientId = clientId;
                },
                function () {
                    scope.lxMainCtrlDataObj.clientId = null;
                }
            );

            return createClientPromise;
        }

        return {
            lxGetUserInfoInLocalStorage: function() {
                // Reads the userId from localStorage and returns the value found or null if not found.

                var userId,
                    usernameAsWritten;

                if ($window.localStorage.token) {
                    var tokenPayload = jwtHelper.decodeToken($window.localStorage.token);
                    userId = tokenPayload.userId;
                    usernameAsWritten = tokenPayload.usernameAsWritten;
                }
                else {
                    userId = null;
                    usernameAsWritten = null;
                }
                return {
                    userId: userId,
                    usernameAsWritten: usernameAsWritten
                };
            },


            lxCallGetAndStoreClientId: function($scope, userId) {
                // the following will update $scope.lxMainCtrlDataObj.clientId
                var createClientPromise = lxGetAndStoreClientId($scope, userId);
                createClientPromise.then(
                    function () {
                        lxJs.assert($scope.lxMainCtrlDataObj.clientId,
                            'lxCallGetAndStoreClientId: clientId should be initialized if createClientPromise was successful');
                    }
                );
                return createClientPromise;
            },

            lxRemoveTokenAndSession: function() {
                delete $window.localStorage.token;
                delete $window.sessionStorage.clientId;
            }
        };
    });
