# es-router

Routers are great for SPAs! except most routers are tied to your framework. But what if you like to keep upgrading your project? use as much vanilla javascript as possible!

That's where es-router comes in. es-router is a vanilla router that can be imported into any project. it uses a pub-sub style of routing, so it's simple to track changes in the url!

## setup

to get started you'll need to import es-router and give it a config
```javascript
import Router from 'es-router';
const router = new Router({
  useHash: false,
  home: 'home',
  strictRouting: true,
  base: '/testurl/',
  routeOnLoad: true,
  routes: [
    {
      name: 'home',
      route: '/',
    },
    {
      name: 'path1',
      route: '/path',
    },
    {
      name: 'routes',
      route: '/route/:router',
    },
    {
      name: 'floater',
      route: '/something/:router',
    }],
});
export {router};
```

let's go through each option.

### useHash (optional, defaults to false)

useHash defines whether or not you'd like to use pushState, or the equivalent to Angular's `html5Mode`. This is a great option if your base is not consistent or you're on IE9

### home (required if strictRouting is true)

this is a default path that you'd like to go to if the url doesn't match to any of the paths you've defined

### strictRouting (optional)

this enforces strict routing, meaning attempts to go to a path other than the ones defined in `routes` will be redirected to `home`. this can result in the browser back button getting stuck in an infinite redirect loop, so it is false by default

### base (required if useHash is true)
this is the base url for your application if you aren't using the hash. if this isn't declared and you are using `useHash`, it will try and retrieve the base from the `base` tag in the html5Mode

### routeOnLoad (optional, defaults to true)
this makes a route change event get fired upon loading the page. if this is set to false, no initial route change will be fired. setting this to false may work better for some app configurations (e.g. server side rendering)

### routes (required)

routes are the locations that you've defined to use in your application. the `:` means that it is a variable route, and can be changed

## using in application

Okay, you've configured your router, now to use it!

first, import your router in your js where you'd like to control the view

```javascript
import {router} from './active-router';

router.path('/something/somethingElse');
```
this will cause the url to update to this path, and it fires two subscription events, called `beginRouteChange` and `finishRouteChange`.

you subscribe to these using
```javascript
router.subscribe('finishRouteChange', (oldPath, newPath) => {
});
```
oldPath is what the path routed from, newPath is the path that was routed to. the structure comes back similarly to the object that was declared in the config

```javascript
{
  name: 'floater',
  route: '/something/:router',
  variablePath: {
    router: 'somethingElse',
  }
}
```
you'll notice that there's a third key called `variablePath` which maps the name of the variable passed in to the path that was called.

## query parameters

but how powerful is a router without query parameters? es-router uses persistent query parameters and will update them using `router.search()`.

`router.search()` has four uses
```javascript
//will set the query parameter `new-param` to the value of `truth`
router.search('new-param', 'truth');
//will set all keys of the object to the value in the url
router.search({'new-param': 'truth', 'old-param': 'also-true'});
//will delete the query paramter `new-param`
router.search('new-param');
//will return an object of all query paramters in the url
router.search()
```
any time a query parameter is updated, the event `paramChange` will be fired, which cane be subscribed to the same way the paths are subscribed to
```javascript
router.subscribe('paramChange', (params) => {
});
```
`params` is the equivalent of calling `router.search()`.

# examples

The idea behind the router is that you install it in your favorite SPA and use it to toggle components. Here's how it is being used in both Angular and React.

## Angular

```javascript
import angular from 'angular';
import routes from './routes';

angular.module('myApp')
.component('myComponent', {
  template: `
  <path-one ng-if="$ctrl.path === 'path1'"></path-one>
  <routes ng-if="$ctrl.path === 'routes'"></routes>
  <home ng-if="$ctrl.path === 'home'"></home>
  <floater ng-if="$ctrl.path === 'floater'"></floater>`,
  controller: ['$rootScope', '$timeout', class MyComponent {
    constructor($rootScope, $timeout) {
      const initialRoute = routes.getState();
      this.path = initialRoute.name;
      routes.subscribe('finishRouteChange', (fromState, toState) => {
        this.path = toState && toState.name;
        if (!$rootScope.$$phase) {
          $timeout(() => {
            $rootScope.$apply();
          });
        }
      });
    }
  }],
  controllerAs: '$ctrl',
});
```

## React

```javascript
import React, { Component } from 'react';
import routes from './routes';

class App extends Component {
  componentWillMount() {
    routes.subscribe('finishRouteChange', (fromState, toState) => {
        this.setState({ path: toState && toState.name});
      });
  }
  render() {
    switch(this.state.path) {
      case 'path1' {
        return (<pathOne />);
      }
      case 'routes' {
        return (<routes />);
      }
      case 'home' {
        return (<home />);
      }
      case 'floater' {
        return (<floater />);
      }
    }
  }
}
```

## Notes for Angular Implementation

One thing that was discovered while building the router is that Angular 1 has an internal state for route, even if you aren't using any angular router. To disable this (which is required for this application) please add this snippet to your code.

```javascript
angular
.module('myApp')
.config(['$provide', function ($provide) {
  $provide.decorator('$sniffer', ['$delegate', function ($delegate) {
    $delegate.history = false;
    return $delegate;
  }]);
  $provide.decorator('$browser', ['$delegate', function ($delegate) {
    $delegate.onUrlChange = function () {};
    $delegate.url = function () { return '';};
    return $delegate;
  }]);
}]);
```

this will disable the use of `$location`, but es-router is meant as a replacement for `$location` so it shouldn't be an issue.
