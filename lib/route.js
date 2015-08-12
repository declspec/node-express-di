"use strict";

module.exports = $RouteProvider;
module.exports.$inject = [ "$express" ];

function $RouteProvider($injector, $express) {

    return function attach(method, path, route) {
        $express[method].call($express, function(req, res, next) {
 
        });
    };

    
    this.get = handle("get");
    this.post = handle("post");
    
    this.post = function(path, route) {
        return attach("post", path, route)
    }
};