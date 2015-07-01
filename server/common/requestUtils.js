/**
 * New node file
 */

var Database = require('../persistence/database');
var MessageGenerator = require('./messageGenerator');
var Version = require('./version');

var logger = require("./loggerUtil").getLogger("requestUtils");
var url = require('url');


function Util() {}
module.exports = exports = new Util();

Util.prototype.getServerURL = function(req) {
	if (!req)
		return this.serverURL;	// Already calculated it once.
	else
		return _getServerURL(req);
};

function _getServerURL(req) {
	// Generate based on request.
	var surl = url.parse('');
	
	// Datapower will switch https to http inside Bluemix ... so our server always see http requests
	surl.protocol = req ? (req.headers.$wssc ? req.headers.$wssc : 'http') : (process.env.VCAP_APP_HOST ? 'https' : 'http');
	if (!process.env.VCAP_APP_HOST)
		surl.port = 3000;
	if (process.env.VCAP_APPLICATION)
		surl.hostname = JSON.parse(process.env.VCAP_APPLICATION).application_uris[0];
	else if (process.env.VCAP_APP_HOST)
		surl.host = process.env.VCAP_APP_HOST;
	else
		surl.hostname = 'localhost';
	
	return surl.format();
}

Util.prototype.serverURL = _getServerURL();

/**
 * Error that produces a specific json output with specific code.
 * 
 * @param {String} msg the message to show if logged.
 * @param {Object} [json] json to return. If omitted then msg will be used to generate json
 * @param {Number} [code] the code to use. If omitted then code will BAD_REQUEST.
 * @param {boolean} [nolog] whether to log the error/stacktrace or not. If <code>true</code> then don't log, omitted is log it.
 */
function JsonResponseError(msg, json, code, nolog) {
	this.message = msg;
	this.name = 'JsonResponseError';
	if ('boolean' == typeof json) {
		nolog = json;
		json = undefined;
		code = undefined;
	} else if ('number' == typeof json) {
		code = json;
		json = undefined;
	}
	
	if ('boolean' == typeof code) {
		nolog = code;
		code = undefined;
	}
	
	this.json = json;
	this.code = code;
	this.nolog = nolog;
	
	Error.captureStackTrace(this);
}

JsonResponseError.prototype = Object.create(Error.prototype);
JsonResponseError.prototype.constructor = JsonResponseError;
JsonResponseError.prototype.name = 'JsonResponseError';

Util.prototype.JsonResponseError = JsonResponseError;

Util.prototype.httpcode = {
		"OK"								:		200,
		"CREATED"							:		201,
		"NO_CONTENT"						:		204,
		"PARTIAL_CONTENT"					:		206,
		
		"FOUND"								:		302,
		
		"BAD_REQUEST"						:		400,
		"UNAUTHORIZED"						:		401,
		"FORBIDDEN"                         :       403,
		"NOT_FOUND"							:		404,
		"METHOD_NOT_ALLOWED"				:       405,
		"NOT_ACCEPTABLE"					:		406,
		"CONFLICT"							:		409,
		
		"INTERNAL_ERROR"					:		500,
		"SERVICE_UNAVAILABLE"				:		503
	};

Util.prototype.okResponse = function (txtMessage, res) {
	res.statusCode = Util.prototype.httpcode.OK;
	res.setHeader('Content-Type', 'text/plain');
	res.write(txtMessage);
	res.end();
};

function getTextFromJson(json) {
	var txt = JSON.stringify (json, (function () {  // eliminate cirulcar nesting issues
		var visited = [];
		var didwe = function (val) {
			for (var i=0; i< visited.length; i++)
				if (visited[i] === val) return true;
			return false;
		};

		return function(key, value) {
			var v = value;
			if(typeof(value) == 'object' && didwe(value)) 
				v='[Circular]'; 

			visited.push(value);
			return v;  
		};
	})());
	
	return txt;
}

Util.prototype.okJsonResponse = function (json, res, code, headers) {
	if (json instanceof Error)
		json = { message: json.message };  // Errors do not serialize correctly.
	var txt = getTextFromJson(json);
	if (!code)
		code = Util.prototype.httpcode.OK;
	try {
		res.setHeader('Content-Type', 'application/json');
		if (headers) {
			for (var name in headers) {
				if (headers.hasOwnProperty(name)) {
					res.setHeader(name, headers[name]);
				}
			}
		}
		res.statusCode = code;
		res.write(txt);
		res.end();
	}
	catch (e) {
		console.error(e);
		console.trace();
	}
};

Util.prototype.okPartialJsonResponse = function (json, res) {
	var txt = getTextFromJson(json);
	try {
		res.statusCode = Util.prototype.httpcode.PARTIAL_CONTENT;
		res.setHeader('Content-Type', 'application/json');
		res.write(txt);
		res.end();
	}
	catch (e) {
		console.error(e);
		console.trace();
	}
};


