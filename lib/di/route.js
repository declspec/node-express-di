"use strict";

var _           = require("lodash"),
    mkerr       = require("../mkerr"),
    routerErr   = mkerr("$router");
    
var CONTROLLER_REGEXP = /:controller(\/|$)/,
    ACTION_REGEXP = /:action(\/|$)/;

module.exports = $RouteProvider;

function $RouteProvider() {
    var routes      = [],
        errors      = [],
        otherwise   = null,
        self        = this,
        methods =   [ "get", "post", "put", "delete", "all" ];
        
    // Map the various HTTP methods
    _.forEach(methods, function(method) {
        self[method] = function(path, route) {
            if ("undefined" === typeof(route)) {
                route = path;
                path = "/";
            }
            
            routes.push(createRouteConfig(path, method, route));
            return this;
        };
    })
    
    // Error handler (controller action should map to a req/res/next/error function or express will barf)
    this.error = function(route) {
        errors.push(createRouteConfig(null, "use", route));
        return this;
    };
    
    // Always runs last, useful for redirects to a known route or just handling the fallout (404 etc).
    this.otherwise = function(route) {
        otherwise = createRouteConfig("/", "use", route);
        return this;
    };
    
    // creates a restful resource to a specifc path
    // current only supports {
    //      controller: "Name",
    //      actions { post: "ActionName", put: "ActionName2" }
    // }
    //
    // Notation, but hopefully will expand soon.
    this.resource = function(path, resource) {
        // 'resource' should also contain configuration items, so just remove the resource-specific keys.
        var config = _.omit(resource, [ "actions" ])
            
        _.forEach(methods, function(method) {
            if (method in resource.actions) {
                // don't need to assigned to a 'new' object, as only the 'action'
                // key will be replaced each time.
                self[method](path, _.assign(config, {
                    action: resource.actions[method]
                }));
            }
        });
        
        return this;
    };

    this.$get = [ "$q", "$controller", "$filter", "$injector", "$resolve", "$express", function($q, $controller, $filter, $injector, $resolve, $express) {
        var resolved = false;

        return {
            resolve: function() {
                if (resolved)
                    return;
                    
                var i, j;
                resolved = true;
                    
                for(i = 0, j = routes.length; i < j; ++i) {
                    var route = routes[i];
                    $express[route.method.toLowerCase()](route.path, createStandardRoute(route));
                }
                
                // Create the 'otherwise' route if it exists
                if (otherwise)
                    $express[otherwise.method.toLowerCase()](otherwise.path, createStandardRoute(otherwise));
                
                // Create all the error routes last
                for(i = 0, j = errors.length; i < j; ++i) {
                    $express.use(createErrorRoute(errors[i]));
                }   
            }
        };
        
        function createStandardRoute(route) {
            // Plain old express callback function, just hand it straight over.
            if ("function" === typeof(route.action) && !isInvocable(route.action))
                return route;
                
            return function(req, res, next) { 
                return handleRequest(route, null, req, res, next);
            };
        }
        
        function createErrorRoute(route) {
            // Plain old express callback function, just hand it straight over.
            if ("function" === typeof(route.action) && !isInvocable(route.action))
                return route;
                
            return function(err, req, res, next) {
                return handleRequest(route, err, req, res, next);   
            }
        }
        
        function handleRequest(route, err, req, res, next) {
            var controller, action, filter, promise = false;
            
            // Redirect, easy peasy.
            if ("string" === typeof(route.redirectTo))
                return res.redirect(route.redirectTo);
                
            if (isInvocable(route.action))
                action = route.action;
            else {
                // Attempt to get the controller/action parameters from the URL, then from the route's defaults.
                controller = getController(req.params.controller || route.controller, route.path);
                action = getAction(controller, req.params.action || route.action, route.path);
                
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
                    return $injector.invoke(action, null, resolved);
                    
                // Plain express callback
                return action.length < 4
                    ? action.call(controller, req, res, next) 
                    : action.call(controller, err, req, res, next);  
            });
        }
        
        function getController(controllerName, routePath) {
            if (!controllerName)
                throw routerErr("noctrl", "No controller specified for route '{0}'.", routePath);
                
            var controller = $controller(controllerName); 
            if (!controller)
                throw routerErr("noctrl", "Controller '{0}' is not available! You either misspelled the controller name or forgot to declare it.", controllerName);  
                
            return controller;
        }
        
        function getAction(controller, actionName, routePath) {
            if (!controller.hasOwnProperty(actionName))
                return null; // no applicable action;
                
            var action = controller[actionName];
            if ("function" !== typeof(action))
                throw routerErr("noact", "Unrecognized action '{0}' on controller '{1}'", actionName, controller.name);
            
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
    
    function createRouteConfig(path, method, route) {
        var config = { 
            path: path,
            method: method,
            action: null
        };
        
        if (isAction(route))
            config.action = route; // Option 1: Route is an injectable or plain express callback, just store the action
        else {
            if ("object" === typeof(route))
                _.assign(config, route); // Option 2: Route is a configuration object
            else if ("string" === typeof(route)) {
                // Option 3: A simple string is provided, this indicates that it should
                // a) be a redirect path
                // b) fill either controller or action, in that order if they aren't available.
                if (route.indexOf("/") >= 0) 
                    config.redirectTo = route; // looks like a path, assume it's a redirect
                else if (!path)
                    throw routerErr("badrt", "A simple string route is not valid when no path is supplied with the route (route: '{0}')", route);
                else {
                    // check the path params and figure out which field should be filled
                    config[CONTROLLER_REGEXP.test(path) ? "action" : "controller"] = route;
                }
            }
            
            if ("string" !== typeof(config.redirectTo)) {
                // Set up the default action name if one isn't specified
                if (!config.action && (!path || !ACTION_REGEXP.test(path)))
                    config.action = "index";
                
                // Validate that the route actually has some sort of chance of working
                // after all of the configuration. This should help catch obvious errors
                // during setup rather than at runtime.
                if (!isAction(config.action) && (!config.controller && (!path || !CONTROLLER_REGEXP.test(path)))) 
                    throw routerErr("badrt", "Unresolvable route detected: no action or controller found (path: '{0}')", config.path);
            }
        }
        
        console.log("route created: ", config);
        return config;
    }
    
    function isInvocable(expr) {
        return expr && (Array.isArray(expr) || ("function" === typeof(expr) && "$inject" in expr));
    }
    
    function isAction(expr) {
        return isInvocable(expr) || "function" === typeof(expr);   
    }
}