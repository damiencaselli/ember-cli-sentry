ember-cli-sentry
===============================================================================

An ember-cli addon adding [Sentry](https://www.getsentry.com) support.


Requirements
-------------------------------------------------------------------------------

- Node.js 6 or higher is required to use this addon
- Ember CLI 2.13 or higher is required to use this addon


Install
-------------------------------------------------------------------------------

```
ember install ember-cli-sentry
```


Usage
-------------------------------------------------------------------------------

### TLDR

```js
// config/environment.js

module.exports = function(environment) {
  var ENV = {

    /* config */

    sentry: {
      dsn: 'https://<dummykey>@app.getsentry.com/<dummyproject>'
    }
  }
}
```

### Complete config

```js
// config/environment.js

module.exports = function(environment) {
  var ENV = {

    /* config */

    sentry: {
      /**
       * The only mandatory parameter.
       *
       * @type {String}
       */
      dsn: 'https://<dummykey>@app.getsentry.com/<dummyproject>',

      /**
       * Sets Raven.debug property when running `Raven.config`.
       *
       * @type {Boolean}
       * @default true
       */
      debug: true,

      /**
       * If set to true, it will prevent Raven.js from being initialized.
       * Errors and logs will be logged to the console (default) instead of
       * being reported by Raven.
       *
       * @type {Boolean}
       * @default undefined
       */
      development: false,
      
      /**
       * Pass the environment to Raven.js
       *
       * @type {String}
       * @default undefined
       */
      environment: environment,

      /**
       * If set to true, addon will try to have Ember.onerror
       * and Ember.RSVP.on('error') captured by Raven.
       *
       * @type {Boolean}
       * @default true
       */
      globalErrorCatching: true,

      /**
       * Raven.js option.
       *
       * @type {Array}
       * @default []
       */
      includePaths: [],

      /**
       * Raven.js option.
       *
       * @type {Array}
       * @default []
       */
      whitelistUrls: [],

      /**
       * Options to pass directly to Raven.js. Note: whitelistUrls and
       * includePaths in this will take precedence
       * over the above.
       *
       * @default {}
       */
      ravenOptions: {},
    }
  }
}
```

### Content Security Policy

To allow Ravenjs to work properly, you need to add a couple of thing to the content security policy rules:

```
'script-src': "'self' 'unsafe-inline' 'unsafe-eval'",
'img-src': "data: app.getsentry.com",
'connect-src': "'self' app.getsentry.com"
```

### Meaningless stack traces?

Ember has disabled source maps by default in production. For more meaningful stack traces, you must manually enable source maps on every environment you're using Sentry.  

```
// ember-cli-build.js

var app = new EmberApp(defaults, {
  sourcemaps: {
    enabled: true
  }
});
```
This will enable source maps on every environment. See [this EmberCLI documentation](https://ember-cli.com/asset-compilation#source-maps) for more details or enabling source maps for specific environments.

### Example

The dummy application in tests is a working example with a couple of logging here and there, and a default logger.


Licence
-------------------------------------------------------------------------------

[MIT](https://raw.githubusercontent.com/ember-cli-sentry/ember-cli-sentry/master/LICENSE.md)
