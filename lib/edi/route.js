"use strict";

module.exports = $RouteProvider;

function $RouteProvider() {
    var routes      = [],
        errors      = [],
        otherwise   = null;

    this.when = function(path, route) {
        routes.push(invokeLater(path, route));
        return this;
    };
    
    this.error = function(route) {
        errors.push(invokeLater(null, route));
        return this;
    };
    
    this.otherwise = function(params) {
        if ("string" === typeof(params)) {
            params = { redirectTo: params };
        }
        
        otherwise = invokeLater(null, params);
    };
    
    this.$get = function() {
        return {
            "$$resolve": [ "$express", "$controller", function($express, $controller) {
                var allRoutes = routes.concat(errors);
                allRoutes.push(otherwise);
                
                for(var i=0,j=allRoutes.length; i<j; ++i) {
                    if (allRoutes[i])
                        allRoutes[i]($express, $controller);
                }
            }]
        };
    };
    
    function invokeLater(path, route) {
        return function($express, $controller) {
            var fn, args = [];
            
            if (!path || route.method === "use")
                fn = $express.use;
            else {
                fn = $express[route.method || "all"];
                args.push(path);
            }
            
            if (!route.controller) 
                args.push(redirect(route.redirectTo));
            else {
                var controller = $controller(route.controller);
                args.push(route.action ? controller[route.action] : controller);
            }

            fn.apply($express, args);
        };
    }
    
    function redirect(path) {
        return function(req, res, next) {
            res.redirect(path);
        }
    }
}