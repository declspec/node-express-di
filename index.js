"use strict";

var di  = require("node-di"),
    nei = require("./lib/core")(di); 

var DEFAULT_CONFIGURATION = {
    strictDi: true
};

module.exports = {
    module:	    di.module,
    injector:   di.injector,
    
    bootstrap: function(express, modules, config) {
        if ("object" !== typeof(config))
            config = {};
        
        if (express.injector) 
            throw new Error("Application has already been bootstrapped with this express instance");
        
        modules = modules || [];
        
        // Create a 'value' provider for the express component so we can inject it
        modules.unshift(["$provide", function($provide) {
            $provide.value("$express", express);
        }]);
        
        // force load the core modules first
        modules.unshift("nei");

        // create the injector
        var injector = di.injector(modules, config.strictDi);
        
        // add a custom module to hook into express's middleware
        injector.invoke([ "$injector", "$route", function($injector, $route) {
            $injector.invoke($route.$$resolve);
        }]);
        
        return injector;
    }
};