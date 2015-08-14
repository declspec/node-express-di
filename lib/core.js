"use strict";

var $RouteProvider = require("./di/route");

module.exports = function coreModule(diModule) {
    // Extend the node-di core module
    var di = diModule("di");
    
    di.provider("$route", $RouteProvider);
    
    return di;
};