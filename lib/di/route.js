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
    
    this.all = function(path, route) {
        route.method = "all";
        return this.when(path, route); 
    };
    
    // Error handler (controller action should map to a req/res/next/error function or express will barf)
    this.error = function(fn) {
        if ("function" !== typeof(fn) || fn.length < 4)
            routerErr("badrt", "Invalid error handler provided. Expected a function that matches function(req, res, next, err).");
            
        errors.push(invokeLater(fn));
        return this;
    };
    
    // Always runs last, useful for redirects to a known route or just handling the fallout (404 etc).
    this.otherwise = function(params) {
        if ("string" === typeof(params)) {
            params = { redirectTo: params };
        }
        
        otherwise = invokeLater(params);
        return this;
    };
    
    this.$get = [ "$q", "$controller", "$filter", "$injector", function($q, $controller, $filter, $injector) {
        return {
            "$$resolve": [ "$express", function($express) {
                var allRoutes = routes.concat(errors),
                    later;
                    
                allRoutes.push(otherwise);
                
                for(var i=0,j=allRoutes.length; i<j; ++i) {
                    if (!(later = allRoutes[i])) 
                        continue;
                    
                    var path = later[0],
                        route = later[1],
                        method = (route.method || "use").toLowerCase();

                    $express[method](path, createRoute(route));
                }
            }]
        };
        
        function createRoute(route) {
            if ("function" === typeof(route))
                return route;
                
            return function(req, res, next) {
                // Redirect, easy peasy.
                if (route.redirectTo)
                    return res.redirect(route.redirectTo);
                
                // Attempt to get the controller/action parameters from the URL, then from the route's defaults.
                var action = getControllerAction(req.params.controller || route.controller, req.params.action || route.action, route.path),
                    filter = getFilter(route.filter);
                    
                if (filter === null)
                    action(req, res, next);
                else {
                    $q.when(filter(req, res)).then(function(handled) {
                        if (!handled)
                            action(req, res, next);
                    });   
                }
            };
        }
        
        function getControllerAction(controllerName, actionName, routePath) {
            if (!controllerName)
                throw routerErr("noctrl", "No controller specified for route '{0}'.", routePath);
                
            var controller = $controller(controllerName); 
            if (!controller)
                throw routerErr("noctrl", "Controller '{0}' is not available! You either misspelled the controller name or forgot to declare it.", controllerName);  
            
            var action = controller[actionName || "index"];
            if ("function" !== typeof(action))
                throw routerErr("noact", "Unrecognized action '{0}' on controller '{1}'", actionName, controller);
            
            return action;    
        }
        
        function getFilter(filterArg, routePath) {
            if (!filterArg)
                return null;
                
            var filter = "function" === typeof(filterArg) || Array.isArray(filterArg)
                ? $injector.invoke(filterArg)
                : $filter(filterArg);  
            
            if ("function" !== typeof(filter))
                throw routerErr("badflt", "Filter factory did not yield a valid function in route '{0}'", routePath);
            
            return filter;
        }
    }];
    
    
    function invokeLater(path, route) {
        if ("string" !== typeof(path) && "undefined" === typeof(route)) {
            route = path;
            path = "/";
        }
            
        var routeType = typeof(route);
        route.path = path;
        
        if ("object" !== routeType && "function" !== routeType)
            throw routerErr("badrt", "Invalid route provided for '{0}', expected an object or function, got '{1}'", path, typeof(route));
 
        return [ path, route ];
    }
}