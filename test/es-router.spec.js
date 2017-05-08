import EsRouter from '../src/es-router';

let currentPath = '';
GLOBAL.window = {
  location: {
    origin: '',
    href: '',
    hash: '',
    pathname: '',
    search: currentPath,
  },
  addEventListener: () => {},
  history: {
    pushState: (state, other, url) => {
      currentPath = url;
    },
  },
};

const router = new EsRouter({
  useHash: false,
  home: 'home',
  strictRouting: true,
  base: '/testurl/',
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


describe('routing', function() {
  it('exists', () => {
    expect(router).toBeDefined();
  });
  it('initializes to home', () => {
    expect(router.getState().name).toEqual('home');
  });
  it('routes correctly', () => {
    router.path('/path');
    expect(router.getState().name).toEqual('path1');
  });
  it('redirects home if strictRouting is true', () => {
    router.path('/somewhereThatDoesntExist');
    expect(router.getState().name).toEqual('home');
  });
  it('handles variables in paths', () => {
    router.path('/something/variable', () => {
      expect(router.getState().variablePath.router).toEqual('variable');
    });
  });
});

describe('query params', () => {
  it('should add query params', () => {
    router.search('param', 'added');
    expect(router.search().param).toEqual('added');
  });
  it('should remove param if passed no second param', () => {
    router.search('param');
    expect(router.search().param).toBeUndefined();
  });
  it('should be able to handle 0', () => {
    router.search('param', 0);
    expect(router.search().param).toEqual(0);
  });
  it('should be add 0 as a string', () => {
    router.search('param', 0);
    expect(currentPath.includes('param=0')).toEqual(true);
  });
  it('should handle objects', () => {
    router.search({
      test: 'ohYeah',
      otherKey: 'yessir',
    });
    expect(router.search()).toEqual({
      param: 0,
      test: 'ohYeah',
      otherKey: 'yessir',
    });
  });
  it('should add an empty param if passed an empty string', () => {
    router.search('empty-string', '');
    expect(router.search()['empty-string']).toEqual('');
  });
});
