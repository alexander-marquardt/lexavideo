/**
 * Created by alexandermarquardt on 2014-11-13.
 */

'use strict';

/* The following workaround is necessary for IE9 and earlier because the window.console is not available
 * unless the debugger is enabled. For builds that have window.console defined this should have no effect.*/
if (!window.console) {
    var console = {};
}
if (!console.log) {
    console.log = function() {};
}