import Ember from 'ember';
import Raven from 'raven';

const {
  RSVP,
  Service,
  computed,
  typeOf
} = Ember;

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
   * Utility function used internally to check if Raven object
   * can capture exceptions and messages properly.
   *
   * @property isRavenUsable
   * @type Ember.ComputedProperty
   */
  isRavenUsable: computed(function() {
    return Raven.isSetup() === true;
  }).volatile(),

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
    if (this.get('isRavenUsable')) {
      Raven.captureMessage(...arguments);
    } else {
      throw new Error(message);
    }
    return true;
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
      const logger = this;
      const _oldOnError = Ember.onerror;

      Ember.onerror = function(error) {
        if (logger.ignoreError(error)) {
          return;
        }

        logger.captureException(error);
        if (typeof(_oldOnError) === 'function') {
          _oldOnError.call(this, error);
        }
      };

      RSVP.on('error', (reason, label) => {
        if (logger.ignoreError(reason)) {
          return;
        }

        if (typeOf(reason) === 'error') {
          this.captureException(reason, {
            extra: {
              context: label || this.get('unhandledPromiseErrorMessage'),
            },
          });
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

  /**
   * Hook that allows error filtering in global
   * error cacthing methods.
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
