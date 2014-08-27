/**
 * Created by alexandermarquardt on 2014-08-27.
 */

'use strict';
/* global $ */

var lxConstantsServices = angular.module('lxLocalConstants.services', []);

lxConstantsServices.factory('lxConstantsService', function () {
    /* Provides constant values that are used in various parts of the javascript code.
     */
    return {
        UNSUPPORTED_DEVICES : $.browser.ipad || $.browser.iphone,
        SUPPORTED_BROWSERS : $.browser.mozilla || $.browser.chrome || $.browser.opera
    };
});