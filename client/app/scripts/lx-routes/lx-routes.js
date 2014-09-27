
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: function(){
            return '/_lx/lx-templates/lx-create-chat-room-main.html';
        }
    });

    $routeProvider.when('/:roomName', {
        templateUrl: function(params) {
            return '/_lx/lx-templates/lx-use-chat-room-main.html/' + params.roomName;
        }
    });

    $routeProvider.when('/error/:roomName/:errorString', {
        templateUrl: function(params) {
            '/_lx/lx-templates/lx-create-chat-room-main.html/' + params.roomNmae + '/' + params.errorString;
        }
    });

    $routeProvider.otherwise({
        redirectTo: '/'
    });
});


