
'use strict';
/* global $ */

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

var getServerConstantsCtrl = lxMainRoutes.controller('getServerConstantsCtrl', function($scope, parameters) {
    $scope.parameters = parameters;
});

getServerConstantsCtrl.resolve = {

    parameters: function($q, $http) {
        var deferred = $q.defer();
        var url = '/json/get_video_params';
        $http({method: 'GET', url: url})
            .success(function(data) {
                deferred.resolve(data)
            })
            .error(function(data){
                deferred.reject('Unable to load data from ' + url);
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
        controller: 'getServerConstantsCtrl',
        resolve: getServerConstantsCtrl.resolve
    });

    $routeProvider.otherwise({
        templateUrl: '/lx-templates/lx-welcome.html'
    });
});


lxMainRoutes.controller('appCtrl', function($rootScope, $log) {
    // handle case when the promise is not resolved
    $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
        $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection)
    });
});