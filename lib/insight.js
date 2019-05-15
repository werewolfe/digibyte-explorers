'use strict';

var request = require('request');

var digibyte = require('digibyte');
var _ = digibyte.deps._;

var $ = digibyte.util.preconditions;
var Address = digibyte.Address;
var JSUtil = digibyte.util.js;
var Networks = digibyte.Networks;
var Transaction = digibyte.Transaction;
var UnspentOutput = Transaction.UnspentOutput;
var AddressInfo = require('./models/addressinfo');


/**
 * Allows the retrieval of information regarding the state of the blockchain
 * (and broadcasting of transactions) from/to a trusted Insight server.
 * @param {string=} url the url of the Insight server
 * @param {Network=} network whether to use livenet or testnet
 * @constructor
 */
function Insight(url, network) {
  if (!url && !network) {
    return new Insight(Networks.defaultNetwork);
  }
  if (Networks.get(url)) {
    network = Networks.get(url);
    if (network === Networks.livenet) {
      url = 'https://digibyte.block30enterprise.com';
    } else {
      url = 'https://digibyte.block30enterprise.com';
    }
  }
  JSUtil.defineImmutable(this, {
    url: url,
    network: Networks.get(network) || Networks.defaultNetwork
  });
  this.request = request;
  return this;
}

/**
 * @callback Insight.GetTransactionCallback
 * @param {Error} err
 * @param {Object} transaction
 */

/**
 * Get transaction by txid
 * @param {string} txid
 * @param {GetTransactionCallback} callback
 */
Insight.prototype.getTransaction = function(txid, callback) {
  $.checkArgument(_.isFunction(callback));
  $.checkArgument(_.isString(txid));
  $.checkArgument(txid.length === 64);

  this.requestGet('/insight-digibyte-api/tx/' + txid, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || res);
    }
    var tx = JSON.parse(body);

    return callback(null, tx);
  });
};

/**
 * @callback Insight.GetUtxosCallback
 * @param {Error} err
 * @param {Array.UnspentOutput} utxos
 */

/**
 * Retrieve a list of unspent outputs associated with an address or set of addresses
 * @param {Address|string|Array.Address|Array.string} addresses
 * @param {GetUtxosCallback} callback
 */
Insight.prototype.getUtxos = function(addresses, callback) {
  $.checkArgument(_.isFunction(callback));
  if (!_.isArray(addresses)) {
    addresses = [addresses];
  }
  addresses = _.map(addresses, function(address) {
    return new Address(address);
  });

  this.requestPost('/insight-digibyte-api/addrs/utxo', {
    addrs: _.map(addresses, function(address) {
      return address.toString();
    }).join(',')
  }, function(err, res, unspent) {
    if (err || res.statusCode !== 200) {
      return callback(err || res);
    }
    try {
      unspent = _.map(unspent, UnspentOutput);
    } catch (ex) {
      if (ex instanceof digibyte.errors.InvalidArgument) {
        return callback(ex);
      }
    }

    return callback(null, unspent);
  });
};

/**
 * @callback Insight.BroadcastCallback
 * @param {Error} err
 * @param {string} txid
 */

/**
 * Broadcast a transaction to the bitcoin network
 * @param {transaction|string} transaction
 * @param {BroadcastCallback} callback
 */
Insight.prototype.broadcast = function(transaction, callback) {
  $.checkArgument(JSUtil.isHexa(transaction) || transaction instanceof Transaction);
  $.checkArgument(_.isFunction(callback));
  if (transaction instanceof Transaction) {
    transaction = transaction.serialize({disableMoreOutputThanInput: true});
  }

  this.requestPost('/insight-digibyte-api/tx/send', {
    rawtx: transaction
  }, function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || body);
    }
    return callback(null, body ? body.txid : null);
  });
};

/**
 * @callback Insight.AddressCallback
 * @param {Error} err
 * @param {AddressInfo} info
 */

/**
 * Retrieve information about an address
 * @param {Address|string} address
 * @param {AddressCallback} callback
 */
Insight.prototype.address = function(address, callback) {
  $.checkArgument(_.isFunction(callback));
  address = new Address(address);

  this.requestGet('/insight-digibyte-api/addr/' + address.toString(), function(err, res, body) {
    if (err || res.statusCode !== 200) {
      return callback(err || body);
    }
    var info;
    try {
      info = AddressInfo.fromInsight(body);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return callback(e);
      }
      throw e;
    }
    return callback(null, info);
  });
};

/**
 * Internal function to make a post request to the server
 * @param {string} path
 * @param {?} data
 * @param {function} callback
 * @private
 */
Insight.prototype.requestPost = function(path, data, callback) {
  $.checkArgument(_.isString(path));
  $.checkArgument(_.isFunction(callback));
  this.request({
    method: 'POST',
    url: this.url + path,
    json: data
  }, callback);
};

/**
 * Internal function to make a get request with no params to the server
 * @param {string} path
 * @param {function} callback
 * @private
 */
Insight.prototype.requestGet = function(path, callback) {
  $.checkArgument(_.isString(path));
  $.checkArgument(_.isFunction(callback));
  this.request({
    method: 'GET',
    url: this.url + path
  }, callback);
};

module.exports = Insight;
