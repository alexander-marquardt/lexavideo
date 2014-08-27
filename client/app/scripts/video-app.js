'use strict';
var videoApp = angular.module('videoApp', [
    'lxServerConstants.services', 'lxCheckCompatibility.services',
    'lxModalSupport.services', 'lxAccessSystemResources.directives',
    'videoApp.directives', 'checkCompatibility.directives',
    'videoApp.services', 'asciiVideo.directives',

    'ngAnimate', 'ui.bootstrap']);

videoApp.run(function() {

});