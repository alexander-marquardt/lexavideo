
'use strict';

// define externally defined variables so that jshint doesn't give warnings
/* global userInfoEmbeddedInHtml */

angular.module('lxMainView.controllers', [])

.controller('lxVideoChatAppViewCtrl',
    function(
        $rootScope,
        $log,
        $scope,
        lxAppWideConstantsService,
        lxModalSupportService) {

        $scope.mainGlobalControllerObj = {
             // if the user is rejected from a room, then this will contain a message indicating the reason.
            errorEnteringIntoRoomMessage: null
        };

        $scope.$watch('mainGlobalControllerObj.errorEnteringIntoRoomMessage', function(errorMsg) {

            if (errorMsg) {
                lxModalSupportService.showStandardModalWindowFromTemplate(
                        '<div class="modal-header">' +
                        '<h3 class="modal-title">Title Goes Here(</h3>' +
                        '<div class="modal-body">' +
                        'Content goes here!!! ' +
                        '</div>' +
                        '<div class="modal-footer">' +
                        '<button class="btn btn-primary" ng-click="ok()">OK</button>' +
                        '</div>' +
                        '</div>');
                $scope.mainGlobalControllerObj.errorEnteringIntoRoomMessage = null;

            }

        });

        // Copy information embedded in the Html into an angular service.
        angular.extend(lxAppWideConstantsService, userInfoEmbeddedInHtml);

        // handle case when a route change promise is not resolved
        $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
            $log.error('Error: $routeChangeError failure in lxMain.routes. ' + rejection);
        });

        $rootScope.$on('$locationChangeStart', function(event, next, current) {
            $log.debug('Next route: ' + next);
            $log.debug('Current route: ' + current);
        });

        $rootScope.$on('$locationChangeSuccess', function() {
            $log.debug('$locationChangeSuccess called');
        });
    });


