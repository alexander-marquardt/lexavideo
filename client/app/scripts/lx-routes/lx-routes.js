
'use strict';

/* global videoConstantsEmbeddedInHtml */

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

lxMainRoutes.controller('appCtrl', function($rootScope, $log) {
    // handle case when a route change promise is not resolved
    $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
        $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection);
    });
    $rootScope.$on('$locationChangeStart', function(event, next, current) {
        $log.debug('Next route: ' + next);
        $log.debug('Current route: ' + current);
      // Get all URL parameter
    });
});

lxMainRoutes.controller('roomViewCtrl', function($scope,
                                                 serverConstantsService,
                                                 globalVarsService) {

    $scope.roomViewCtrl = {};

    if (videoConstantsEmbeddedInHtml.errorStatus) {
        $scope.roomViewCtrl.errorStatus = videoConstantsEmbeddedInHtml.errorStatus;
        $scope.roomViewCtrl.roomName = videoConstantsEmbeddedInHtml.roomName;
    }
    else {
        // copy all of the values that were embedded in the html into the serverConstantsService
        angular.extend(serverConstantsService, videoConstantsEmbeddedInHtml);

        // update the global vars that depend on serverConstantsService
        globalVarsService.doUpdate(serverConstantsService.rtcInitiator, serverConstantsService.pcConfig);
    }
});



lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: '/_lx/lx-templates/lx-welcome.html'
    });

    $routeProvider.when('/:roomName', {
        templateUrl: function(params) {
            return '/_lx/lx-templates/lx-video-chat-main.html/' + params.roomName;
        },
        controller : 'roomViewCtrl'
    });


    $routeProvider.otherwise({
        redirectTo: '/'
    });
});


