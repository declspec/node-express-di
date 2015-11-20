"use strict";

// Taken directly from AngularJS. I take no credit for this work; I merely patched it up to work with node and renamed
// it to fit my own naming preferences

// https://github.com/angular/angular.js/blob/master/src/minErr.js

/**
 * @description
 *
 * This object provides a utility for producing rich Error messages within
 * Angular. It can be called as follows:
 *
 * var exampleMinErr = mkerr('example');
 * throw exampleMinErr('one', 'This {0} is {1}', foo, bar);
 *
 * The above creates an instance of mkerr in the example namespace. The
 * resulting error will have a namespaced error code of example.one.  The
 * resulting error will replace {0} with the value of foo, and {1} with the
 * value of bar. The object is not restricted in the number of arguments it can
 * take.
 *
 * If fewer arguments are specified than necessary for interpolation, the extra
 * interpolation markers will be preserved in the final string.
 *
 * Since data will be parsed statically during a build step, some restrictions
 * are applied with respect to how mkerr instances are created and called.
 * Instances should have names of the form namespaceMinErr for a mkerr created
 * using mkerr('namespace') . Error codes, namespaces and template strings
 * should all be static strings, not variables or general expressions.
 *
 * @param {string} module The namespace to use for the new mkerr instance.
 * @param {function} ErrorConstructor Custom error constructor to be instantiated when returning
 *   error from returned function, for cases when a particular type of error is useful.
 * @returns {function(code:string, template:string, ...templateArgs): Error} mkerr instance
 */

module.exports = function mkerr(module, ErrorConstructor) {
    ErrorConstructor = ErrorConstructor || Error;
    
    return function () {
        var SKIP_INDEXES = 2;

        var templateArgs = arguments,
          code = templateArgs[0],
          message = '[' + (module ? module + ':' : '') + code + '] ',
          template = templateArgs[1];

        message += template.replace(/\{\d+\}/g, function (match) {
            var index = +match.slice(1, -1),
              shiftedIndex = index + SKIP_INDEXES;

            if (shiftedIndex < templateArgs.length) {
                return toDebugString(templateArgs[shiftedIndex]);
            }

            return match;
        });

        // Snipped out the angular linkback.
        
        return new ErrorConstructor(message);
    };
}

function maskInternal(key, value) {
    return (typeof(key) === 'string' && key.charAt(0) === '$' && key.charAt(1) === '$')
        ? undefined // hide internal variables
        : value;
}

function serializeObject(obj) {
    var seen = [];

    return JSON.stringify(obj, function (key, val) {
        val = maskInternal(key, val);
        if (typeof(val) === "object") {
            if (seen.indexOf(val) >= 0) 
                return '<<already seen>>';
            seen.push(val);
        }
        return val;
    });
}

function toDebugString(obj) {
    if (typeof obj === 'function') {
        return obj.toString().replace(/ \{[\s\S]*$/, '');
    } else if (typeof obj === 'undefined') {
        return 'undefined';
    } else if (typeof obj !== 'string') {
        return serializeObject(obj);
    }
    return obj;
}
