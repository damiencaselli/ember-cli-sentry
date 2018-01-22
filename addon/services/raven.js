import { assign } from '@ember/polyfills';
import { computed, get, set } from '@ember/object';
import { isPresent, typeOf } from '@ember/utils';
import { warn } from '@ember/debug';
import Service from '@ember/service';
import Ember from 'ember';
import { on as rsvpOn } from 'rsvp';
import Raven from 'raven';

/**
 * Default available logger service.
 *
 * You can simply extend or export this Service to use it in the application.
 *
 * @class RavenService
 * @module ember-cli-sentry/services/raven
 * @extends Ember.Service
 */
export default Service.extend({

  /**
   * Global error catching definition status
   *
   * @property globalErrorCatchingInitialized
   * @type Boolean
   * @default false
   * @private
   */
  globalErrorCatchingInitialized: false,

  /**
   * Message to send to Raven when facing an unhandled
   * RSVP.Promise rejection.
   *
   * @property unhandledPromiseErrorMessage
   * @type String
   * @default 'Unhandled Promise error detected'
   */
  unhandledPromiseErrorMessage: 'Unhandled Promise error detected',

  /**
   * Ignore errors if the message matches any string or regex in this list.
   *
   * @property ignoreErrors
   * @type Array
   */
  ignoreErrors: computed(() => []),

  /**
   * Ignore errors if any of the stack trace file paths matches any string or regex in this list.
   *
   * @property ignoreUrls
   * @type Array
   */
  ignoreUrls: computed(() => []),

  /**
   * Utility function used internally to check if Raven object
   * can capture exceptions and messages properly.
   *
   * @property isRavenUsable
   * @type Ember.ComputedProperty
   */
  isRavenUsable: computed(function() {
    return typeof(FastBoot) === 'undefined' && Raven.isSetup() === true;
  }).volatile(),

  /**
   * Setup `raven-js` with the config options.
   * @param config
   */
  setup(config) {
    const {
      dsn,
      environment,
      debug = true,
      includePaths = [],
      whitelistUrls = [],
      serviceReleaseProperty = 'release',
      ravenOptions = {}
    } = config.sentry;

    let ignoreErrors = get(this, 'ignoreErrors');
    if (isPresent(ignoreErrors)) {
      set(ravenOptions, 'ignoreErrors', ignoreErrors);
    }

    set(ravenOptions, 'ignoreUrls', get(this, 'ignoreUrls'));

    try {
      Raven.debug = debug;

      // Keeping existing config values for includePaths, whitelistUrls, for compatibility.
      const ravenConfig = assign({
        environment,
        includePaths,
        whitelistUrls,
        release: get(this, serviceReleaseProperty) || config.APP.version
      }, ravenOptions);

      Raven.config(dsn, ravenConfig);
    } catch (e) {
      warn('Error during `sentry` initialization: ' + e, {
        id: 'ember-cli-sentry.initialization-error'
      });
      return;
    }

    Raven.install();

    const { globalErrorCatching = true } = config.sentry;

    if (globalErrorCatching === true) {
      this.enableGlobalErrorCatching();
    }
  },

  /**
   * Tries to have Raven capture exception, or throw it.
   *
   * @method captureException
   * @param {Error} error The error to capture
   * @throws {Error} An error if Raven cannot capture the exception
   */
  captureException(error) {
    if (get(this, 'isRavenUsable')) {
      Raven.captureException(...arguments);
    } else {
      throw error;
    }
  },

  /**
   * Tries to have Raven capture message, or send it to console.
   *
   * @method captureMessage
   * @param  {String} message The message to capture
   * @return {Boolean}
   */
  captureMessage(message) {
    if (get(this, 'isRavenUsable')) {
      Raven.captureMessage(...arguments);
    } else {
      throw new Error(message);
    }
    return true;
  },

  /**
   * Tries to have Raven capture breadcrumb, or log it.
   *
   * @method captureBreadcrumb
   * @param {Object} breadcrumb The breadcrumb to capture
   */
  captureBreadcrumb(breadcrumb) {
    if (get(this, 'isRavenUsable')) {
      Raven.captureBreadcrumb(...arguments);
    } else {
      // eslint-disable-next-line no-console
      console.info(breadcrumb);
    }
  },

  /**
   * Binds functions to `Ember.onerror` and `Ember.RSVP.on('error')`.
   *
   * @method enableGlobalErrorCatching
   * @chainable
   * @see http://emberjs.com/api/#event_onerror
   */
  enableGlobalErrorCatching() {
    if (get(this, 'isRavenUsable') && !get(this, 'globalErrorCatchingInitialized')) {
      const _oldOnError = Ember.onerror;

      Ember.onerror = (error) => {
        if (this._ignoreError(error)) {
          return;
        }

        this.captureException(error);
        this.didCaptureException(error);
        if (typeof(_oldOnError) === 'function') {
          _oldOnError.call(Ember, error);
        }
      };

      rsvpOn('error', (reason, label) => {
        if (this._ignoreError(reason)) {
          return;
        }

        if (typeOf(reason) === 'error') {
          this.captureException(reason, {
            extra: {
              context: label || get(this, 'unhandledPromiseErrorMessage'),
            },
          });
          this.didCaptureException(reason);
        } else {
          this.captureMessage(this._extractMessage(reason), {
            extra: {
              reason,
              context: label,
            }
          });
        }
      });

      this.set('globalErrorCatchingInitialized', true);
    }

    return this;
  },

  /**
   * This private method tries to find a reasonable message when
   * an unhandled promise does not reject to an error.
   *
   * @method _extractMessage
   * @param  {any} reason
   * @return {String}
   */
  _extractMessage(reason) {
    const defaultMessage = get(this, 'unhandledPromiseErrorMessage');
    switch (typeOf(reason)) {
      case 'string':
        return reason;
      case 'object':
        return reason.message || defaultMessage;
      default:
        return defaultMessage;
    }
  },

  _ignoreError(error) {
    // Ember 2.X seems to not catch `TransitionAborted` errors caused by regular redirects. We don't want these errors to show up in Sentry so we have to filter them ourselfs.
    // Once the issue https://github.com/emberjs/ember.js/issues/12505 is resolved we can remove this ignored error.
    if (error && error.name === 'TransitionAborted') { return true; }

    return this.ignoreError(error);
  },

  /**
   * Hook that allows for custom behavior when an
   * error is captured. An example would be to open
   * a feedback modal.
   *
   * @method didCaptureException
   * @param  {Error} error
   */
  didCaptureException() {},

  /**
   * Hook that allows error filtering in global
   * error catching methods.
   *
   * @method ignoreError
   * @param  {Error} error
   * @return {Boolean}
   */
  ignoreError() {
    return false;
  },

  /**
   * Runs a Raven method if it is available.
   *
   * @param  {String} methodName The method to call
   * @param  {Array} ...optional Optional method arguments
   * @return {any} Raven method return value or false
   * @throws {Error} If an error is captured and thrown
   */
  callRaven(methodName, ...optional) {
    if (get(this, 'isRavenUsable')) {
      try {
        return Raven[methodName].call(Raven, ...optional);
      } catch (error) {
        this.captureException(error);
        return false;
      }
    }
  }
});
