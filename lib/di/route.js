"use strict";

var mkerr       = require("../mkerr"),
    routerErr   = mkerr("$router");

module.exports = $RouteProvider;

function $RouteProvider() {
    var routes      = [],
        errors      = [],
        otherwise   = null;

    // base handler
    this.when = function(path, route) {
        routes.push(invokeLater(path, route));
        return this;
    };
    
    // HTTP method helpers
    this.delete = function(path, route) {
        route.method = "delete";
        return this.when(path, route);
    };
    
    this.put = function(path, route) {
        route.method = "put";
        return this.when(path, route);
    };
    
    this.get = function(path, route) {
        route.method = "get";
        return this.when(path, route);
    };
    
    this.post = function(path, route) {
        route.method = "post";
        return this.when(path, route);
    };
    
    // Error handler (controller action should map to a req/res/next/error function or express will barf)
    this.error = function(route) {
        errors.push(invokeLater(null, route));
        return this;
    };
    
    // Always runs last, useful for redirects to a known route or just handling the fallout (404 etc).
    this.otherwise = function(params) {
        if ("string" === typeof(params)) {
            params = { redirectTo: params };
        }
        
        otherwise = invokeLater(null, params);
        return this;
    };
    
    this.$get = function() {
        return {
            "$$resolve": [ "$express", "$controller", function($express, $controller) {
                var allRoutes = routes.concat(errors),
                    later;
                    
                allRoutes.push(otherwise);
                
                for(var i=0,j=allRoutes.length; i<j; ++i) {
                    if (!(later = allRoutes[i])) 
                        continue;
                    
                    var fn,
                        args = [],
                        path = later[0],
                        route = later[1];
                        
                    if (!path || route.method === "use")
                        fn = $express.use;
                    else {
                        fn = $express[(route.method || "all").toLowerCase()];
                        args.push(path);
                    }
                    
                    if (!route.controller)
                        args.push(redirect(route.redirectTo));
                    else {
                        var controller = $controller(route.controller),
                            action = controller[route.action || "index"];
                            
                        if (!controller)
                            throw routerErr("noctrl", "Controller '{0}' is not available! You either misspelled the controller name or forgot to declare it.", route.controller);
                        
                        if ("function" !== typeof(action))
                            throw routerErr("noact", "Unrecognized action '{0}' on controller '{1}'", route.action || "index", route.controller);
                            
                        args.push(action);
                    }

                    fn.apply($express, args);
                }
            }]
        };
    };
    
    function invokeLater(path, route) {
        if (!route || "object" !== typeof(route))
            throw routerErr("badrt", "Invalid route provided for '{0}', expected an object, got '{1}'", path, typeof(route));
    
        if (!route.controller && !route.redirectTo)
            throw routerErr("badrt", "Bad route provided, expected at least one of 'controller' or 'redirectTo' to be set");
            
        return [ path, route ];
    }
    
    function redirect(path) {
        return function(req, res, next) {
            res.redirect(path);
        }
    }
}