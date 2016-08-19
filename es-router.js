'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EsRouter = function () {
  function EsRouter(_ref) {
    var _this = this;

    var useHash = _ref.useHash;
    var routes = _ref.routes;
    var notStrictRouting = _ref.notStrictRouting;
    var home = _ref.home;
    var base = _ref.base;

    _classCallCheck(this, EsRouter);

    this.events = {
      startRouteChange: [],
      finishRouteChange: [],
      paramChange: []
    };
    this.useHash = useHash;
    this.routes = routes;
    this.base = base;
    this.notStrictRouting = notStrictRouting;
    this.queryParams = this.getParamsFromUrl();

    if (base[base.length - 1] === '/') {
      this.base = this.base.substring(0, this.base.length - 1);
    }

    //get base if needed
    if (!base && !useHash) {
      var _base = document.getElementsByTagName('base')[0] && document.getElementsByTagName('base')[0].href || '';
      this.base = _base.split(window.location.origin)[1];
    }

    //create initial object based on passed in params
    this.allRoutes = Object.assign(routes, {}).reduce(function (prev, route) {
      if (route.name === home) {
        _this.home = route;
      }
      if (route.variablePath) {
        throw new Error('route objects cannot be initialized with a key of variablePath');
      }
      var pathSplit = route.route.split('/').filter(function (item) {
        return item;
      });
      var routeSplitNumbers = pathSplit.length;
      var variablePathIndex = pathSplit.reduce(function (prev, route, index) {
        //check is route is a variable path
        var variable = {
          id: route.split(':')[1],
          index: index
        };
        return route.includes(':') ? [].concat(_toConsumableArray(prev), [variable]) : [].concat(_toConsumableArray(prev));
      }, []);
      route.variablePath = variablePathIndex;
      if (!prev[routeSplitNumbers]) {
        prev[routeSplitNumbers] = [route];
      } else {
        prev[routeSplitNumbers] = [].concat(_toConsumableArray(prev[routeSplitNumbers]), [route]);
      }
      return prev;
    }, {});

    //set up application based on the hash or history
    if (useHash) {
      if (window.location.href.indexOf('#') === -1) {
        window.location.hash = '/';
      }
      window.addEventListener('hashchange', function (e) {
        if (_this.wasChangedByUser) {
          _this.wasChangedByUser = false;
          return;
        }
        _this.eventChangeListener.call(_this, e);
      });
    } else {
      window.onpopstate = this.eventChangeListener.bind(this);
    }

    //do an initial routing
    this.path(this.getPathFromUrl());
  }

  //get path we're currently on


  _createClass(EsRouter, [{
    key: 'getState',
    value: function getState() {
      return this.currentPathObject;
    }
  }, {
    key: 'getParamsFromUrl',
    value: function getParamsFromUrl() {
      var queryParamString = this.useHash ? window.location.hash.split('?')[1] : window.location.search.split('?')[1];
      return queryParamString && queryParamString.split('&').reduce(function (prev, queryparam) {
        var split = queryparam.split('=');
        prev[decodeURIComponent(split[0])] = decodeURIComponent(split[1]) || '';
        return prev;
      }, {}) || {};
    }
  }, {
    key: 'getPathFromUrl',
    value: function getPathFromUrl() {
      return !this.useHash ? window.location.pathname.split(this.base)[1] || '/' : window.location.hash.split('?')[0].substring(1);
    }
  }, {
    key: 'eventChangeListener',
    value: function eventChangeListener() {
      var _this2 = this;

      var currentQueryParam = this.getParamsFromUrl();
      var currentPath = this.getPathFromUrl();

      var allNewParams = this.createParamString(currentQueryParam).join('');
      var oldParams = this.createParamString(this.queryParams).join('');

      //check if QP have changed
      if (allNewParams !== oldParams) {
        this.queryParams = this.getParamsFromUrl();
        this.events.paramChange.forEach(function (item) {
          item(_this2.queryParams);
        });
      }

      //check if path has changed
      if (currentPath !== this.currentPath) {
        this.currentPath = currentPath;
        var newPathObject = this.getPreDefinedRoute(this.currentPath);
        var oldPathObject = JSON.parse(JSON.stringify(this.currentPathObject));
        this.currentPathObject = newPathObject;
        this.startRouteChange(oldPathObject, newPathObject);
        this.finishRouteChange(oldPathObject, newPathObject);
      }
    }

    //allow items to subscribe to pre and post route changes

  }, {
    key: 'subscribe',
    value: function subscribe() {
      var topic = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
      var listener = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];


      if (!topic || !listener) return {};

      // Check validity of topic and listener
      if (!this.events.hasOwnProperty.call(this.events, topic) || typeof topic !== 'string' || typeof listener !== 'function') return {};

      // Add the listener to queue
      // Retrieve the index for deletion
      var index = this.events[topic].push(listener) - 1;

      // Return instance of the subscription for deletion
      return {
        remove: function () {
          delete this.events[topic][index];
        }.bind(this)
      };
    }
  }, {
    key: 'unsubscribe',
    value: function unsubscribe(passedF) {
      var filterFunction = function filterFunction(item) {
        return item !== passedF;
      };
      for (var item in this.events) {
        this.events[item] = this.events[item].filter(filterFunction);
      }
    }

    //add query params to the object, update path, and fire corresponding events

  }, {
    key: 'search',
    value: function search(item, value) {
      var _this3 = this;

      if (typeof item === 'undefined' || item === null) {
        return this.queryParams;
      }
      if ((typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object') {
        this.queryParams = Object.assign(this.queryParams, item);
      } else if (typeof value === 'undefined' || value === null) {
        if (this.queryParams[item]) {
          delete this.queryParams[item];
        }
      } else {
        this.queryParams[item] = value;
      }
      var currentQueryParam = this.getParamsFromUrl();
      var currentPath = this.getPathFromUrl();

      for (var key in this.queryParams) {
        if (!this.queryParams[key] && typeof this.queryParams[key] !== 'number') {
          delete this.queryParams[key];
        }
      }

      var allNewParams = this.createParamString(currentQueryParam).join('');
      var oldParams = this.createParamString(this.queryParams).join('');

      if (allNewParams === oldParams) {
        return undefined;
      }
      this.path(this.currentPath, true);
      this.events.paramChange.forEach(function (item) {
        item(_this3.queryParams);
      });
    }

    //get url object corresponding to path

  }, {
    key: 'getPreDefinedRoute',
    value: function getPreDefinedRoute(route) {
      var pathSplit = route.split('/').filter(function (item) {
        return item;
      });
      var allRoutes = JSON.parse(JSON.stringify(this.allRoutes));

      //find path that is trying to route to
      return allRoutes[pathSplit.length] && allRoutes[pathSplit.length].reduce(function (prev, item) {
        //if path has already been found, just return
        if (prev) {
          return prev;
        }
        //clone the array for possible mutation
        var passedInPath = [].concat(_toConsumableArray(pathSplit));
        //get useful path parts
        var currentItemPath = item.route.split('/').filter(function (item) {
          return item;
        });
        var variableItems = void 0;
        //if path has variables, remove them from check
        if (item.variablePath && item.variablePath.length) {
          variableItems = item.variablePath.reduce(function (prev, variable, index) {
            //mutate both original path and checker path
            var result = passedInPath.splice(variable.index - index, 1)[0];
            currentItemPath.splice(variable.index - index, 1);
            //make the variable object
            prev[variable.id] = result;
            return prev;
          }, {});
        }
        //if the path is a match, return
        if (passedInPath.join('') === currentItemPath.join('')) {
          var newItem = Object.assign({}, item);
          newItem.variablePath = variableItems;
          return newItem;
        }
      }, 0);
    }
  }, {
    key: 'createParamString',
    value: function createParamString(qp) {
      return Object.keys(qp).reduce(function (prev, key) {
        if (typeof qp[key] === 'undefined' || qp[key] === null || qp[key] && !qp[key].length) {
          return prev;
        }
        return [].concat(_toConsumableArray(prev), [encodeURIComponent(key) + '=' + encodeURIComponent(qp[key])]);
      }, []);
    }

    //actual routing function

  }, {
    key: 'path',
    value: function path(route, isQueryParam) {
      if (!route) {
        return;
      }
      var newPath = route;

      var newPathObject = this.getPreDefinedRoute(newPath);

      //if path didn't match and is in strict mode, go home
      if (!newPathObject && !this.notStrictRouting) {
        newPath = this.home.route;
        newPathObject = this.home;
      }
      //run all pre-move functions
      if (!isQueryParam) {
        this.startRouteChange(this.currentPathObject, newPathObject);
      }

      //build new url
      var paramArray = this.createParamString(this.queryParams);
      var paramArrayString = paramArray.length ? '?' + paramArray.join('&') : '';
      var newUrl = '' + (this.base || '') + newPath + paramArrayString;

      //set new url
      if (this.useHash) {
        this.wasChangedByUser = true;
        window.location.hash = newUrl;
      } else {
        window.history.pushState(null, null, newUrl);
      }

      //finally, set current path state
      var oldPath = this.currentPathObject && Object.keys(this.currentPathObject).length && JSON.parse(JSON.stringify(this.currentPathObject));
      this.currentPathObject = newPathObject;
      this.currentPath = route;
      //run all functions afterwards
      if (!isQueryParam) {
        this.finishRouteChange(oldPath, this.currentPathObject);
      }
    }
  }, {
    key: 'startRouteChange',
    value: function startRouteChange(oldPath, newPath) {
      this.events.startRouteChange.forEach(function (item) {
        item(oldPath, newPath);
      });
    }
  }, {
    key: 'finishRouteChange',
    value: function finishRouteChange(oldPath, newPath) {
      this.events.finishRouteChange.forEach(function (item) {
        item(oldPath, newPath);
      });
      this.previousQueryParam = JSON.parse(JSON.stringify(this.queryParams));
    }
  }]);

  return EsRouter;
}();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EsRouter;
} else {
  window.EsRouter = EsRouter;
}