Util.prototype.errResponse = function (json, res) {
	var rc;
	if (json instanceof Database.NotEntitledError)
		rc = Util.prototype.httpcode.FORBIDDEN;
	else if (json instanceof Profile.NotAuthorizedError)
		rc = Util.prototype.httpcode.UNAUTHORIZED;
	else if (json instanceof Util.prototype.JsonResponseError) {
		rc = json.code ? json.code : Util.prototype.httpcode.BAD_REQUEST;
	} else
		rc = Util.prototype.httpcode.BAD_REQUEST;
	
	exports.errCodeResponse(json, rc, res);
};


Util.prototype.errCodeResponse = function (json, code, res) {
	try {
		if (json && json.stack) {
			if (!json.nolog) {
				// It is an exception, print stack trace.
				console.error("Bad Request("+code+"): "+json.stack);
			}
			if (json.json)
				json = json.json;
			else if ('function' != typeof json.toJSON)
				json = { message: json.toString()};	// Error objects don't serialize (JSON.stringify) into anything other than {}, which is not useful.
		} else
			console.error("Bad Request("+code+"): ", json);
		
		res.statusCode = code;
		res.setHeader('Content-Type', 'application/json');
		res.write(JSON.stringify(json && json.toJson && 'function' == typeof json.toJSON ? json.toJSON() : json));
		res.end();
	}
	catch (e) {
		console.error(e);
		console.trace();
	}
};

/**
 * Provide an error response with an unified message format
 * @param req, the http request
 * @param messageCode, the message code 
 * @param replacement, the values used to replace the placeholder in message pattern
 * @param cause, the Error thrown by the early code in the call stack
 * @param httpStatusCode,  response http status code
 * @param res
 */
Util.prototype.unifiedErrorResponse = function (req, messageCode, 
												replacement, cause, httpStatusCode, res) {
	try {
		var msgGen = new MessageGenerator(req.headers["accept-language"]);
		msgGen.setHTTPStatusCode(httpStatusCode);
		msgGen.setMessageCode(messageCode, replacement);
		msgGen.setDetails(cause);
		res.statusCode = httpStatusCode;
		res.setHeader('Content-Type', 'application/json');
		res.write(msgGen.toJSONString());
		res.end();
		
	} catch (e) {
		console.error(e);
		console.trace();
	}
};

/*
 * Calls the appropriate request handler based on the accept header.
 * 
 * The handlers parameter is a map of mime-type (string) -> function
 */
Util.prototype.accept = function (req, handlers) {
	if (!handlers)
		return;
	var keys = Object.keys(handlers);
	var bestMatch = req.accepts(keys);
	keys.forEach(function(mimeType) {
		if (bestMatch === mimeType && typeof handlers[mimeType] === 'function') {
			handlers[mimeType]();
			return;
		}
	});
};

/**
 * See if this request accepts json as primary. 
 * <p>
 * If coming from a browser then html has a higher priority than json
 * so in that case return false. Otherwise if it accepts json return true.
 */
Util.prototype.acceptsJson = function(req) {
	return req.accepts(['html', 'json']) == 'json';
};

/*
 * Check to see if the request is for anonymous or logged in user
 * 
 *  @param {req}  original server request
 *
 *  @return true not logged in, false user is logged in
 */
Util.prototype.isAnonymous = function (req) {
	var u = req.user;
    return (!u || u._id.equals(Database.AllUsers_id));
};

/**
 * Dynamically register versioning accept handler before
 * go into httpUtil.accept
 * @param req
 * @param handlers each key is the accept Media type and the value is a function to execute for that type.
 * The order of the keys is important. If two keys have same priority the first one found will be selected.
 * @returns
 */
Util.prototype.versioningAccept = function(req, handlers, res) {
	var methodName = "versioningAccept()";
	if (handlers === undefined) return exports.accept(req, handlers);
	var apiVersion = Version.parseAcceptHeader(req.accepted).toQualifiedString();
	var keys = Object.keys(handlers);
	keys.forEach(function(mimeType) {
		var type = mimeType.substring(0, mimeType.indexOf("/"));
		var subType = mimeType.substring(mimeType.indexOf("/") + 1);
		if (subType.indexOf(apiVersion) === 1) return;
		var versioningKey = type + "/" + apiVersion + "+" + subType;
		handlers[versioningKey] = handlers[mimeType];
	});
	
	keys = Object.keys(handlers);
	var bestMatch = req.accepts(keys);
	if (undefined === bestMatch) {
		var error = new Error("Can not to find out a best matched accept handler for req.accepted: " + JSON.stringify(req.accepted));
		logger.error(methodName, error);
		return exports.unifiedErrorResponse(req, 
				"CDVR0002E", 
				[JSON.stringify(req.accepted), "<type>/" + Version.config.versionPrefix + "v<major>.<minor>+<subType>"], 
				error, 
				exports.httpcode.NOT_ACCEPTABLE, 
				res);
	}
	
	return exports.accept(req, handlers);
};


//the http request timeout value, default is 90 seconds
Util.prototype.httpRequestTimeout = (process.env.DEFAULT_HTTP_REQUEST_TIMEOUT || 90) * 1000;
logger.debug("The HTTP request timeout value is " + Util.prototype.httpRequestTimeout + "ms");
