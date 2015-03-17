
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: function(){
                return '/_lx/lx-templates/lx-landing-page-main.html';
            },
            controller: 'lxLandingPageCtrl'
        }
    );

    $routeProvider.when('/:chatRoomName', {
        templateUrl: function(params) {
                return '/_lx/lx-templates/lx-chatbox.html/' + params.chatRoomName;
            },
            controller: 'lxChatRoomCtrl'
        }
    );

    $routeProvider.otherwise({
        redirectTo: '/'
    });
});


