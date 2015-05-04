'use strict';

var videoAppDirectives = angular.module('lxMainVideo.directives', []);

// define externally defined variables so that jshint doesn't give warnings



videoAppDirectives.directive('lxShowMiniVideoElementDirective',
    function(
        lxAdapterService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {

                var clientId = scope.clientId;

                if (clientId === 'localVideoElement') {
                    elem.html(scope.localVideoObject.localMiniVideoElem);
                    lxAdapterService.reattachMediaStream(scope.localVideoObject.localMiniVideoElem, scope.localVideoObject.localMiniVideoElem);
                }
                // otherwise this is a remote video element.
                else {
                    var remoteVideoObject = scope.remoteVideoElementsDict[clientId];
                    elem.html(remoteVideoObject.remoteMiniVideoElem);
                    lxAdapterService.reattachMediaStream(remoteVideoObject.remoteMiniVideoElem, remoteVideoObject.remoteMiniVideoElem)
                }
            }
        };
    }
);


videoAppDirectives.directive('lxDisplayVideoElementDirective',
    function(
        lxAdapterService
        )
    {
        return {
            restrict : 'A',

            link: function(scope, elem) {
                scope.$watch('videoDisplaySelection.currentlySelectedVideoElementId',
                    function(selectedVideoElementId) {
                        if (selectedVideoElementId === 'localVideoElement') {
                            elem.html(scope.localVideoObject.localBigVideoElem);
                            lxAdapterService.reattachMediaStream(scope.localVideoObject.localBigVideoElem, scope.localVideoObject.localMiniVideoElem);
                        } else {
                            var remoteVideoObject = scope.remoteVideoElementsDict[selectedVideoElementId];
                            elem.html(remoteVideoObject.remoteBigVideoElem);
                            lxAdapterService.reattachMediaStream(remoteVideoObject.remoteBigVideoElem, remoteVideoObject.remoteMiniVideoElem)
                        }
                    }
                );
            }
        };
    }
);





