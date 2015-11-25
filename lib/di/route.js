"use strict";

var _           = require("lodash"),
    mkerr       = require("../mkerr"),
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
    this.error = function(route) {
        errors.push(invokeLater(route));
        return this;
    };
    
    // Always runs last, useful for redirects to a known route or just handling the fallout (404 etc).
    this.otherwise = function(params) {
        if ("string" === typeof(params)) 
            params = { redirectTo: params };

        otherwise = invokeLater(params);
        return this;
    };
    
    this.$get = [ "$q", "$controller", "$filter", "$injector", "$resolve", function($q, $controller, $filter, $injector, $resolve) {
        return {
            "$$resolve": [ "$express", function($express) {
                // Build all the standard routes first
                var standardRoutes = otherwise ? routes.concat([otherwise]) : routes.slice(),
                    i, j;
                    
                for(i = 0, j = standardRoutes.length; i < j; ++i) {
                    var current = standardRoutes[i],
                        route = current[1],
                        method = (route.method || "use").toLowerCase();
                        
                    $express[method](current[0], createStandardRoute(route));
                }
                
                // Create all the error routes last
                for(i = 0, j = errors.length; i < j; ++i) {
                    $express.use(createErrorRoute(errors[i][1]));
                }
            }]
        };
        
        function createStandardRoute(route) {
            // Plain old express callback function, just hand it straight over.
            if ("function" === typeof(route) && !isInvocable(route))
                return route;
                
            return function(req, res, next) { 
                return handleRequest(route, null, req, res, next);
            };
        }
        
        function createErrorRoute(route) {
            // Plain old express callback function, just hand it straight over.
            if ("function" === typeof(route) && !isInvocable(route))
                return route;
                
            return function(err, req, res, next) {
                return handleRequest(route, err, req, res, next);   
            }
        }
        
        function handleRequest(route, err, req, res, next) {
            var action, filter, promise = false;
            
            // Redirect, easy peasy.
            if (route.redirectTo)
                return res.redirect(route.redirectTo);
                
            if (isInvocable(route))
                action = route;
            else {
                // Attempt to get the controller/action parameters from the URL, then from the route's defaults.
                action = getControllerAction(req.params.controller || route.controller, req.params.action || route.action, route.path);
                // If no action is found, skip this handler
                if (action === null)
                    return next();
            
                filter = getFilter(route.filter);
                promise = filter && filter(req, res);
            }

            var locals = { err: err, req: req, res: res, next: next };
            
            $q.when(promise, function(handled) {
                return !handled
                    ? (route.resolve ? $resolve.resolve(route.resolve, locals) : locals)
                    : null;
            }).done(function(resolved) {
                if (resolved === null)
                    return; // request already handled
                
                // Defer to the injector if possible
                if (isInvocable(action))
                    return $injector.invoke(action, null, locals);
                    
                // This should be a relatively rare case, only occurs
                // when a 'resolve' object is found on a route with
                // and action that doesn't make use of the resolved values.
                return action.length < 4
                    ? action(req, res, next) 
                    : action(err, req, res, next);  
            });
        }
        
        function getControllerAction(controllerName, actionName, routePath) {
            if (!controllerName)
                throw routerErr("noctrl", "No controller specified for route '{0}'.", routePath);
                
            var controller = $controller(controllerName); 
            if (!controller)
                throw routerErr("noctrl", "Controller '{0}' is not available! You either misspelled the controller name or forgot to declare it.", controllerName);  
            
            if (!controller.hasOwnProperty(actionName))
                return null; // no applicable action;
                
            var action = controller[actionName];
            if ("function" !== typeof(action))
                throw routerErr("noact", "Unrecognized action '{0}' on controller '{1}'", actionName, controllerName);
            
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
            throw routerErr("badrt", "Invalid route provided for '{0}', expected an object, array or function, got '{1}'", path, typeof(route));
 
        return [ path, route ];
    }
    
    function isInvocable(expr) {
        return Array.isArray(expr) || ("function" === typeof(expr) && "$inject" in expr);
    }
}