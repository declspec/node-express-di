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
    
    this.$get = [ "$controller", "$filter", "$injector", function($controller, $filter, $injector) {
        return {
            "$$resolve": [ "$express", function($express) {
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
                    
                    // Register controller and filters
                    if (!route.controller) {
                        args.push("function" === typeof(route) ? route : redirect(route.redirectTo));
                        fn.apply($express, args);
                    }
                    else {
                        // Register the filter before the controller so that it can intercept.
                        if (route.filter) 
                            fn.apply($express, createFilterIntercept(args, route.filter));
                        
                        args.push(getControllerAction(route.controller, route.action || "index"));
                        fn.apply($express, args);
                    }
                }
            }]
        };
        
        function createFilterIntercept(args, filter) {
            var argCopy = args.slice(0),
                filterFn = "function" === typeof(filter) || Array.isArray(filter)
                    ? $injector.invoke(filter)
                    : $filter(filter);
                    
            if ("function" !== typeof(filterFn))
                throw routerErr("badflt", "Filter factory did not yield a valid function");
            
            argCopy.push(filterFn);
            return argCopy;
        }
        
        function getControllerAction(controller, actionName) {
            var controller = $controller(controller),
                action = controller[actionName];
                
            if (!controller)
                throw routerErr("noctrl", "Controller '{0}' is not available! You either misspelled the controller name or forgot to declare it.", route.controller);
            
            if ("function" !== typeof(action))
                throw routerErr("noact", "Unrecognized action '{0}' on controller '{1}'", actionName, controller);
            
            return action;    
        }
    }];
    
    function invokeLater(path, route) {
        var routeType = typeof(route);
        
        if ("object" !== routeType && "function" !== routeType)
            throw routerErr("badrt", "Invalid route provided for '{0}', expected an object or function, got '{1}'", path, typeof(route));
    
        if ("object" === routeType && (!route.controller && !route.redirectTo))
            throw routerErr("badrt", "Bad route provided, expected at least one of 'controller' or 'redirectTo' to be set");
            
        return [ path, route ];
    }
    
    function redirect(path) {
        return function(req, res, next) {
            res.redirect(path);
        };
    }
}