
'use strict';

angular.module('lxPresence.controllers', [])
    .controller('lxPresenceCtrl', function($log, $scope, presenceStatus) {
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