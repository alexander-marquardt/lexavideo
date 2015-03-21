
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    $routeProvider.when('/', {
        templateUrl: function(){
                return '/_lx/lx-templates/lx-landing-page-main.html';
            },
        controller: 'lxLandingPageCtrl'
    });

    $routeProvider.when('/:chatRoomName', {
        /* When chatbox URLs are selected,  the ngView that is shown is blank and one of
         the chat panels defined in the lx-chatbox.html file will be enabled, depending on the
         current URL (where the URL contains the chat name). */
        templateUrl: function(){
                return '/_lx/lx-templates/lx-dummy-chatbox-view.html';
            },
        controller: 'lxChatViewCtrl'
    });

    $routeProvider.otherwise({
        redirectTo: '/'
    });
});


