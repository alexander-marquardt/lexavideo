
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

var roomViewCtrl = lxMainRoutes.controller('roomViewCtrl', function($scope,
                        serverConstantsService, updateGlobalVarsWithServerConstantsService) {

    if (videoConstantsEmbeddedInHtml.errorMessage) {
        // if there is an error, then it should trigger a redirect back to the welcome page.
        // This will be checked in lxCheckForErrorsAndRedirectIfNecessary.
        $scope.errorMessage = videoConstantsEmbeddedInHtml.errorMessage;
    }
    else {
        angular.extend(serverConstantsService, videoConstantsEmbeddedInHtml);
        serverConstantsService.constantsAreLoaded.resolve();
        updateGlobalVarsWithServerConstantsService.doUpdate();
    }
});


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
        templateUrl: function(params) {
            return '/_jx/lx-templates/lx-video-chat-main.html/' + params.roomName
        },
        controller : 'roomViewCtrl'
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