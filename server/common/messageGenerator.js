/**
 * This module is used for construct an error response message with unified format as well as 
 * i18n support.
 * 
 * The message file should be located in the directory of <TenX_SRC_Home>/resources/messages, 
 * and the file name follows below conventions:
 *		tenXPIIMessages_<locale>.json
 * The prefix for the message file name is:
 *		tenXPIIMessages_
 * The locale expression in the message file should consist ISO-639 language abbreviation 
 * and optional two-letter ISO-3166 country code
 *	e.g:
 *		en, en_US, zh, zh_CN
 * The extension message file name is:
 *		.json 
 * 
 * The error message have below structure:
 * 
 *	{
 *		"<ErrorCode>": "<message text>"
 *	}
 * 
 * ErrorCode = <ComponentPrefix><MessageNumber><TypeCode>
 * Briefly:	
 * ComponentPrefix: the component prefix -- <componentShortName><sub-componentShortName>
 *		e.g: 'CDVR' stands for CollectionData Versioning
 * MessageNumber:  four digit numbers, from '0000' to '9999', it should be filled to the left with '0', to a width of 4.
 * Valid message type codes are:
 *     I (Informational)
 *     W (Warning)
 *     E (Error)
 * 
 * The <message text> is a user readable description for the problem, it is a i18n string,
 *	e.g:
 *		Wrong API version '{0}' is specified in '{1}' request
 * The placeholder should be wrapped by {}, and the key is a number
 * 
 * The error message toJSONString method will serialize the error message to a JSON string, below is an example 
 * for this:
 * 
 * {
 *	"HTTPStatusCode":406,
 *	"Message":"CDVR0001E:  Wrong API version 2.0 is specified in collection API request
 *	"Document":"http://xxxx.xxx.xxx",
 *	"Details":"Error: a exception thrown for testing\n .... at startup (node.js:124:16)\n    at node.js:803:3"
 * }
 * 
 * The document section contains a online url for the details/user action for the particular error code, 
 * the baseUrl can be configured in the <TenX_SRC_Home>/config/faultCodeHelper.json file, the tag of isEnabled 
 * will indicate whether the on-line helper is enabled
 * 
 */

var locale = require("locale");
var path = require("path");
var fs = require("fs");
var MessageFormat = require("messageformat");

var logger = require("./loggerUtil").getLogger("messageGenerator");

var isInitialed = false;
var messageFileNamePrefix = "tenXPIIMessages_";
var messageFileExtentionName = ".json";
var messageDir = path.resolve(__dirname, "../resources/messages/");
var supportedLocales = [];
var msgsByLocale = {};
var defaultLocale = "en";
var faultCodeHelperPath = path.resolve(__dirname, "../faultCodeHelper.json");
var faultCodeHelper = JSON.parse(fs.readFileSync(faultCodeHelperPath, 'utf8'));
var Q = require('q');
var readFile = Q.denodeify(fs.readFile);

/**
 * Construct a FaultMessage based on the best locale
 * The toJSONString() method is the one we serialize 
 * a unified fault message
 * 
 * @param acceptLang the HTTP accept-language header
 */
var MessageGenerator = function(acceptLang) {
	var methodName = "messageGenerator()";

	if (acceptLang === undefined || "" === acceptLang) {
		acceptLang = defaultLocale;
	}
	
	var accepts = new locale.Locales(acceptLang);
	this.bestLocale = accepts.best(new locale.Locales(supportedLocales));
	logger.debug(methodName, "The accept-language header is " + acceptLang +
			", supported language is " + supportedLocales +
			", the best locale for the request is " + this.bestLocale);
};

/**
 * Helper function to detect/load fault message 
 * and initial the supported locales scope
 * 
 */
MessageGenerator.init = function init() {
	var methodName = "init()";
	
	logger.debug(methodName, "MessageGenerator initialization start");
	
	fs.readdir(messageDir, function(error, files){
		if (error) {
			logger.error("Failed to read folder -" + messageDir);
			return;
		}
		
		var promises = files.map(function(name) {
			if (name.indexOf(messageFileNamePrefix) !== 0 || name.indexOf(messageFileExtentionName) === -1) {
				return;
			}
			var localeStr = name.substring(messageFileNamePrefix.length, name.lastIndexOf("."));
			supportedLocales.push(localeStr);
			return readFile(path.join(messageDir, name), ["utf8"]);
		
		});
		
		Q.all(promises).then(function(messages) {
			for (var i = 0; i < messages.length; i++) {
				var localeStr = supportedLocales[i];
				logger.debug(methodName, "Populate JSON message for locale - [" + supportedLocales[i] + "] from message file - " + files[i]);
				msgsByLocale[localeStr] = JSON.parse(messages[i]);
			}
			locale.Locale["default"] = defaultLocale;
			isInitialed = true;
			logger.debug(methodName, "MessageGenerator initialized successfully");
		});
	});
};

/**
 * Return the status whether messages are initialed
 */
MessageGenerator.isInitialed = function isInitialed() {
	return isInitialed;
};

/**
 * private function to composite the replacement expression for messageformat
 */
function _getReplaceExpression(messageTemplate, vars) {
	if (vars === undefined || messageTemplate === undefined) {
		return;
	}
	var placeHolders = messageTemplate.match(/\{[0-9]*\}/g);
	if (placeHolders === undefined) {
		return;
	}
	var replacement = {};
	for (var i = 0; i < vars.length; i++) {
		var key = placeHolders[i].substring(1, placeHolders[i].length - 1);
		replacement[key] = vars[i];
	}
	return replacement;
}

MessageGenerator.prototype = {
		
	setHTTPStatusCode: function(statusCode) {
		this.httpStatusCode = statusCode;
	},

	setMessageCode: function(_msgCode, vars) {
		var methodName = "setMessageCode()";
		this.messageCode = _msgCode;
		var messages = msgsByLocale[this.bestLocale];
		if (vars === undefined) {
			this.message = messages[_msgCode]; 
		} else {
			var replacement = _getReplaceExpression(messages[_msgCode], vars);
			logger.debug(methodName, "The expression of message placeholder replacement is " + JSON.stringify(replacement));
			var mf = new MessageFormat();
			var msg = mf.compile(messages[_msgCode]);
			this.message = msg(replacement);
		}
		
		this.docLink = faultCodeHelper.baseUrl + _msgCode;
	},
	
	setDetails: function(_error) {
		this.cause = _error;
	}, 
	
	toJSONString: function() {
		var message = {};
		message.HTTPStatusCode = this.httpStatusCode;
		message.Message = this.messageCode+ ":" + this.message;
		// the document link is a optional value
		if (faultCodeHelper.isEnabled) {
			message.Document = this.docLink;
		}
		// the error stack is optional value
		if (undefined !== this.cause) {
			if (this.cause instanceof Error) {
				message.Details = this.cause.stack;
			} else {
				message.Details = this.cause;
			}
		}
		return JSON.stringify(message);
	}
};

module.exports = MessageGenerator;