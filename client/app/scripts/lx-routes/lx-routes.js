
'use strict';

var lxMainRoutes = angular.module('lxMain.routes', ['ngRoute']);


lxMainRoutes.config(function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);


    // Note to self: To extract URL /.../:foo, use $routeParams.foo
    $routeProvider.when('/', {
        templateUrl: function(){
                return '/_lx/lx-templates/lx-landing-page-main.html';
            },
        controller: 'LxLandingPageController'
    });

    $routeProvider.when('/:chatRoomName', {
        /* When chatbox URLs are selected,  the ngView that is shown is blank and one of
         the chat panels defined in the lx-chatbox.html file will be enabled, depending on the
         current URL (where the URL contains the chat name). */
        templateUrl: function(){
                return '/_lx/lx-templates/lx-dummy-chatbox-view.html';
            },

        // Warning, because we are "faking" the chat panel views, this controller does not wrap the chat panels
        controller: 'LxChatMainController'
    });




    $routeProvider.otherwise({
        redirectTo: '/'
    });
});


lxMainRoutes.controller('lxWatchRouteChangesCtrl',
    function (
        $log,
        $rootScope,
        $route
        ) {

        // handle case when a route change promise is not resolved
        $rootScope.$on('$routeChangeError', function (event, current, previous, rejection) {
            $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection);
        });

        $rootScope.$on('$locationChangeStart', function (event, next, current) {
            $log.debug('Next route: ' + next);
            $log.debug('Current route: ' + current);
        });

        $rootScope.$on('$locationChangeSuccess', function () {
            $log.debug('$locationChangeSuccess called');
        });

        $rootScope.$on('$routeChangeSuccess', function () {

            // set the values on chatRoomDisplayObject
            var chatRoomNameFromUrl = $route.current.params.chatRoomName;

            if (chatRoomNameFromUrl) {
                $rootScope.chatRoomDisplayObject.chatRoomNameFromUrl = chatRoomNameFromUrl;
                $rootScope.chatRoomDisplayObject.normalizedChatRoomNameFromUrl = chatRoomNameFromUrl.toLowerCase();
                $rootScope.chatRoomDisplayObject.lastChatRoomNameFromUrl = chatRoomNameFromUrl;
            }
            else {
                $rootScope.chatRoomDisplayObject.chatRoomNameFromUrl = null;
                $rootScope.chatRoomDisplayObject.normalizedChatRoomNameFromUrl = null;
                // Note: do not null lastChatRoomNameFromUrl as it "remembers" the last chat room
            }
        });
    }
);