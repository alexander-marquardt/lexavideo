
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: function(){
            return '/_lx/lx-templates/lx-landing-page-main.html';
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


