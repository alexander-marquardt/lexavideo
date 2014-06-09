'use strict';

/**
 * @ngdoc function
 * @name angularBaseApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the angularBaseApp
 */
angular.module('angularBaseApp')
  .controller('MainCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];
  });
