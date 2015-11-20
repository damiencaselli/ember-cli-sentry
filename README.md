Ember-cli-sentry
================

An ember-cli addon adding [Sentry](https://www.getsentry.com) support.

Docs available [here](https://damiencaselli.github.io/ember-cli-sentry/).

## Important notice if you migrate from 1.x.x to 2.x

Please have a look at [this wiki entry](https://github.com/damiencaselli/ember-cli-sentry/wiki/Migration-from-1.x.x-to-2.x) if you upgrade major version of ember-cli-sentry.

## What it does

This add-on does:

* Enable safe use of Raven.js whether you are in development mode or not.
* Inject a logging service to routes, components, controllers and models to access Raven object.
* Provide a default logger generator that should work for the vaste majority of people.
* Provide rather complete customization.

This add-on does **not**:

* Generate the logging service for you.
* Provide a Sentry key for testing.

## Install

From any ember-cli application, run `ember install ember-cli-sentry`.

Add-on will assume there is an available service that proxies Raven, which is not the case unless you already did the install.

The easiest way of doing it is to create a service only extending `ember-cli-sentry/services/raven`:

```js
// your-app/services/custom-logger.js
export { default } from 'ember-cli-sentry/services/raven';
```

You can also use a generator `ember g logger <logger-name>`, which will generate a service called `<logger-name>` extending `ember-cli-sentry/services/raven` and exposing its methods and properties.

Now that you have a dedicated service for Raven.js, let's configure it.

## Configuration

### TLDR

You have a service named `raven` that extends `ember-cli-sentry/services/raven`.

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

      /*
       * If Raven.js is not inlined in your code, this is
       * where you want to define it. 
       * Please add only the CDN host here, as the whole URL gets configured by the plugin.
       *
       * I recommend **not** using a build containing ember.js plugin (https://github.com/getsentry/raven-js/blob/master/plugins/ember.js)
       * since setting `globalErrorCatching: true` will perform the same
       * operation, safely.
       *
       * @type {String}
       * @default undefined
       */
      cdn: '//cdn.ravenjs.com',
      
      /*
       * The Raven version you want to use.
       *
       * @type {String}
       */
      version: '1.3.0',

      /*
       * The only mandatory parameter.
       *
       * @type {String}
       */
      dsn: 'https://<dummykey>@app.getsentry.com/<dummyproject>',

      /*
       * Sets Raven.debug property when running `Raven.config`.
       *
       * @type {Boolean}
       * @default true
       */
      debug: true,

      /*
       * If set to true, this add-on will never initialize
       * Raven object and capturing will be handled by the logging service (redirected to the console if you use default service).
       *
       * @type {Boolean}
       * @default undefined
       */
      development: false,

      /*
       * Injects the logging service as this property.
       *
       * @type {String}
       * @default 'raven'
       */
      exposedPropertyName: 'raven',

      /*
       * If set to true, add-on will try to have Ember.onerror
       * and Ember.RSVP.on('error') captured by Raven.
       *
       * @type {Boolean}
       * @default true
       */
      globalErrorCatching: true,

      /*
       * Raven.js option.
       *
       * @type {Array}
       * @default []
       */
      includePaths: [],

      /*
       * Service used to interface with Raven.
       *
       * @type {String}
       * @default 'raven'
       */
      serviceName: 'raven',

      /*
       * Raven.js option.
       *
       * @type {Array}
       * @default []
       */
      whitelistUrls: []
    }
  }
}
```

## Content Security Policy

To allow Ravenjs to work properly, you need to add `"img-src": "data: app.getsentry.com"` to content security policies.

## Example

The dummy application in tests is a working example with a couple of logging here and there, and a default logger.

## Dependencies

[Raven.js](https://github.com/getsentry/raven-js).

## Licence

MIT
