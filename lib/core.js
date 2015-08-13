"use strict";

var $RouteProvider = require("./route");

module.exports = function neiModule(di) {
    var nei = di.module("nei", ["ndi"]);
    
    nei.provider("$route", $RouteProvider);
    
    return nei;
};