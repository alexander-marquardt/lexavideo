'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxShowMiniVideoElementDirective',
    function()
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {

                elem.empty();

                var clientId = scope.clientId;

                 if (clientId === 'localVideoElement') {
                    elem.append(scope.localVideoObject.localMiniVideoElem);
                }
                // otherwise this is a remote video element.
                else {
                    elem.append(scope.remoteVideoElementsDict[clientId].remoteMiniVideoElem);
                }
            }
        };
    }
);


videoAppDirectives.directive('lxDisplayVideoElementDirective',
    function()
    {
        return {
            restrict : 'A',

            link: function(scope, elem, attrs) {
                var selectedVideoElementId = attrs.selectedVideoElementId;
                elem.empty();
                if (selectedVideoElementId === 'localVideoElement') {
                    elem.append(scope.localVideoObject.localBigVideoElem);
                } else {
                    elem.append(scope.remoteVideoElementsDict[selectedVideoElementId].remoteBigVideoElem);
                }
            }
        };
    }
);





