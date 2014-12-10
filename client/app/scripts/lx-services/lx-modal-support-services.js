/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';

var lxModalSupportServices = angular.module('lxModalSupport.services', []);


lxModalSupportServices.controller('modalInstanceCtrl', function($scope, $log, $modalInstance) {
    /* This 'controller' is used only by lxModalSupportService, and therefore is contained in this service module as opposed
       to appearing in a controller module.
     */
    $scope.ok = function () {
        $modalInstance.close();
    };
    $scope.cancel = function () {
        $modalInstance.close();
    };
});


lxModalSupportServices.service('lxModalSupportService', function ($modal, $log, $timeout) {
    /* Provides constant values that are used in various parts of the javascript code.
     */


    this.showCameraAndMicrophoneModal = function(scope, htmlTemplate, windowClass, modalSize) {

        // Responsible calling the code that will display a modal dialog box which indicates to
        // the user that they must give access to their camera and microphone.

        var modalInstance = $modal.open({
            templateUrl: htmlTemplate,
            controller: 'modalInstanceCtrl',
            windowClass : windowClass,
            size: modalSize
        });

        modalInstance.opened.then(
            //  a promise that is resolved when a modal gets opened after downloading content's template and resolving all variables
            function() {
                // success function
                $log.log('Added modal box to modalsCurrentlyShown: '+ htmlTemplate);
                scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown.push(htmlTemplate);
            }, function() {
                // failure function
            }
        );

        modalInstance.result.then(
            //a promise that is resolved when a modal is closed and rejected when a modal is dismissed
            function(/* result */) {
                //$log.log('modal closed ' + htmlTemplate);
            },
            function(/* reason */) {
                //$log.log('modal dismissed ' + htmlTemplate);
            })
            ['finally'](function () {
                // this is called when the modal is either "closed" or "dismissed"
                $timeout(function() {
                    // since this is inside a promise, it is outside of angular scope. We therefore wrap
                    // this in a $timeout so that angular will be notified of the update to the scope.

                    // remove the modal that we just closed from the modalsCurrentlyShown array
                    var arr = scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown;
                    arr.splice(arr.indexOf(htmlTemplate), 1);
                    $log.log('Removed modal box from modalsCurrentlyShown: '+ htmlTemplate);
                });
            });

        return modalInstance;
    };

    this.closeModal = function(currentModalInstance) {
        // Adds some extra exception handling and condition checking before trying to close a given modal dialog box.

        // check to see if a modal has been created before trying to close it.
        if (currentModalInstance !== null) {

            $log.info('closing most recent modal');
            try {
                currentModalInstance.close();
            } catch(e) {
                if (e instanceof TypeError) {
                    // Don't do anything -- this error is expected, and occurs because the close() method will
                    // fail if called more than once on a single modal instance.
                    // If the modal.close() method is ever re-written to correctly handle multiple closings of the
                    // same dialog, then this can be removed.
                    $log.warn(e.message);
                } else {
                    e.message = '\n\tError in closeModal\n\t' + e.message;
                    $log.error(e);
                }
            }
        }
    };

    this.showStandardModalWindow = function(htmlTemplate) {
        var modalInstance = $modal.open({
            templateUrl: htmlTemplate,
            controller: 'modalInstanceCtrl'
        });

        modalInstance.result.then(
            function() {
                $log.log('modal closed ' + htmlTemplate);
            },
            function() {
                $log.log('modal dismissed ' + htmlTemplate);
            })
            ['finally'](function () {
                $log.log('Closed the modal box for '+ htmlTemplate);
            });
    };

    this.showStandardModalWindowFromTemplate = function(htmlTemplate) {
        var modalInstance = $modal.open({
            template: htmlTemplate,
            controller: 'modalInstanceCtrl'
        });

        modalInstance.result.then(
            function() {
                $log.log('modal closed ' + htmlTemplate);
            },
            function() {
                $log.log('modal dismissed ' + htmlTemplate);
            })
            ['finally'](function () {
                $log.log('Closed the modal box for '+ htmlTemplate);
            });
    };
});