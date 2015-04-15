
'use strict';

angular.module('lxPresence.controllers', [])
    .controller('lxPresenceCtrl', function($log, $scope, presenceStatus) {
        $scope.presenceStatus = presenceStatus;

        presenceStatus.onChange(function(state) {
            $scope.text = state.name;
            $log.log('onChange: ' + state.name);
        });

        presenceStatus.ACTIVE.onEnter(function() {
           $log.log('Entering ACTIVE');
        });

        presenceStatus.ACTIVE.onLeave(function() {
            $log.log('Leaving ACTIVE');
        });
    });