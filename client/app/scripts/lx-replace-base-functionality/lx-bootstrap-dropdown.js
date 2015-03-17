/**
 * Created by alexandermarquardt on 2015-03-16.
 * This file is a replacement for the ui.bootstrap.dropdown module, which does not do things in the
 * exact manner that we would like it to.
 */

angular.module('lx.ui.bootstrap.dropdown', [])

.constant('lxDropdownConfig', {
  openClass: 'open'
})

.service('lxDropdownService', ['$document', function($document) {
  var openScope = null;

  this.open = function( lxDropdownScope ) {
    if ( !openScope ) {
//      $document.bind('click', closeDropdown);
//      $document.bind('keydown', escapeKeyBind);
    }

    if ( openScope && openScope !== lxDropdownScope ) {
        openScope.isOpen = false;
    }

    openScope = lxDropdownScope;
  };

  this.close = function( lxDropdownScope ) {
    if ( openScope === lxDropdownScope ) {
      openScope = null;
      $document.unbind('click', closeDropdown);
      $document.unbind('keydown', escapeKeyBind);
    }
  };

  var closeDropdown = function( evt ) {
    if (evt && evt.isDefaultPrevented()) {
        return;
    }

    openScope.$apply(function() {
      openScope.isOpen = false;
    });
  };

  var escapeKeyBind = function( evt ) {
    if ( evt.which === 27 ) {
      openScope.focusToggleElement();
      closeDropdown();
    }
  };
}])

.controller('lxDropdownController', ['$scope', '$attrs', '$parse', 'lxDropdownConfig', 'lxDropdownService', '$animate', function($scope, $attrs, $parse, lxDropdownConfig, lxDropdownService, $animate) {
  var self = this,
      scope = $scope.$new(), // create a child scope so we are not polluting original one
      openClass = lxDropdownConfig.openClass,
      getIsOpen,
      setIsOpen = angular.noop,
      toggleInvoker = $attrs.onToggle ? $parse($attrs.onToggle) : angular.noop;

  this.init = function( element ) {
    self.$element = element;

    if ( $attrs.isOpen ) {
      getIsOpen = $parse($attrs.isOpen);
      setIsOpen = getIsOpen.assign;

      $scope.$watch(getIsOpen, function(value) {
        scope.isOpen = !!value;
      });
    }
  };

  this.toggle = function( open ) {
    return scope.isOpen = arguments.length ? !!open : !scope.isOpen;
  };

  // Allow other directives to watch status
  this.isOpen = function() {
    return scope.isOpen;
  };

  scope.focusToggleElement = function() {
    if ( self.toggleElement ) {
      self.toggleElement[0].focus();
    }
  };

  scope.$watch('isOpen', function( isOpen, wasOpen ) {
    $animate[isOpen ? 'addClass' : 'removeClass'](self.$element, openClass);

    if ( isOpen ) {
      scope.focusToggleElement();
      lxDropdownService.open( scope );
    } else {
      lxDropdownService.close( scope );
    }

    setIsOpen($scope, isOpen);
    if (angular.isDefined(isOpen) && isOpen !== wasOpen) {
      toggleInvoker($scope, { open: !!isOpen });
    }
  });

  $scope.$on('$locationChangeSuccess', function() {
    scope.isOpen = false;
  });

  $scope.$on('$destroy', function() {
    scope.$destroy();
  });
}])

.directive('lxDropdown', function() {
  return {
    restrict: 'CA',
    controller: 'lxDropdownController',
    link: function(scope, element, attrs, lxDropdownCtrl) {
      lxDropdownCtrl.init( element );
    }
  };
})

.directive('lxDropdownToggle', function() {
  return {
    restrict: 'CA',
    require: '?^lxDropdown',
    link: function(scope, element, attrs, lxDropdownCtrl) {
      if ( !lxDropdownCtrl ) {
        return;
      }

      lxDropdownCtrl.toggleElement = element;

      var toggleDropdown = function(event) {
        event.preventDefault();

        if ( !element.hasClass('disabled') && !attrs.disabled ) {
          scope.$apply(function() {
            lxDropdownCtrl.toggle();
          });
        }
      };

      element.bind('click', toggleDropdown);

      // WAI-ARIA
      element.attr({ 'aria-haspopup': true, 'aria-expanded': false });
      scope.$watch(lxDropdownCtrl.isOpen, function( isOpen ) {
        element.attr('aria-expanded', !!isOpen);
      });

      scope.$on('$destroy', function() {
        element.unbind('click', toggleDropdown);
      });
    }
  };
});