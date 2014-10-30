/**
 * Created by alexandermarquardt on 2014-10-29.
 */
'use strict';



angular.module('lxChatbox.directives', [])

    .directive('lxShowChatMessagesDirective',

    function($compile) {
        return {
            restrict: 'A',
            link: function (scope, elem) {

                var addMessageToDisplay = function(message) {

                    var outerElement = angular.element('<div class="cl-transparent cl-show-hide-fade">');
                    var messageElement = angular.element('<div  class="row cl-chat-row">');

                    messageElement.append(angular.element('<div class="col-xs-3 col-md-2 text-left">')
                            .append('<span class="icon-lx-chat-bubble-left-cfg clearfix">')
                            .append(angular.element('<small class="text-muted clearfix"><span class="icon-lx-time">')
                                .append('time')
                        )
                    );
                    messageElement.append(angular.element('<div class="col-xs-9 col-md-10 chat-body text-right">').append(message));
                    outerElement.append(messageElement);
                    outerElement.append('<div class="cl-chat-divider">');

                    var compiledElement = $compile(outerElement)(scope);
                    elem.append(compiledElement);
                    scope.scrollToChatboxScrollAnchor();
                    outerElement.removeClass('cl-transparent');
                    outerElement.addClass('cl-make-opaque');
                };

                // watch to see if the local user has sent a new chat message to the remote user
                scope.$watch('sendMessageString', function(newValue) {
                    if (newValue) {
                        addMessageToDisplay(newValue);
                    }
                });
            }
        };
    }
);