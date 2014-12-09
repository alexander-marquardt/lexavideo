
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global userInfoEmbeddedInHtml */

angular.module('lxMainView.controllers', [])

.controller('lxVideoChatAppViewCtrl',
    function(
        $log,
        $scope,
        lxAppWideConstantsService) {


        // Copy information embedded in the Html into an angular service.
        angular.extend(lxAppWideConstantsService, userInfoEmbeddedInHtml);

        $scope.roomLandingObj = {};
        $scope.roomLandingObj.userIsInRoom = false;
        $scope.roomLandingObj.inputRoomName = null;

//
//        // handle case when a route change promise is not resolved
//        $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
//            $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection);
//        });
//
//        $rootScope.$on('$locationChangeStart', function(event, next, current) {
//            $log.debug('Next route: ' + next);
//            $log.debug('Current route: ' + current);
//        });
//
//        $rootScope.$on('$locationChangeSuccess', function() {
//            $log.debug('$locationChangeSuccess called');
//        });
    });


