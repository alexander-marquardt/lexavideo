
'use strict';

/* global videoConstantsEmbeddedInHtml */

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

lxMainRoutes.controller('roomViewCtrl', function($scope,
                        serverConstantsService, updateGlobalVarsWithServerConstantsService) {

    if (videoConstantsEmbeddedInHtml.errorMessage) {
        // if there is an error, then it should trigger a redirect back to the welcome page.
        // This will be checked in lxCheckForErrorsAndRedirectIfNecessary.
        $scope.errorMessage = videoConstantsEmbeddedInHtml.errorMessage;
    }
    else {
        // copy all of the values that were embedded in the html into the serverConstantsService
        angular.extend(serverConstantsService, videoConstantsEmbeddedInHtml);

        // update the global vars that depend on serverConstantsService
        updateGlobalVarsWithServerConstantsService.doUpdate();
    }
});


lxMainRoutes.controller('welcomeViewErrCtrl', function($scope, $routeParams) {
   $scope.errorMessage = $routeParams.errorMessage;
});


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: '/_lx/lx-templates/lx-welcome.html'
    });
    
    $routeProvider.when('/err/:errorMessage', {
        templateUrl: '/_lx/lx-templates/lx-welcome.html',
        controller: 'welcomeViewErrCtrl'
    });

    $routeProvider.when('/:roomName', {
        templateUrl: function(params) {
            return '/_lx/lx-templates/lx-video-chat-main.html/' + params.roomName;
        },
        controller : 'roomViewCtrl'
    });


    $routeProvider.otherwise({
        templateUrl: '/_lx/lx-templates/lx-welcome.html'
    });
});


lxMainRoutes.controller('appCtrl', function($rootScope, $log) {
    // handle case when the promise is not resolved
    $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
        $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection);
    });
});