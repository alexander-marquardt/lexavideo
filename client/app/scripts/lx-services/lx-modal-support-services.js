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


    // currentCameraAndMicrophoneModalInstance keeps track of the current and only showCameraAndMicrophoneModal dialog
    // currently open from lxModalSupportService. If this is not null, then a dialog is currently open
    // and currentCameraAndMicrophoneModalInstance contains a reference to the modalInstance object.
    var currentCameraAndMicrophoneModalInstance = null ;


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
                if (currentCameraAndMicrophoneModalInstance) {
                    // Only a single modal should be opened by this method at a time. Previous modals
                    // must be closed before opening a new one, or else we will end up stacking them
                    // on top of each other.
                    //
                    // Note: the following check is placed inside the opened() callback because we want to ensure that
                    // it checks currentCameraAndMicrophoneModalInstance after any previously executed close() callbacks have been executed.
                    // If the close() callback is placed in the event loop queue before the opened() callback, then this
                    // check will always be ran after the close() has completed, as long as close() was called before
                    // open. This should avoid any race conditions that might otherwise occur.
                    throw 'Error: currentCameraAndMicrophoneModalInstance must be null before attempting to open a new modal. ' +
                        'Did you forget to call closeCameraAndMicrophoneModal() before opening this modal?';
                }

                $log.log('Added modal box to modalsCurrentlyShown: '+ htmlTemplate);
                scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown.push(htmlTemplate);
                currentCameraAndMicrophoneModalInstance = modalInstance;
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
            }).
            finally(function () {
                // this is called when the modal is either "closed" or "dismissed"
                $timeout(function() {
                    // since this is inside a promise, it is outside of angular scope. We therefore wrap
                    // this in a $timeout so that angular will be notified of the update to the scope.

                    // remove the modal that we just closed from the modalsCurrentlyShown array
                    var arr = scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown;
                    arr.splice(arr.indexOf(htmlTemplate), 1);
                    $log.log('Removed modal box from modalsCurrentlyShown: '+ htmlTemplate);
                });

                // the modal has been closed and we are now in the callback of the close or dismiss function.
                // However, the currentCameraAndMicrophoneModalInstance has not been set to 'null'. By construction, the
                // modal that is closed in this callback should be pointed to by currentCameraAndMicrophoneModalInstance.
                // Set this value to null so that when we call closeCameraAndMicrophoneModal,
                // we will know that the modal has been closed. This is essentially a workaround that
                // is required because the modal service doesn't check to see if a modal has already been
                // closed before trying to close it again, and therefore generates an exception if close() is called.
                // Do not place this inside the $timeout so that it occurs immediately.
                currentCameraAndMicrophoneModalInstance = null;

            });
    };
    
    this.closeCameraAndMicrophoneModal = function() {
        if (currentCameraAndMicrophoneModalInstance) {
            $log.info('closing most recent modal');
            currentCameraAndMicrophoneModalInstance.close();
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
            }).
            finally(function () {
                $log.log('Closed the modal box for '+ htmlTemplate);
            });
    };


});