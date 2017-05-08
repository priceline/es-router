function isNotDefined(value) {
  return typeof value === 'undefined' || value === null;
}

function clone(object) {
  return JSON.parse(JSON.stringify(object));
}

class EsRouter {

  constructor({useHash = false, routes, strictRouting = false, home, base, routeOnLoad = true}) {
    this.events = {
      startRouteChange: [],
      finishRouteChange: [],
      paramChange: [],
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
      const base = (document.getElementsByTagName('base')[0] && document.getElementsByTagName('base')[0].href) || '';
      this.base = base.split(window.location.origin)[1];
    }

    //create initial object based on passed in params
    this.allRoutes = Object.assign(routes, {}).reduce((prev, route) => {
      if (route.name === home) {
        this.home = route;
      }
      if (route.variablePath) {
        throw new Error('route objects cannot be initialized with a key of variablePath');
      }
      const pathSplit = route.route.split('/').filter((item) => item);
      const routeSplitNumbers = pathSplit.length;
      const variablePathIndex = pathSplit.reduce((prev, route, index) => {
        //check is route is a variable path
        const variable = {
          id: route.split(':')[1],
          index,
        };
        return route.includes(':') ? [...prev, variable] : [...prev];
      }, []);
      route.variablePath = variablePathIndex;
      if (!prev[routeSplitNumbers]) {
        prev[routeSplitNumbers] = [route];
      } else {
        prev[routeSplitNumbers] = [...prev[routeSplitNumbers], route];
      }
      return prev;
    }, {});

    //set up application based on the hash or history
    if (useHash) {
      if (window.location.href.indexOf('#') === -1) {
        window.location.hash = '/';
      }
      window.addEventListener('hashchange', (e) => {
        if (this.wasChangedByUser) {
          this.wasChangedByUser = false;
          return;
        }
        this.eventChangeListener.call(this, e);
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
  getState() {
    return this.currentPathObject;
  }

  /**
   * Parses the current query string params from the url
   * @return {object}
   */
  getParamsFromUrl() {
    const queryParamString = this.useHash ? window.location.hash.split('?')[1] :
      window.location.search.split('?')[1];
    return (queryParamString && queryParamString.split('&').reduce((prev, queryparam) => {
      const split = queryparam.split('=');
      prev[decodeURIComponent(split[0])] = decodeURIComponent(split[1]) || '';
      return prev;
    }, {})) || {};
  }

  /**
   * Parses the current routing path from the url, excluding the base
   * This will always start with a slash
   *
   * @return {String}
   */
  getPathFromUrl() {
    const pathname = window.location.pathname;
    const pos = Math.max(0, pathname.indexOf(this.base) + this.base.length - 1);
    const path = pathname.slice(pos) || '/';
    return this.useHash ? window.location.hash.split('?')[0].substring(1) : path;
  }

  /**
   * Listens for hashchange or popstate events from the window
   * And fires off route change events to subscribers
   * This can happen when calling path() or when the browser navigates natively
   */
  eventChangeListener() {
    const currentQueryParam = this.getParamsFromUrl();
    const currentPath = this.getPathFromUrl();
    const allNewParams = this.createParamString(currentQueryParam).join('');
    const oldParams = this.createParamString(this.queryParams).join('');

    //check if QP have changed
    if (allNewParams !== oldParams) {
      this.queryParams = this.getParamsFromUrl();
      this.events.paramChange.forEach((item) => {
        item(this.queryParams);
      });
    }

    //check if path has changed
    if (currentPath !== this.currentPath) {
      this.currentPath = currentPath;
      const newPathObject = this.getPreDefinedRoute(this.currentPath);
      const oldPathObject = clone(this.currentPathObject);
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
  subscribe(topic, listener) {
    if (!topic || !listener) return {};

    // Check validity of topic and listener
    if (!this.events.hasOwnProperty.call(this.events, topic) ||
      typeof topic !== 'string' ||
       typeof listener !== 'function') return {};

    // Add the listener to queue
    // Retrieve the index for deletion
    const index = this.events[topic].push(listener) - 1;

    // Return instance of the subscription for deletion
    return {
      remove: () => {
        delete this.events[topic][index];
      },
    };
  }

  unsubscribe(passedF) {
    const filterFunction = (item) => {
      return item !== passedF;
    };
    Object.keys(this.events).forEach((item) => {
      this.events[item] = this.events[item].filter(filterFunction);
    });
  }

  //add query params to the object, update path, and fire corresponding events
  search(item, value) {
    if (isNotDefined(item)) {
      return this.queryParams;
    }
    if (typeof item === 'object') {
      this.queryParams = Object.assign(this.queryParams, item);
    } else if (isNotDefined(value)) {
      if (this.queryParams[item]) {delete this.queryParams[item];}
    } else {
      this.queryParams[item] = value;
    }

    Object.keys(this.queryParams).forEach((key) => {
      if (isNotDefined(this.queryParams[key]) && typeof this.queryParams[key] !== 'number') {
        delete this.queryParams[key];
      }
    });

    const currentQueryParam = this.getParamsFromUrl();
    const allNewParams = this.createParamString(currentQueryParam).join('');
    const oldParams = this.createParamString(this.queryParams).join('');

    if (allNewParams === oldParams) {return undefined;}
    this.path(this.currentPath, true);
    this.events.paramChange.forEach((item) => {
      item(this.queryParams);
    });
    return this.queryParams;
  }

  //get url object corresponding to path
  getPreDefinedRoute(route) {
    const pathSplit = route.split('/').filter((item) => item);
    const allRoutes = clone(this.allRoutes);

    //find path that is trying to route to
    return allRoutes[pathSplit.length] && allRoutes[pathSplit.length].reduce((prev, item) => {
      //if path has already been found, just return
      if (prev) {return prev;}
      //clone the array for possible mutation
      const passedInPath = [...pathSplit];
      //get useful path parts
      const currentItemPath = item.route.split('/').filter((item) => item);
      let variableItems;
      //if path has variables, remove them from check
      if (item.variablePath && item.variablePath.length) {
        variableItems = item.variablePath.reduce((prev, variable, index) => {
          //mutate both original path and checker path
          const result = passedInPath.splice(variable.index - index, 1)[0];
          currentItemPath.splice(variable.index - index, 1);
          //make the variable object
          prev[variable.id] = result;
          return prev;
        }, {});
      }
      //if the path is a match, return
      if (passedInPath.join('') === currentItemPath.join('')) {
        const newItem = Object.assign({}, item);
        newItem.variablePath = variableItems;
        return newItem;
      }
      return false;
    }, 0);
  }

  createParamString(qp) {
    return Object.keys(qp).reduce((prev, key) => {
      const keyString = key.toString();
      const valueString = qp[key].toString();
      if (isNotDefined(valueString) || (Array.isArray(valueString) && !valueString.length)) {
        return prev;
      }
      return [...prev, (`${encodeURIComponent(keyString)}=${encodeURIComponent(valueString)}`)];
    }, []);
  }

  /**
   * Build a new url for path changes
   * We assume the route has already been verified as a predefined route here (or not)
   *
   * @param  {string} newPath - input path, e.g. /account/login
   * @return {string}         - output ready for history push, e.g. /base/account/login?foo=bar
   */
  buildNewUrl(newPath) {
    const paramArray = this.createParamString(this.queryParams);
    const paramArrayString = paramArray.length ? `?${paramArray.join('&')}` : '';
    // make sure the new url starts with a slash
    const newUrlBase = this.base.match(/^\//) ? this.base : `/${this.base}`;
    const newUrl = (`${newUrlBase}${newPath}${paramArrayString}`)
      .replace(/\/{2,}/g, '/'); // dedup consecutive slashes
    return newUrl;
  }

  /**
   * Actual routing function
   *
   * @param  {string}  route        - New path to naviate to. Absolute path, not including base
   * @param  {Boolean} isQueryParam - ???
   * @param  {Boolean} initialLoad  - if true, skips push state/hash change and just fires event
   */
  path(route, isQueryParam, initialLoad = false) {
    if (!route) {return;}
    let newPath = route;
    let newPathObject = this.getPreDefinedRoute(newPath);
    let redirect = false;
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

    const newUrl = this.buildNewUrl(newPath);

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
    const oldPath = this.currentPathObject && Object.keys(this.currentPathObject).length &&
      clone(this.currentPathObject);
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
  startRouteChange(oldPath, newPath) {
    this.events.startRouteChange.forEach((item) => {
      item(oldPath, newPath);
    });
  }

  /**
   * Publish 'finishRouteChange' event to all subscribers
   */
  finishRouteChange(oldPath, newPath) {
    this.events.finishRouteChange.forEach((item) => {
      item(oldPath, newPath);
    });
    this.previousQueryParam = clone(this.queryParams);
  }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = EsRouter;
} else {
  window.EsRouter = EsRouter;
}
