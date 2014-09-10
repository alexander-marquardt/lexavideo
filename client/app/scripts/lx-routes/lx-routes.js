
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

var roomViewCtrl = lxMainRoutes.controller('roomViewCtrl', function($scope, serverConstants,
                        serverConstantsService, updateGlobalVarsWithServerConstantsService) {
    // this controller gets called after the serverConstants promise is resolved. serverConstants are then
    // injected into this controller and contain the data returned from the $http call in roomViewCtrl.resolve
    if (serverConstants.errorMessage) {
        // if there is an error, then it should trigger a redirect back to the welcome page.
        // This will be checked in lxCheckForErrorsAndRedirectIfNecessary.
        $scope.errorMessage = serverConstants.errorMessage;
    }
    else {
        angular.extend(serverConstantsService, serverConstants);
        serverConstantsService.constantsAreLoaded.resolve();
        updateGlobalVarsWithServerConstantsService.doUpdate();
    }
});

roomViewCtrl.resolve = {

    // the following
    serverConstants: function($q, $http, $route, $log) {
        var deferred = $q.defer();
        var roomName = $route.current.params.roomName;
        var url = '/json/get_video_params';
        if (roomName) {
            url = url + '/' + roomName;
        } else {
            $log.error('Error: attempting to call ' + url + 'without a roomName parameter.');
        }
        $http({method: 'GET', url: url})
            .success(function(data) {
                deferred.resolve(data);
            })
            .error(function(){
                deferred.reject('Unable to load data from ' + url);
            });

        return deferred.promise;
    }
};

lxMainRoutes.controller('welcomeViewErrCtrl', function($scope, $routeParams) {
   $scope.errorMessage = $routeParams.errorMessage;
});


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: '/_jx/lx-templates/lx-welcome.html'
    });
    
    $routeProvider.when('/err/:errorMessage', {
        templateUrl: '/_jx/lx-templates/lx-welcome.html',
        controller: 'welcomeViewErrCtrl'
    });

    $routeProvider.when('/:roomName', {
        templateUrl: '/_jx/lx-templates/lx-video-chat-main.html',
        controller: 'roomViewCtrl',
        resolve: roomViewCtrl.resolve
    });


    $routeProvider.otherwise({
        templateUrl: '/_jx/lx-templates/lx-welcome.html'
    });
});


lxMainRoutes.controller('appCtrl', function($rootScope, $log) {
    // handle case when the promise is not resolved
    $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
        $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection);
    });
});