/* eslint-disable ember/avoid-leaking-state-in-ember-objects */

import Ember from 'ember';
import { assign as _assign, merge } from '@ember/polyfills';
import Service from '@ember/service';
import { set } from '@ember/object';
import { typeOf, isPresent } from '@ember/utils';

import RSVP from 'rsvp';
import Raven from 'raven';

// Ember merge is deprecated as of 2.5, but we need to check for backwards
// compatibility.
const assign = _assign || merge;

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
  ignoreErrors: [],

  /**
   * Ignore errors if any of the stack trace file paths matches any string or regex in this list.
   *
   * @property ignoreUrls
   * @type Array
   */
  ignoreUrls: [],

  /**
   * Utility function used internally to check if Raven object
   * can capture exceptions and messages properly.
   *
   * @property isRavenUsable
   * @type Ember.ComputedProperty
   */
  get isRavenUsable() {
    return typeof(FastBoot) === 'undefined' && Raven.isSetup() === true;
  },

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

    let ignoreErrors = this.get('ignoreErrors');
    if (isPresent(ignoreErrors)) {
      set(ravenOptions, 'ignoreErrors', ignoreErrors);
    }

    set(ravenOptions, 'ignoreUrls', this.get('ignoreUrls'));

    try {
      Raven.debug = debug;

      // Keeping existing config values for includePaths, whitelistUrls, for compatibility.
      const ravenConfig = assign({
        environment,
        includePaths,
        whitelistUrls,
        release: this.get(serviceReleaseProperty) || config.APP.version
      }, ravenOptions);

      Raven.config(dsn, ravenConfig);
    } catch (e) {
      console.warn('Error during `sentry` initialization: ' + e);
      return;
    }

    Raven.install();

    const { globalErrorCatching = true } = config.sentry;

    if (globalErrorCatching === true) {
      this.enableGlobalErrorCatching();
    }

    this.postSetup();
  },

  /**
   * Tries to have Raven capture exception, or throw it.
   *
   * @method captureException
   * @param {Error} error The error to capture
   * @throws {Error} An error if Raven cannot capture the exception
   */
  captureException(error) {
    if (this.get('isRavenUsable')) {
      Raven.captureException(...arguments);
    } else {
      console.error(error);
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
    if (this.get('isRavenUsable')) {
      Raven.captureMessage(...arguments);
    } else {
      console.info(message);
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
    if (this.get('isRavenUsable')) {
      Raven.captureBreadcrumb(...arguments);
    } else {
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
    if (this.get('isRavenUsable') && !this.get('globalErrorCatchingInitialized')) {
      const _oldOnError = Ember.onerror;

      Ember.onerror = (error) => {
        if (this._ignoreError(error)) {
          return;
        }

        this.captureException(error, {
          extra: this.getCaptureExtra(error),
          tags: this.getCaptureTags(error),
        });
        this.didCaptureException(error);
        if (typeof(_oldOnError) === 'function') {
          _oldOnError.call(Ember, error);
        }
      };

      RSVP.on('error', (reason, label) => {
        if (this._ignoreReason(reason)) {
          return;
        }

        if (typeOf(reason) === 'error') {
          this.captureException(reason, {
            extra: assign({}, this.getCaptureExtra(reason), {
              context: label || this.get('unhandledPromiseErrorMessage'),
            }),
            tags: this.getCaptureTags(reason)
          });
          this.didCaptureException(reason);
        } else {
          this.captureMessage(this._extractMessage(reason), {
            extra: assign({}, this.getCaptureExtra(reason), {
              reason,
              context: label,
            }),
            tags: this.getCaptureTags(reason)
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
    const defaultMessage = this.get('unhandledPromiseErrorMessage');
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
    if (this._ignoreTransitionAborted(error)) { return true; }
    return this.ignoreError(error);
  },

  _ignoreReason(reason) {
    if (this._ignoreTransitionAborted(reason)) { return true; }
    return this.ignoreReason(reason);
  },

  _ignoreTransitionAborted(error) {
    // Ember 2.X seems to not catch `TransitionAborted` errors caused by regular redirects. We don't want these errors to show up in Sentry so we have to filter them ourselfs.
    // Once the issue https://github.com/emberjs/ember.js/issues/12505 is resolved we can remove this ignored error.
    return (error && error.name === 'TransitionAborted');
  },

  /**
   * Hook that executes after Raven is setup.
   *
   * @method postSetup
   */
  postSetup() {},

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
 * Hook that allows promise rejection reason filtering
 * in global error catching methods.
 *
 * @method ignoreReason
 * @param  {Object} reason
 * @return {Boolean}
 */
  ignoreReason() {
    return false;
  },

  /**
   * Hook that gets the extra of each error in global
   * error catching methods.
   *
   * @method getCaptureExtra
   * @param  {Error} error
   * @return {Object}
   */
  getCaptureExtra() {
    return {};
  },

  /**
   * Hook that gets the tags of each error in global
   * error catching methods.
   *
   * @method getCaptureTags
   * @param  {Error} error
   * @return {Object}
   */
  getCaptureTags() {
    return {};
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
    if (this.get('isRavenUsable')) {
      try {
        return Raven[methodName].call(Raven, ...optional);
      } catch (error) {
        this.captureException(error);
        return false;
      }
    }
  }
});
