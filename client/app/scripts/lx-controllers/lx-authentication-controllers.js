'use strict';


angular.module('lxAuthentication.controllers', [])

    // Note: each panel has it's own lxChatPanelCtrl.
    .controller('lxLoginCtrl',
    function (
        $scope,
        $http,
        $window
        )

    {
        $scope.loginInfo = {username: null, password: null};
        $scope.message = '';
        $scope.submit = function () {
            $http
                .post('/_lx/temp_login', $scope.loginInfo)
                .success(function (data/*, status, headers, config */) {
                    $window.localStorage.token = data.token;
                    $scope.message = 'Welcome';
                })
                .error(function (/*data, status, headers, config*/) {
                    // Erase the token if the user fails to log in
                    delete $window.localStorage.token;

                    // Handle login errors here
                    $scope.message = 'Error: Invalid user or password';
                });
        };
    }
);