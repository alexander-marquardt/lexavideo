
'use strict';

angular.module('lxPresence.services', ['presenceModule'])
    .factory('presenceStatus', function($presence) {
        return $presence.init({
            PRESENCE_ACTIVE : {
                enter: 0,
                initial: true
            },
            PRESENCE_IDLE : {
                enter: 30 * 1000 // 30 seconds
            },
            PRESENCE_AWAY : {
                enter: 5 * 60 * 1000 // 5 minutes
            }
        });
    });