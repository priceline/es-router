function isNotDefined(value) {
  return typeof value === 'undefined' || value === null;
}

function clone (object) {
  return JSON.parse(JSON.stringify(object));
}

class EsRouter {
  constructor({useHash, routes, notStrictRouting, home, base}) {
    this.events = {
      startRouteChange: [],
      finishRouteChange: [],
      paramChange: [],
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
    this.path(this.getPathFromUrl());
  }

  //get path we're currently on
  getState() {
    return this.currentPathObject;
  }

  getParamsFromUrl() {
    const queryParamString = this.useHash ? window.location.hash.split('?')[1] : window.location.search.split('?')[1];
    return (queryParamString && queryParamString.split('&').reduce((prev, queryparam) => {
      const split = queryparam.split('=');
      prev[decodeURIComponent(split[0])] = decodeURIComponent(split[1]) || '';
      return prev;
    }, {})) || {};
  }

  getPathFromUrl() {
    return !this.useHash ? (window.location.pathname.split(this.base)[1] || '/') :
        window.location.hash.split('?')[0].substring(1);
  }

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

  //allow items to subscribe to pre and post route changes
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
      remove: (function() {
        delete this.events[topic][index];
      }).bind(this),
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
    const currentQueryParam = this.getParamsFromUrl();
    const currentPath = this.getPathFromUrl();

    Object.keys(this.queryParams).forEach((key) => {
      if (!this.queryParams[key] && typeof this.queryParams[key] !== 'number') {
        delete this.queryParams[key];
      }
    });

    const allNewParams = this.createParamString(currentQueryParam).join('');
    const oldParams = this.createParamString(this.queryParams).join('');

    if (allNewParams === oldParams) {return undefined;}
    this.path(this.currentPath, true);
    this.events.paramChange.forEach((item) => {
      item(this.queryParams);
    });
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
    }, 0);
  }

  createParamString(qp) {
    return Object.keys(qp).reduce((prev, key) => {
      if (isNotDefined(qp[key]) || !qp[key].length) {
        return prev;
      }
      return [...prev, (`${encodeURIComponent(key)}=${encodeURIComponent(qp[key])}`)];
    }, []);
  }

  //actual routing function
  path(route, isQueryParam) {
    if (!route) {return;}
    let newPath = route;

    let newPathObject = this.getPreDefinedRoute(newPath);

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
    const paramArray = this.createParamString(this.queryParams);
    const paramArrayString = paramArray.length ? `?${paramArray.join('&')}` : '';
    const newUrl = `${this.base || ''}${newPath}${paramArrayString}`;

    //set new url
    if (this.useHash) {
      this.wasChangedByUser = true;
      window.location.hash = newUrl;
    } else {
      window.history.pushState(null, null, newUrl);
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

  startRouteChange(oldPath, newPath) {
    this.events.startRouteChange.forEach((item) => {
      item(oldPath, newPath);
    });
  }

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
