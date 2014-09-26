
'use strict';

angular.module('lxMainView.controllers', [])

.controller('lxVideoChatAppViewCtrl', function($rootScope, $log) {
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


