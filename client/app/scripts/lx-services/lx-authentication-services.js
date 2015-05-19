'use strict';
/* global $ */

angular.module('lxAuthentication.services', [])


    .factory('lxAuthenticationHelper',
    function(
        $window,
        jwtHelper
        ) {

        function generateNewUniqueClientId(userId) {
            var uniqueClientIdentifier = Math.floor((Math.random() * 1000000000));
            var clientId = userId + '|' + uniqueClientIdentifier;
            return clientId;
        }

        return {
            lxGetUserIdInLocalStorage: function() {
                // Reads the userId from localStorage and returns the value found or null if not found.

                var userId;
                if ($window.localStorage.token) {
                    var tokenPayload = jwtHelper.decodeToken($window.localStorage.token);
                    userId = tokenPayload.userId;
                }
                else {
                    userId = null;
                }
                return userId;
            },

            lxGetOrGenerateClientId: function(userId) {
                // Checks if a clientId is set in the sessionStorage and if it corresponds to the current userId.
                // If a matching clientId is available it will be returned. If it is not available then a new
                // clientId will be generated and written to sessionStorage and returned.


                // The clientId is unique for each connection that a user makes to the server (ie. each new browser
                // window/device that they connect from). In order to create a unique clientID, we append the userId with
                // a randomly generated number with a billion possibilities. This should prevent the user
                // from being assigned two clientIds that clash.
                // We attempt to pull clientId out of sessionStorage so that the "client" will see the same open chats
                // even if they reload a tab/window. Read about sessionStorage for more information.
                var clientId;

                if (userId) {
                    if ($window.sessionStorage.clientId) {
                        clientId = $window.sessionStorage.clientId;
                        var splitArr = clientId.split('|');
                        var useIdFromClientId = parseInt(splitArr[0]);

                        // If the userId pulled from the clientId in sessionStorage doesn't match the userId located in the
                        // localStorage, then the localStorage userId wins. In this case,
                        // generate a new clientId from the userId. This can happen if a new user logs in, but there is
                        // still old client data in the sessionStorage.
                        if (useIdFromClientId !== userId) {
                            $window.sessionStorage.clientId = generateNewUniqueClientId(userId);
                        }
                    } else {
                        $window.sessionStorage.clientId = generateNewUniqueClientId(userId);

                    }
                }
                else {
                    // Note: if there isn't a userId, don't write anything to sessionStorage (eg. don't do
                    // "else {sessionStorage.clientId = null;}"). This is because anything written is stored as strings
                    // and therefore "null" will be treated as a clientId string as opposed to a falsy value.
                    $log.error('lxGetOrGenerateClientId called without a userId value');
                }

                return clientId;
            }
        }
    });
