'use strict';

/**
 * @ngdoc function
 * @name angularBaseApp.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the angularBaseApp
 */
angular.module('angularBaseApp')
  .controller('AboutCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];
  });
