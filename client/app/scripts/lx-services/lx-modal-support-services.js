/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';

var lxModalSupportServices = angular.module('lxModalSupport.services', []);

lxModalSupportServices.factory('lxModalSupportService', function ($modal, $log) {
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

        showModalWindow : function(scope, htmlTemplate, windowClass) {
            var modalInstance = $modal.open({
                templateUrl: htmlTemplate,
                controller: ModalInstanceCtrl,
                windowClass : windowClass
            });

            scope.accessCameraAndMicrophoneObject.modalIsShown[htmlTemplate] = true;

            modalInstance.result.then(
                function() {
                    $log.log('modal closed ' + htmlTemplate);
                },
                function() {
                    $log.log('modal dismissed ' + htmlTemplate);
                }).
                finally(function () {
                    scope.accessCameraAndMicrophoneObject.modalIsShown[htmlTemplate] = false;
                    $log.log('Closed the modal box for '+ htmlTemplate);
                });
            // returns an instance of the modal in case we need to manipulate it later
            return modalInstance;
        }
    };
});