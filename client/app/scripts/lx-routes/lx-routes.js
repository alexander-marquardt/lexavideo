
'use strict';
/* global $ */

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

lxMainRoutes.config(function ($routeProvider, $locationProvider) {
        $locationProvider.html5Mode(true);



        $routeProvider.when("/:roomName", {
            templateUrl: "/lx-templates/lx-video-chat-main.html"
        });

        $routeProvider.when("/", {
            templateUrl: "/lx-templates/lx-video-chat-main.html"
        });

        $routeProvider.otherwise({
            templateUrl: "/lx-templates/lx-welcome.html"
        });
    });

lxMainRoutes.controller('lxRoutesCtrl', function($scope) {

});