
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
             // if the user is rejected from a room, then this will contain a information about what went wrong.
             /*
             errorEnteringIntoRoomInfoObj = {
                statusString: null,
                pageNameThatCausedError: null,
                pageUrlThatCausedError: null
             }
             We set errorEnteringIntoRoomInfoObj to null to indicate that there are no currently un reported errors.*/
            errorEnteringIntoRoomInfoObj: null
        };

        $scope.$watch('mainGlobalControllerObj.errorEnteringIntoRoomInfoObj', function(errorEnteringIntoRoomInfoObj) {


            if (errorEnteringIntoRoomInfoObj !== null) {
                lxModalSupportService.showStandardModalWindowFromTemplate(
                        '<div class="modal-header">' +
                        '<h3 class="modal-title">Error entering into room ' + errorEnteringIntoRoomInfoObj.pageNameThatCausedError + '</h3>' +
                        '<div class="modal-body">' +
                            'Unable to enter into room: <a ng-click="modalOkFn()" href=' +
                            errorEnteringIntoRoomInfoObj.pageUrlThatCausedError + '>' +
                            errorEnteringIntoRoomInfoObj.pageNameThatCausedError + '</a> ' +
                            'due to error code: ' + errorEnteringIntoRoomInfoObj.statusString  +
                        '</div>' +
                        '<div class="modal-footer">' +
                        '<button class="btn btn-primary" ng-click="modalOkFn()">OK</button>' +
                        '</div>' +
                        '</div>');
                $scope.mainGlobalControllerObj.errorEnteringIntoRoomInfoObj = null;

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


