
'use strict';
/* global $ */

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

var waitForConstantsCtrl = lxMainRoutes.controller('waitForConstantsCtrl', function($scope, parameters) {
    $scope.parameters = parameters;
});

waitForConstantsCtrl.resolve = {

    parameters: function($q, $http) {
        var deferred = $q.defer();
        $http({method: 'GET', url: '/json/get_video_params'})
            .success(function(data) {
                deferred.resolve(data)
            })
            .error(function(data){
                //actually you'd want deffered.reject(data) here
                //but to show what would happen on success..
                deferred.resolve("error value");
            });

        return deferred.promise;
    }
};

lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);

    $routeProvider.when('/:roomName', {
        templateUrl: '/lx-templates/lx-video-chat-main.html'
    });

    $routeProvider.when('/', {
        templateUrl: '/lx-templates/lx-video-chat-main.html',
        controller: 'waitForConstantsCtrl',
        resolve: waitForConstantsCtrl.resolve
    });

    $routeProvider.otherwise({
        templateUrl: '/lx-templates/lx-welcome.html'
    });
});
