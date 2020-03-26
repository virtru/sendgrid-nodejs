'use strict';

/**
 * Dependencies
 */
const {Client} = require('@sendgrid/client');
const {classes: {Mail}} = require('@sendgrid/helpers');
const {encryptAttachments, encryptEmail} = require('./virtru-service');

const fs = require('fs');

require.extensions['.html'] = function (module, filename) {
  module.exports = fs.readFileSync(filename, 'utf8');
};

const previewTemplate = require('../templates/preview.html');

/**
 * Mail service class
 */
class MailService {

  /**
   * Constructor
   */
  constructor() {

    //Set client, initialize substitution wrappers and secret rules
    //filter
    this.setClient(new Client());
    this.setSubstitutionWrappers('{{', '}}');
    this.secretRules = [];
  }

  /**
   * Set client
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * API key pass through for convenience
   */
  setApiKey(apiKey) {
    this.client.setApiKey(apiKey);
  }

  /**
   * Set client timeout
   */
  setTimeout(timeout) {
    if (typeof timeout === 'undefined') {
      return;
    }

    this.client.setDefaultRequest('timeout', timeout);
  }

  /**
   * Set substitution wrappers
   */
  setSubstitutionWrappers(left, right) {
    if (typeof left === 'undefined' || typeof right === 'undefined') {
      throw new Error('Must provide both left and right side wrappers');
    }
    if (!Array.isArray(this.substitutionWrappers)) {
      this.substitutionWrappers = [];
    }
    this.substitutionWrappers[0] = left;
    this.substitutionWrappers[1] = right;
  }

  /**
   * Set secret rules for filtering the e-mail content
   */
  setSecretRules(rules) {
    if (!(rules instanceof Array)) {
      rules = [rules];
    }

    const tmpRules = rules.map(function(rule) {
      const ruleType = typeof rule;

      if (ruleType === 'string') {
        return {
          pattern: new RegExp(rule),
        };
      }
      else if (ruleType === 'object') {
        // normalize rule object
        if (rule instanceof RegExp) {
          rule = {
            pattern: rule,
          };
        }
        else if (rule.hasOwnProperty('pattern')
          && (typeof rule.pattern === 'string')
        ) {
          rule.pattern = new RegExp(rule.pattern);
        }

        try {
          // test if rule.pattern is a valid regex
          rule.pattern.test('');
          return rule;
        }
        catch (err) {
          // continue regardless of error
        }
      }
    });

    this.secretRules = tmpRules.filter(function(val) {
      return val;
    });
  }

  /**
   * Check if the e-mail is safe to be sent
   */
  filterSecrets(body) {
    if ((typeof body === 'object') && !body.hasOwnProperty('content')) {
      return;
    }

    const self = this;

    body.content.forEach(function(data) {
      self.secretRules.forEach(function(rule) {
        if (rule.hasOwnProperty('pattern')
          && !rule.pattern.test(data.value)
        ) {
          return;
        }

        let message = `The pattern '${rule.pattern}'`;

        if (rule.name) {
          message += `identified by '${rule.name}'`;
        }

        message += ` was found in the Mail content!`;

        throw new Error(message);
      });
    });
  }

  /**
   * Send email
   */
  send(data, isMultiple = false, cb) {

    //Callback as second parameter
    if (typeof isMultiple === 'function') {
      cb = isMultiple;
      isMultiple = false;
    }

    //Array? Send in parallel
    if (Array.isArray(data)) {

      //Create promise
      const promise = Promise.all(data.map(item => {
        return this.send(item, isMultiple);
      }));

      //Execute callback if provided
      if (cb) {
        promise
          .then(result => cb(null, result))
          .catch(error => cb(error, null));
      }

      //Return promise
      return promise;
    }

    //Send mail
    try {

      //Append multiple flag to data if not set
      if (typeof data.isMultiple === 'undefined') {
        data.isMultiple = isMultiple;
      }

      //Append global substitution wrappers if not set in data
      if (typeof data.substitutionWrappers === 'undefined') {
        data.substitutionWrappers = this.substitutionWrappers;
      }

      //Create Mail instance from data and get JSON body for request
      const mail = Mail.create(data);
      const body = mail.toJSON();

      //Filters the Mail body to avoid sensitive content leakage
      this.filterSecrets(body);

      //Create request
      const request = {
        method: 'POST',
        url: '/v3/mail/send',
        body,
      };

      //Send
      return this.client.request(request, cb);
    }

    //Catch sync errors
    catch (error) {

      //Pass to callback if provided
      if (cb) {
        // eslint-disable-next-line callback-return
        cb(error, null);
      }

      //Reject promise
      return Promise.reject(error);
    }
  }

  /**
   * For encryption provide Virtru Auth data in a key 'virtruAuth'
   * data.virtruAuth = {
   *     appId: APP_ID,
   *     'email': EMAIL,
   * } || {
   *     'email': EMAIL,
   *     'hmacToken': HMAC_TOKEN,
   *     'hmacSecret': HMAC_SECRET,
   * }
   * @param data
   * @param isMultiple
   * @param cb
   * @returns {*|*}
   */

  async sendEncrypted (data, isMultiple = false, cb) {
    const inputData = {...data};
    const { virtruAuth } = inputData;
    delete inputData.virtruAuth;
    const { attachments } = inputData;
    delete inputData.attachments;
    const sharedUserEmails = [
      inputData.to,
      inputData.from,
    ];
    const encryptedData = {...inputData};
    encryptedData.attachments = await encryptAttachments(attachments, virtruAuth, sharedUserEmails);
    return this.send(encryptedData, isMultiple, cb);
  }

  async sendEncryptedEmail (data, isMultiple = false, cb) {
    const inputData = {...data};
    const { virtruAuth } = inputData;
    delete inputData.virtruAuth;
    const { attachments } = inputData;
    delete inputData.attachments;
    const sharedUserEmails = [
      inputData.to,
      inputData.from,
    ];
    const encryptedData = {...inputData};
    encryptedData.html = await encryptEmail(virtruAuth, sharedUserEmails, inputData.html, attachments);
    return this.send(encryptedData, isMultiple, cb);
  }

  /**
   * Send multiple emails (shortcut)
   */
  sendMultiple(data, cb) {
    return this.send(data, true, cb);
  }
}

//Export class
module.exports = MailService;
