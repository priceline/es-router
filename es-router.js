'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function isNotDefined(value) {
  return typeof value === 'undefined' || value === null;
}

function clone(object) {
  return JSON.parse(JSON.stringify(object));
}

var EsRouter = function () {
  function EsRouter(_ref) {
    var _this = this;

    var _ref$useHash = _ref.useHash,
        useHash = _ref$useHash === undefined ? false : _ref$useHash,
        routes = _ref.routes,
        _ref$strictRouting = _ref.strictRouting,
        strictRouting = _ref$strictRouting === undefined ? false : _ref$strictRouting,
        home = _ref.home,
        base = _ref.base,
        _ref$routeOnLoad = _ref.routeOnLoad,
        routeOnLoad = _ref$routeOnLoad === undefined ? true : _ref$routeOnLoad;

    _classCallCheck(this, EsRouter);

    this.events = {
      startRouteChange: [],
      finishRouteChange: [],
      paramChange: []
    };
    this.useHash = useHash;
    this.routes = routes;
    this.base = base;
    this.strictRouting = strictRouting;
    this.queryParams = this.getParamsFromUrl();

    if (base && base[base.length - 1] === '/' && base !== '/') {
      this.base = this.base.substring(0, this.base.length - 1);
    } else {
      this.base = base;
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
    //this shouldn't actually push a history state, it should just fire a routing event
    //pushing a new history state adds an extra, unnecessray back button click
    if (routeOnLoad) {
      this.path(this.getPathFromUrl(), false, true);
    }
  }

  /**
   * get path we're currently on
   * @return {object} - path object with name and route props
   */


  _createClass(EsRouter, [{
    key: 'getState',
    value: function getState() {
      return this.currentPathObject;
    }

    /**
     * Parses the current query string params from the url
     * @return {object}
     */

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

    /**
     * Parses the current routing path from the url, excluding the base
     * This will always start with a slash
     *
     * @return {String}
     */

  }, {
    key: 'getPathFromUrl',
    value: function getPathFromUrl() {
      var pathname = window.location.pathname;
      var pos = Math.max(0, pathname.indexOf(this.base) + this.base.length - 1);
      var path = pathname.slice(pos) || '/';
      return this.useHash ? window.location.hash.split('?')[0].substring(1) : path;
    }

    /**
     * Listens for hashchange or popstate events from the window
     * And fires off route change events to subscribers
     * This can happen when calling path() or when the browser navigates natively
     */

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
        var oldPathObject = clone(this.currentPathObject);
        this.currentPathObject = newPathObject;
        this.startRouteChange(oldPathObject, newPathObject);
        this.finishRouteChange(oldPathObject, newPathObject);
      }
    }

    /**
     * allow items to subscribe to pre and post route changes
     * @param  {String} topic       - event name, e.g. startRouteChange, finishRouteChange
     * @param  {function} listener  - event listener callback
     * @return {object}             - object containing a remove property to unsubscribe.
     *                                maybe consider changing this to an index, a la setInterval
     */

  }, {
    key: 'subscribe',
    value: function subscribe(topic, listener) {
      var _this3 = this;

      if (!topic || !listener) return {};

      // Check validity of topic and listener
      if (!this.events.hasOwnProperty.call(this.events, topic) || typeof topic !== 'string' || typeof listener !== 'function') return {};

      // Add the listener to queue
      // Retrieve the index for deletion
      var index = this.events[topic].push(listener) - 1;

      // Return instance of the subscription for deletion
      return {
        remove: function remove() {
          delete _this3.events[topic][index];
        }
      };
    }
  }, {
    key: 'unsubscribe',
    value: function unsubscribe(passedF) {
      var _this4 = this;

      var filterFunction = function filterFunction(item) {
        return item !== passedF;
      };
      Object.keys(this.events).forEach(function (item) {
        _this4.events[item] = _this4.events[item].filter(filterFunction);
      });
    }

    //add query params to the object, update path, and fire corresponding events

  }, {
    key: 'search',
    value: function search(item, value) {
      var _this5 = this;

      if (isNotDefined(item)) {
        return this.queryParams;
      }
      if ((typeof item === 'undefined' ? 'undefined' : _typeof(item)) === 'object') {
        this.queryParams = Object.assign(this.queryParams, item);
      } else if (isNotDefined(value)) {
        if (this.queryParams[item]) {
          delete this.queryParams[item];
        }
      } else {
        this.queryParams[item] = value;
      }

      Object.keys(this.queryParams).forEach(function (key) {
        if (isNotDefined(_this5.queryParams[key]) && typeof _this5.queryParams[key] !== 'number') {
          delete _this5.queryParams[key];
        }
      });

      var currentQueryParam = this.getParamsFromUrl();
      var allNewParams = this.createParamString(currentQueryParam).join('');
      var oldParams = this.createParamString(this.queryParams).join('');

      if (allNewParams === oldParams) {
        return undefined;
      }
      this.path(this.currentPath, true);
      this.events.paramChange.forEach(function (item) {
        item(_this5.queryParams);
      });
      return this.queryParams;
    }

    //get url object corresponding to path

  }, {
    key: 'getPreDefinedRoute',
    value: function getPreDefinedRoute(route) {
      var pathSplit = route.split('/').filter(function (item) {
        return item;
      });
      var allRoutes = clone(this.allRoutes);

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
        return false;
      }, 0);
    }
  }, {
    key: 'createParamString',
    value: function createParamString(qp) {
      return Object.keys(qp).reduce(function (prev, key) {
        var keyString = key.toString();
        var valueString = qp[key].toString();
        if (isNotDefined(valueString) || Array.isArray(valueString) && !valueString.length) {
          return prev;
        }
        return [].concat(_toConsumableArray(prev), [encodeURIComponent(keyString) + '=' + encodeURIComponent(valueString)]);
      }, []);
    }

    /**
     * Build a new url for path changes
     * We assume the route has already been verified as a predefined route here (or not)
     *
     * @param  {string} newPath - input path, e.g. /account/login
     * @return {string}         - output ready for history push, e.g. /base/account/login?foo=bar
     */

  }, {
    key: 'buildNewUrl',
    value: function buildNewUrl(newPath) {
      var paramArray = this.createParamString(this.queryParams);
      var paramArrayString = paramArray.length ? '?' + paramArray.join('&') : '';
      // make sure the new url starts with a slash
      var newUrlBase = this.base.match(/^\//) ? this.base : '/' + this.base;
      var newUrl = ('' + newUrlBase + newPath + paramArrayString).replace(/\/{2,}/g, '/'); // dedup consecutive slashes
      return newUrl;
    }

    /**
     * Actual routing function
     *
     * @param  {string}  route        - New path to naviate to. Absolute path, not including base
     * @param  {Boolean} isQueryParam - ???
     * @param  {Boolean} initialLoad  - if true, skips push state/hash change and just fires event
     */

  }, {
    key: 'path',
    value: function path(route, isQueryParam) {
      var initialLoad = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      if (!route) {
        return;
      }
      var newPath = route;
      var newPathObject = this.getPreDefinedRoute(newPath);
      var redirect = false;
      //if path didn't match and is in strict mode, go home (redirect)
      if (!newPathObject && this.strictRouting) {
        newPath = this.home.route;
        newPathObject = this.home;
        redirect = true;
      }
      //run all pre-move functions
      if (!isQueryParam) {
        this.startRouteChange(this.currentPathObject, newPathObject);
      }

      var newUrl = this.buildNewUrl(newPath);

      //push new state to the window, but only if this is not the initial load
      //otherwise we end up with two copies of the initial state in browser history
      //
      //ignoring this rule for strict routing seems to be the only option right now
      //Need to come up with a working solution for "redirects"
      //Using hash or pushState for redirects breaks the browser's back button
      if (initialLoad === false || redirect === true) {
        if (this.useHash) {
          this.wasChangedByUser = true;
          window.location.hash = newUrl;
        } else {
          window.history.pushState(null, null, newUrl);
        }
      }

      //finally, set current path state
      var oldPath = this.currentPathObject && Object.keys(this.currentPathObject).length && clone(this.currentPathObject);
      this.currentPathObject = newPathObject;
      this.currentPath = route;
      //run all functions afterwards
      if (!isQueryParam) {
        this.finishRouteChange(oldPath, this.currentPathObject);
      }
    }

    /**
     * Publish 'startRouteChange' event to all subscribers
     */

  }, {
    key: 'startRouteChange',
    value: function startRouteChange(oldPath, newPath) {
      this.events.startRouteChange.forEach(function (item) {
        item(oldPath, newPath);
      });
    }

    /**
     * Publish 'finishRouteChange' event to all subscribers
     */

  }, {
    key: 'finishRouteChange',
    value: function finishRouteChange(oldPath, newPath) {
      this.events.finishRouteChange.forEach(function (item) {
        item(oldPath, newPath);
      });
      this.previousQueryParam = clone(this.queryParams);
    }
  }]);

  return EsRouter;
}();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EsRouter;
} else {
  window.EsRouter = EsRouter;
}