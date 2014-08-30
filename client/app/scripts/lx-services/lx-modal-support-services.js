/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';

var lxModalSupportServices = angular.module('lxModalSupport.services', []);

lxModalSupportServices.factory('lxModalSupportService', function ($modal, $log, $timeout) {
    /* Provides constant values that are used in various parts of the javascript code.
     */

    var ModalInstanceCtrl = function($scope, $log, $modalInstance) {
        $scope.ok = function () {
            $modalInstance.close();
        };
        $scope.cancel = function () {
            $modalInstance.close();
        };
    };

    return {

        showCameraAndMicrophoneModalWindow : function(scope, htmlTemplate, windowClass) {
            var modalInstance = $modal.open({
                templateUrl: htmlTemplate,
                controller: ModalInstanceCtrl,
                windowClass : windowClass
            });

            modalInstance.opened.then(
                function() {
                    scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown.push(htmlTemplate);
                }
            );

            modalInstance.result.then(
                function() {
                    //$log.log('modal closed ' + htmlTemplate);
                },
                function() {
                    //$log.log('modal dismissed ' + htmlTemplate);
                }).
                finally(function () {
                    $timeout(function() {
                        // since this is a callback, it is outside of angular scope. We therefore wrap
                        // this in a $timeout so that angular will be notified of the update to the scope.

                        // remove the modal that we just closed from the modalsCurrentlyShown array
                        var arr = scope.accessCameraAndMicrophoneObject.modalsCurrentlyShown;
                        arr.splice(arr.indexOf(htmlTemplate), 1);
                        $log.log('Closed the modal box for '+ htmlTemplate);
                    });
                });
            // returns an instance of the modal in case we need to manipulate it later
            return modalInstance;
        },

        showStandardModalWindow : function(htmlTemplate) {
            var modalInstance = $modal.open({
                templateUrl: htmlTemplate,
                controller: ModalInstanceCtrl
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
        }
    };
});