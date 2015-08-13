"use strict";

var $RouteProvider = require("./route");

module.exports = function coreModule(di) {
    var edi = di.module("edi", ["di"]);
    
    edi.provider("$route", $RouteProvider);
    
    return edi;
};