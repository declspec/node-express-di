"use strict";

module.exports = function coreModule(di) {
    // Extend the node-di core module
    var mod = di.module("di");
    
    mod.provider("$route", require("./di/route"));

    return mod;
};