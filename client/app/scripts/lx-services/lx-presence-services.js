
'use strict';

angular.module('lxPresence.services', ['presenceModule'])
    .factory('presenceStatus', function($presence) {
        return $presence.init({
            ACTIVE : {
                enter: 0,
                initial: true
            },
            IDLE : {
                enter: 30 * 1000 // 30 seconds
            },
            AWAY : {
                enter: 5 * 60 * 1000 // 5 minutes
            }
        });
    });