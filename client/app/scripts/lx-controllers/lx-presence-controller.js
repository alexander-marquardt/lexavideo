
'use strict';

angular.module('LxPresence.controllers', [])
    .controller('LxPresenceController', function($log, $scope, presenceStatus) {
        $scope.presenceStatus = presenceStatus;

        presenceStatus.onChange(function(state) {
            $scope.text = state.name;
            $log.log('onChange: ' + state.name);
        });

        presenceStatus.PRESENCE_ACTIVE.onEnter(function() {
           $log.log('Entering PRESENCE_ACTIVE');
        });

        presenceStatus.PRESENCE_ACTIVE.onLeave(function() {
            $log.log('Leaving PRESENCE_ACTIVE');
        });
    });