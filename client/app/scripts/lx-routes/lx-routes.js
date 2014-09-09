
'use strict';
/* global $ */

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);

lxMainRoutes.config(function ($routeProvider, $locationProvider) {
        $locationProvider.html5Mode(true);



        $routeProvider.when("/:roomName", {
            templateUrl: "/lx-ng-views/lx-video-chat-view/lx-video-chat-main.html"
        });

        $routeProvider.when("/", {
            templateUrl: "/lx-ng-views/lx-video-chat-view/lx-video-chat-main.html"
        });

        $routeProvider.otherwise({
            templateUrl: "/lx-ng-views/lx-video-chat-view/lx-video-chat-main.html"
        });
    });

lxMainRoutes.controller('lxRoutesCtrl', function($scope) {

});