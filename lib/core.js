"use strict";

module.exports = function coreModule(diModule) {
    // Extend the node-di core module
    var di = diModule("di");
    
    di.provider("$route", require("./di/route"));

    return di;
};