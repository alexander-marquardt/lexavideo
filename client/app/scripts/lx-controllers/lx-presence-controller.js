angular.module('presence.controllers', ['presenceModule'])
    .factory('states', function($presence) {
        return $presence.init({
            ACTIVE : {
                enter: 0
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
    .controller('presenceCtrl', function($log, $scope, states) {
        $scope.states = states;

        states.onChange(function(state) {
            $scope.text = state.name;
            $log.log('onChage: ' + state.name);
        });

        states.ACTIVE.onEnter(function() {
           $log.log('Entering ACTIVE')
        });

        states.ACTIVE.onLeave(function() {
            $log.log('Leaving ACTIVE');
        });
    });