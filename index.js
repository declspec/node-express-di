"use strict";

var di  = require("node-di");

var DEFAULT_CONFIGURATION = {
    strictDi: true
};

// Register the core components
require("./lib/core")(di.module);

module.exports = {
    module:	    di.module,
    injector:   di.injector,
    
    bootstrap: function(express, modules, config) {
        if ("object" !== typeof(config))
            config = {};
        
        if (express.injector) 
            throw new Error("Application has already been bootstrapped with this express instance");
        
        modules = modules || [];
        
        // Create a 'value' provider for the express component so we can inject it into other services
        modules.unshift(["$provide", function($provide) {
            $provide.value("$express", express);
        }]);
        
        // force load the core modules first
        modules.unshift("di");

        // create the injector
        var injector = express.injector = di.injector(modules, config.strictDi);
        
        // add an injected hook into express's middleware
        injector.invoke(injector.get("$route").$$resolve);
        
        return injector;
    }
};