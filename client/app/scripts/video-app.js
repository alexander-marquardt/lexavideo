'use strict';
var videoApp = angular.module('videoApp', [
    'lxServerConstants.services', 'lxLocalConstants.services',
    'lxModalSupport.services',
    'videoApp.directives', 'checkCompatibility.directives',
    'videoApp.services', 'asciiVideo.directives',

    'ngAnimate', 'ui.bootstrap']);

videoApp.run(function() {

});