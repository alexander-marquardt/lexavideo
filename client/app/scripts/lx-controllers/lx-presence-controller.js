angular.module('presence.controllers', ['presenceModule'])
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
    })
    .controller('presenceCtrl', function($log, $scope, presenceStatus) {
        $scope.presenceStatus = presenceStatus;

        presenceStatus.onChange(function(state) {
            $scope.text = state.name;
            $log.log('onChage: ' + state.name);
        });

        presenceStatus.ACTIVE.onEnter(function() {
           $log.log('Entering ACTIVE')
        });

        presenceStatus.ACTIVE.onLeave(function() {
            $log.log('Leaving ACTIVE');
        });
    });