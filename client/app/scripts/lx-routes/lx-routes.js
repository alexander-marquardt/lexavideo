
'use strict';

/* global videoConstantsEmbeddedInHtml */
/* global loginConstantsEmbeddedInHtml */

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

lxMainRoutes.controller('lxVideoChatAppViewCtrl', function($rootScope, $log) {
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



lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: function(){
            return '/_lx/lx-templates/lx-login-registration-main.html'
        }
    });

    $routeProvider.when('/:roomName', {
        templateUrl: function(params) {
            return '/_lx/lx-templates/lx-chat-room-main.html/' + params.roomName;
        }
    });


    $routeProvider.otherwise({
        redirectTo: '/'
    });
});


