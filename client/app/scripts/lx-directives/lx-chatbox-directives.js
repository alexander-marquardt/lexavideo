/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';



angular.module('lxChatbox.directives', [])

    .directive('lxShowChatMessagesDirective',

    function() {
        return {
            restrict: 'A',
            link: function (scope, elem) {

                var addMessageToDisplay = function(message) {

                    var messageHtml = angular.element('<div  class="row cl-chat-row">');

                    messageHtml.append(angular.element('<div class="col-xs-3 col-md-2 text-left">')
                            .append('<span class="icon-lx-chat-bubble-left-cfg clearfix">')
                            .append(angular.element('<small class="text-muted clearfix"><span class="icon-lx-time">')
                                .append('time')
                        )
                    );
                    messageHtml.append(angular.element('<div class="col-xs-9 col-md-10 chat-body text-right">').append(message));

                    elem.append(messageHtml);
                    elem.append('<div class="cl-chat-divider">');


                };

                // watch to see if the local user has sent a new chat message to the remote user
                scope.$watch('sendMessageString', function(newValue) {
                    addMessageToDisplay(newValue);
                });
            }
        };
    }
);