angular.module('lxPresence.services', ['presenceModule'])
    .factory('presenceStatus', function($presence) {
        return $presence.init({
            ACTIVE : {
                enter: 0,
                initial: true
            },
            IDLE : {
                enter: 2000
            },
            SHORTAWAY : {
                enter: 5000
            },
            LONGAWAY : {
                enter: 10000
            }
        });
    });