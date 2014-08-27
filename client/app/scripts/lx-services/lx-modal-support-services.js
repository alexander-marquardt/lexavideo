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

        showModalWindow : function(templateUrl) {
            var modalInstance = $modal.open({
                templateUrl: templateUrl,
                controller: ModalInstanceCtrl
            });

            modalInstance.result.finally(function () {
                $log.log('Closed browser-is-not-supported modal box');
            });
        }
    };
});