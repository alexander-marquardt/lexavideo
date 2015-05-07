
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    // Note to self: To extract URL /.../:foo, use $routeParams.foo
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

        // Warning, because we are "faking" the chat panel views, this controller does not wrap the chat panels
        controller: 'lxChatViewCtrl'
    });

    $routeProvider.otherwise({
        redirectTo: '/'
    });
});


