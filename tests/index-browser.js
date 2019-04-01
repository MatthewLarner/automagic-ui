(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var predator = require('predator');
var scrollIntoView = require('scroll-into-view');

// List of selectors ordered by their likeliness to be the target of text/click/value selection
var textWeighting = ['h1', 'h2', 'h3', 'h4', 'label', 'p', 'a', 'button', '[role=button]'];
var clickWeighting = ['button', '[role=button]', 'input', 'a', 'h1', 'h2', 'h3', 'h4', 'i', 'label'];
var valueWeighting = ['input', 'textarea', 'select', 'label'];

var types = {
        'button': ['button', 'a', 'input[type=button]', '[role=button]'],
        'label': ['label', 'span', ':not([role=button])'],
        'heading': ['[role=heading]', 'h1', 'h2', 'h3', 'h4'],
        'image': ['img', 'svg', '[role=img]'],
        'field': ['input', 'textarea', 'select', 'label'],
        'all': ['*'],
        'text': ['*']
    },
    noElementOfType = 'no elements of type ',
    documentScope,
    windowScope,
    runDelay,
    keyPressDelay,
    initialised;

function _pressKey(key, done) {
    var element = this.currentContext.activeElement;

    element.value += key;

    var keydownEvent = new windowScope.KeyboardEvent('keydown'),
        keyupEvent = new windowScope.KeyboardEvent('keyup'),
        pressKeyEvent = new windowScope.KeyboardEvent('pressKey');

    var method = 'initKeyboardEvent' in keydownEvent ? 'initKeyboardEvent' : 'initKeyEvent';

    keydownEvent[method]('keydown', true, true, windowScope, key, 3, true, false, true, false, false);
    keyupEvent[method]('keyup', true, true, windowScope, key, 3, true, false, true, false, false);
    pressKeyEvent[method]('pressKey', true, true, windowScope, key, 3, true, false, true, false, false);

    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keyupEvent);
    element.dispatchEvent(pressKeyEvent);

    done(null, element);
}

function _pressKeys(keys, done) {
    var state = this,
        nextKey = String(keys).charAt(0);

    if(nextKey === ''){
        return done(null, this.currentContext.activeElement);
    }

    _pressKey.call(state, nextKey, function() {
        setTimeout(function(){
            _pressKeys.call(state, String(keys).slice(1), done);
        }, state.keyPressDelay);
    });
}

function findUi(currentContex, selectors) {
    var candidates = Array.prototype.slice.call(currentContex.querySelectorAll(selectors));

    return candidates.sort(function(a, b){
            return !a.contains(b) ? -1 : 0;
        }); // deeper elements take precedence.
}

function _navigate(location, previousElement, done) {
    var callbackTimer;

    function handlewindowScopeError(error) {
        clearTimeout(callbackTimer);

        done(error);
        windowScope.removeEventListener('error', handlewindowScopeError);
    }

    windowScope.addEventListener('error', handlewindowScopeError);
    windowScope.location = location;

    callbackTimer = setTimeout(done, 150);
}

function _getLocation(done) {
    setTimeout(function() {
        done(null, windowScope.location);
    }, 500);
}

function checkMatchValue(targetValue, value){
    if(value instanceof RegExp){
        return targetValue && targetValue.match(value);
    }

    return targetValue && targetValue.toLowerCase().trim() === value.toLowerCase();
}

function matchElementValue(element, value) {
    return (
        checkMatchValue(element.textContent, value) ||
        checkMatchValue(element.getAttribute('title'), value) ||
        checkMatchValue(element.getAttribute('placeholder'), value) ||
        checkMatchValue(element.getAttribute('aria-label'), value) ||
        checkMatchValue(element.value, value)
    );
}

function findMatchingElements(value, type, elementsList) {
    return Array.prototype.slice.call(elementsList)
        .filter(function(element) {
            return matchElementValue(element, value);
        });
}

function getElementTextWeight(element) {
    var index = textWeighting.findIndex(selector => element.matches(selector));
    return textWeighting.length - (index < 0 ? Infinity : index);
}

function getElementClickWeight(element) {
    var index = clickWeighting.findIndex(selector => element.matches(selector));
    return clickWeighting.length - (index < 0 ? Infinity : index);
}

function getElementValueWeight(element) {
    var index = valueWeighting.findIndex(selector => element.matches(selector));
    return valueWeighting.length - (index < 0 ? Infinity : index);
}

function _findAllUi(value, type, done){
    if(!type){
        type = 'all';
    }

    var elementTypes = types[type];


    if(!elementTypes) {
        return done(new Error(type + ' is not a valid ui type'));
    }

    var elements = findUi(this.currentContext, elementTypes);

    if(!elements.length) {
        return done(new Error(noElementOfType + type));
    }

    var results = findMatchingElements(value, type, elements)
        .sort(function(a, b) {
            return getElementTextWeight(b) - getElementTextWeight(a);
        });

    done(null, results);
}

function _findUi(value, type, returnArray, done) {
    if(!done) {
        done = returnArray;
        returnArray = false;
    }

    _findAllUi.call(this, value, type, function(error, elements){
        if(error){
            return done(error);
        }

        if(!elements.length){
            return done(new Error('"' + value + '" was not found'));
        }

        var results = Array.prototype.slice.call(elements)
            .filter(function(element){
                return !predator(element).hidden;
            });

        if(!results.length){
            return done(new Error('"' + value + '" was found but not visible on screen'));
        }

        done(null, returnArray ? results : results.shift());
    });
}

function _setValue(value, type, text, done) {
    _focus.call(this, value, type, function(error, element) {
        if(error){
            return done(error);
        }

        element.value = text;

        done(null, element);
    });
}

function _wait(time, done) {
    setTimeout(done, time || 0);
}

function findClickable(currentContext, elements){
    for(var i = 0; i < elements.length; i++){
        var element = elements[i];
            rect = element.getBoundingClientRect(),
            clickElement = currentContext.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
            clickElementInElement = element.contains(clickElement),
            elementInClickElement = clickElement.contains(element);

        if(clickElementInElement || elementInClickElement || clickElement === element){
            return clickElement;
        }
    }
}

function executeClick(value, type, done) {
    var state = this;
    _findUi.call(state, value, 'all', true, function(error, elements) {
        if(error) {
            return done(error);
        }

        var clickableElements = elements
            .sort(function(a, b) {
                return getElementClickWeight(b) - getElementClickWeight(a);
            });

        var element = findClickable(state.currentContext, elements);

        if(!element) {
            return done(new Error('could not find clickable element matching "' + value + '"'));
        }

        // SVG paths
        while(!element.click){
            element = element.parentNode;
        }

        element.click();

        setTimeout(function(){
            done(null, element);
        }, clickDelay)

    });
}

function _focus(value, type, done) {
   _findUi.call(this, value, type, true, function(error, elements){
        if(error){
            return done(error);
        }

        var result = elements
            .sort(function(a, b) {
                return getElementValueWeight(b) - getElementValueWeight(a);
            })
            .shift();

        result.focus();

        done(null, result);
   });
}

function _changeValue(value, type, text, done) {
    var state = this;

    _focus.call(state, value, type, function(error, element) {
        if(error){
            return done(error);
        }

        _pressKeys.call(state, text, function(error){
            if(error){
                return done(error);
            }

            element.blur();

            var event = document.createEvent('HTMLEvents');

            event.initEvent('change', false, true);
            element.dispatchEvent(event);

            done(null, element);
        });
    });
}

function _getValue(value, type, done) {
    _focus.call(this, value, type, function(error, element) {
        if(error){
            return done(error);
        }

        done(null, 'value' in element ? element.value : element.textContent);
    });
}

function _then(task, done) {
    var state = this;
    task(state.lastResult, done);
}

function _blur(done) {
    var element = this.currentContext.activeElement;
    element.blur();

    done(null, element);
}

function _scrollTo(value, type, done){
    _findAllUi.call(this, value, type, function(error, elements) {
        if(error) {
            return done(error);
        }

        if(!elements.length){
            return done(new Error('"' + value + '" was not found'));
        }

        var targetElement = elements.shift();

        scrollIntoView(targetElement, { time: 50 }, function(){
            done(null, targetElement);
        });
    });
}

function runTasks(state, tasks, callback) {
    if(tasks.length) {
        tasks.shift()(function(error, result) {
            if(error) {
                return callback(error);
            } else {
                state.lastResult = result;

                if(tasks.length === 0) {
                    callback(null, result);
                } else {
                    runTasks(state, tasks, callback);
                }
            }
        });
    }
}

function driveUi(currentContext){
    var tasks = [],
        driverFunctions = {},
        state = {
            currentContext: currentContext || documentScope
        };

    function addTask(task){
        tasks.push(task);

        return driverFunctions;
    }

    driverFunctions = {
        navigate: function(location){
            return addTask(_navigate.bind(state, location));
        },
        findUi: function(value, type){
            return addTask(_findUi.bind(state, value, type));
        },
        getLocation: function() {
            return addTask(_getLocation.bind(state));
        },
        focus: function(value, type) {
            return addTask(_focus.bind(state, value, type));
        },
        blur: function() {
            return addTask(_blur.bind(state));
        },
        click: function(value, type){
            return addTask(executeClick.bind(state, value, type));
        },
        pressKey: function(value) {
            return addTask(_pressKey.bind(state, value));
        },
        pressKeys: function(value) {
            return addTask(_pressKeys.bind(state, value));
        },
        changeValue: function(value, type, text) {
            return addTask(_changeValue.bind(state, value, type, text));
        },
        setValue: function(value, type, text) {
            return addTask(_setValue.bind(state, value, type, text));
        },
        getValue: function(value, type) {
            return addTask(_getValue.bind(state, value, type));
        },
        wait: function(time) {
            if(!arguments.length) {
                time = runDelay;
            }

            return addTask(_wait.bind(state, time));
        },
        do: function(driver){
            return addTask(driver.go);
        },
        then: function(task){
            return addTask(_then.bind(state, task));
        },
        in: function(value, type, addSubTasks){
            return addTask(function(done){
                _findUi.call(state, value, type, function(error, element){
                    if(error){
                        return done(error);
                    }

                    var newDriver = driveUi(element);

                    addSubTasks(newDriver);

                    newDriver.go(done);
                });
            });
        },
        check: function(task){
            return addTask(function(callback){
                task(state.lastResult, callback);
            });
        },
        scrollTo: function(value, type){
            return addTask(_scrollTo.bind(state, value, type));
        },
        go: function(callback) {
            if(!initialised) {
                throw(new Error('init must becalled before calling go'));
            }

            if(tasks.length) {
                tasks.unshift(_wait.bind(state, runDelay));
                runTasks(state, tasks, callback);
            } else {
                callback(new Error('No tasks defined'));
            }
        }
    };

    return driverFunctions;
}

driveUi.init = function(settings) {
    documentScope = settings.document || document;
    windowScope = settings.window || window;
    runDelay = settings.runDelay || 0;
    clickDelay = settings.clickDelay || 100;
    keyPressDelay = settings.keyPressDelay || 50;

    initialised = true;
};

module.exports = driveUi;

},{"predator":31,"scroll-into-view":51}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})

},{"../../is-buffer/index.js":24}],4:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":5,"./lib/keys.js":6}],5:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],6:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}],7:[function(require,module,exports){
'use strict';

var keys = require('object-keys');
var hasSymbols = typeof Symbol === 'function' && typeof Symbol('foo') === 'symbol';

var toStr = Object.prototype.toString;
var concat = Array.prototype.concat;
var origDefineProperty = Object.defineProperty;

var isFunction = function (fn) {
	return typeof fn === 'function' && toStr.call(fn) === '[object Function]';
};

var arePropertyDescriptorsSupported = function () {
	var obj = {};
	try {
		origDefineProperty(obj, 'x', { enumerable: false, value: obj });
		// eslint-disable-next-line no-unused-vars, no-restricted-syntax
		for (var _ in obj) { // jscs:ignore disallowUnusedVariables
			return false;
		}
		return obj.x === obj;
	} catch (e) { /* this is IE 8. */
		return false;
	}
};
var supportsDescriptors = origDefineProperty && arePropertyDescriptorsSupported();

var defineProperty = function (object, name, value, predicate) {
	if (name in object && (!isFunction(predicate) || !predicate())) {
		return;
	}
	if (supportsDescriptors) {
		origDefineProperty(object, name, {
			configurable: true,
			enumerable: false,
			value: value,
			writable: true
		});
	} else {
		object[name] = value;
	}
};

var defineProperties = function (object, map) {
	var predicates = arguments.length > 2 ? arguments[2] : {};
	var props = keys(map);
	if (hasSymbols) {
		props = concat.call(props, Object.getOwnPropertySymbols(map));
	}
	for (var i = 0; i < props.length; i += 1) {
		defineProperty(object, props[i], map[props[i]], predicates[props[i]]);
	}
};

defineProperties.supportsDescriptors = !!supportsDescriptors;

module.exports = defineProperties;

},{"object-keys":28}],8:[function(require,module,exports){
module.exports = function () {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) return arguments[i];
    }
};

},{}],9:[function(require,module,exports){
'use strict';

/* globals
	Set,
	Map,
	WeakSet,
	WeakMap,

	Promise,

	Symbol,
	Proxy,

	Atomics,
	SharedArrayBuffer,

	ArrayBuffer,
	DataView,
	Uint8Array,
	Float32Array,
	Float64Array,
	Int8Array,
	Int16Array,
	Int32Array,
	Uint8ClampedArray,
	Uint16Array,
	Uint32Array,
*/

var undefined; // eslint-disable-line no-shadow-restricted-names

var ThrowTypeError = Object.getOwnPropertyDescriptor
	? (function () { return Object.getOwnPropertyDescriptor(arguments, 'callee').get; }())
	: function () { throw new TypeError(); };

var hasSymbols = typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol';

var getProto = Object.getPrototypeOf || function (x) { return x.__proto__; }; // eslint-disable-line no-proto

var generator; // = function * () {};
var generatorFunction = generator ? getProto(generator) : undefined;
var asyncFn; // async function() {};
var asyncFunction = asyncFn ? asyncFn.constructor : undefined;
var asyncGen; // async function * () {};
var asyncGenFunction = asyncGen ? getProto(asyncGen) : undefined;
var asyncGenIterator = asyncGen ? asyncGen() : undefined;

var TypedArray = typeof Uint8Array === 'undefined' ? undefined : getProto(Uint8Array);

var INTRINSICS = {
	'$ %Array%': Array,
	'$ %ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined : ArrayBuffer,
	'$ %ArrayBufferPrototype%': typeof ArrayBuffer === 'undefined' ? undefined : ArrayBuffer.prototype,
	'$ %ArrayIteratorPrototype%': hasSymbols ? getProto([][Symbol.iterator]()) : undefined,
	'$ %ArrayPrototype%': Array.prototype,
	'$ %ArrayProto_entries%': Array.prototype.entries,
	'$ %ArrayProto_forEach%': Array.prototype.forEach,
	'$ %ArrayProto_keys%': Array.prototype.keys,
	'$ %ArrayProto_values%': Array.prototype.values,
	'$ %AsyncFromSyncIteratorPrototype%': undefined,
	'$ %AsyncFunction%': asyncFunction,
	'$ %AsyncFunctionPrototype%': asyncFunction ? asyncFunction.prototype : undefined,
	'$ %AsyncGenerator%': asyncGen ? getProto(asyncGenIterator) : undefined,
	'$ %AsyncGeneratorFunction%': asyncGenFunction,
	'$ %AsyncGeneratorPrototype%': asyncGenFunction ? asyncGenFunction.prototype : undefined,
	'$ %AsyncIteratorPrototype%': asyncGenIterator && hasSymbols && Symbol.asyncIterator ? asyncGenIterator[Symbol.asyncIterator]() : undefined,
	'$ %Atomics%': typeof Atomics === 'undefined' ? undefined : Atomics,
	'$ %Boolean%': Boolean,
	'$ %BooleanPrototype%': Boolean.prototype,
	'$ %DataView%': typeof DataView === 'undefined' ? undefined : DataView,
	'$ %DataViewPrototype%': typeof DataView === 'undefined' ? undefined : DataView.prototype,
	'$ %Date%': Date,
	'$ %DatePrototype%': Date.prototype,
	'$ %decodeURI%': decodeURI,
	'$ %decodeURIComponent%': decodeURIComponent,
	'$ %encodeURI%': encodeURI,
	'$ %encodeURIComponent%': encodeURIComponent,
	'$ %Error%': Error,
	'$ %ErrorPrototype%': Error.prototype,
	'$ %eval%': eval, // eslint-disable-line no-eval
	'$ %EvalError%': EvalError,
	'$ %EvalErrorPrototype%': EvalError.prototype,
	'$ %Float32Array%': typeof Float32Array === 'undefined' ? undefined : Float32Array,
	'$ %Float32ArrayPrototype%': typeof Float32Array === 'undefined' ? undefined : Float32Array.prototype,
	'$ %Float64Array%': typeof Float64Array === 'undefined' ? undefined : Float64Array,
	'$ %Float64ArrayPrototype%': typeof Float64Array === 'undefined' ? undefined : Float64Array.prototype,
	'$ %Function%': Function,
	'$ %FunctionPrototype%': Function.prototype,
	'$ %Generator%': generator ? getProto(generator()) : undefined,
	'$ %GeneratorFunction%': generatorFunction,
	'$ %GeneratorPrototype%': generatorFunction ? generatorFunction.prototype : undefined,
	'$ %Int8Array%': typeof Int8Array === 'undefined' ? undefined : Int8Array,
	'$ %Int8ArrayPrototype%': typeof Int8Array === 'undefined' ? undefined : Int8Array.prototype,
	'$ %Int16Array%': typeof Int16Array === 'undefined' ? undefined : Int16Array,
	'$ %Int16ArrayPrototype%': typeof Int16Array === 'undefined' ? undefined : Int8Array.prototype,
	'$ %Int32Array%': typeof Int32Array === 'undefined' ? undefined : Int32Array,
	'$ %Int32ArrayPrototype%': typeof Int32Array === 'undefined' ? undefined : Int32Array.prototype,
	'$ %isFinite%': isFinite,
	'$ %isNaN%': isNaN,
	'$ %IteratorPrototype%': hasSymbols ? getProto(getProto([][Symbol.iterator]())) : undefined,
	'$ %JSON%': JSON,
	'$ %JSONParse%': JSON.parse,
	'$ %Map%': typeof Map === 'undefined' ? undefined : Map,
	'$ %MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols ? undefined : getProto(new Map()[Symbol.iterator]()),
	'$ %MapPrototype%': typeof Map === 'undefined' ? undefined : Map.prototype,
	'$ %Math%': Math,
	'$ %Number%': Number,
	'$ %NumberPrototype%': Number.prototype,
	'$ %Object%': Object,
	'$ %ObjectPrototype%': Object.prototype,
	'$ %ObjProto_toString%': Object.prototype.toString,
	'$ %ObjProto_valueOf%': Object.prototype.valueOf,
	'$ %parseFloat%': parseFloat,
	'$ %parseInt%': parseInt,
	'$ %Promise%': typeof Promise === 'undefined' ? undefined : Promise,
	'$ %PromisePrototype%': typeof Promise === 'undefined' ? undefined : Promise.prototype,
	'$ %PromiseProto_then%': typeof Promise === 'undefined' ? undefined : Promise.prototype.then,
	'$ %Promise_all%': typeof Promise === 'undefined' ? undefined : Promise.all,
	'$ %Promise_reject%': typeof Promise === 'undefined' ? undefined : Promise.reject,
	'$ %Promise_resolve%': typeof Promise === 'undefined' ? undefined : Promise.resolve,
	'$ %Proxy%': typeof Proxy === 'undefined' ? undefined : Proxy,
	'$ %RangeError%': RangeError,
	'$ %RangeErrorPrototype%': RangeError.prototype,
	'$ %ReferenceError%': ReferenceError,
	'$ %ReferenceErrorPrototype%': ReferenceError.prototype,
	'$ %Reflect%': typeof Reflect === 'undefined' ? undefined : Reflect,
	'$ %RegExp%': RegExp,
	'$ %RegExpPrototype%': RegExp.prototype,
	'$ %Set%': typeof Set === 'undefined' ? undefined : Set,
	'$ %SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols ? undefined : getProto(new Set()[Symbol.iterator]()),
	'$ %SetPrototype%': typeof Set === 'undefined' ? undefined : Set.prototype,
	'$ %SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined : SharedArrayBuffer,
	'$ %SharedArrayBufferPrototype%': typeof SharedArrayBuffer === 'undefined' ? undefined : SharedArrayBuffer.prototype,
	'$ %String%': String,
	'$ %StringIteratorPrototype%': hasSymbols ? getProto(''[Symbol.iterator]()) : undefined,
	'$ %StringPrototype%': String.prototype,
	'$ %Symbol%': hasSymbols ? Symbol : undefined,
	'$ %SymbolPrototype%': hasSymbols ? Symbol.prototype : undefined,
	'$ %SyntaxError%': SyntaxError,
	'$ %SyntaxErrorPrototype%': SyntaxError.prototype,
	'$ %ThrowTypeError%': ThrowTypeError,
	'$ %TypedArray%': TypedArray,
	'$ %TypedArrayPrototype%': TypedArray ? TypedArray.prototype : undefined,
	'$ %TypeError%': TypeError,
	'$ %TypeErrorPrototype%': TypeError.prototype,
	'$ %Uint8Array%': typeof Uint8Array === 'undefined' ? undefined : Uint8Array,
	'$ %Uint8ArrayPrototype%': typeof Uint8Array === 'undefined' ? undefined : Uint8Array.prototype,
	'$ %Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined : Uint8ClampedArray,
	'$ %Uint8ClampedArrayPrototype%': typeof Uint8ClampedArray === 'undefined' ? undefined : Uint8ClampedArray.prototype,
	'$ %Uint16Array%': typeof Uint16Array === 'undefined' ? undefined : Uint16Array,
	'$ %Uint16ArrayPrototype%': typeof Uint16Array === 'undefined' ? undefined : Uint16Array.prototype,
	'$ %Uint32Array%': typeof Uint32Array === 'undefined' ? undefined : Uint32Array,
	'$ %Uint32ArrayPrototype%': typeof Uint32Array === 'undefined' ? undefined : Uint32Array.prototype,
	'$ %URIError%': URIError,
	'$ %URIErrorPrototype%': URIError.prototype,
	'$ %WeakMap%': typeof WeakMap === 'undefined' ? undefined : WeakMap,
	'$ %WeakMapPrototype%': typeof WeakMap === 'undefined' ? undefined : WeakMap.prototype,
	'$ %WeakSet%': typeof WeakSet === 'undefined' ? undefined : WeakSet,
	'$ %WeakSetPrototype%': typeof WeakSet === 'undefined' ? undefined : WeakSet.prototype
};

module.exports = function GetIntrinsic(name, allowMissing) {
	if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
		throw new TypeError('"allowMissing" argument must be a boolean');
	}

	var key = '$ ' + name;
	if (!(key in INTRINSICS)) {
		throw new SyntaxError('intrinsic ' + name + ' does not exist!');
	}

	// istanbul ignore if // hopefully this is impossible to test :-)
	if (typeof INTRINSICS[key] === 'undefined' && !allowMissing) {
		throw new TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
	}
	return INTRINSICS[key];
};

},{}],10:[function(require,module,exports){
'use strict';

var GetIntrinsic = require('./GetIntrinsic');

var $Object = GetIntrinsic('%Object%');
var $TypeError = GetIntrinsic('%TypeError%');
var $String = GetIntrinsic('%String%');

var assertRecord = require('./helpers/assertRecord');
var $isNaN = require('./helpers/isNaN');
var $isFinite = require('./helpers/isFinite');

var sign = require('./helpers/sign');
var mod = require('./helpers/mod');

var IsCallable = require('is-callable');
var toPrimitive = require('es-to-primitive/es5');

var has = require('has');

// https://es5.github.io/#x9
var ES5 = {
	ToPrimitive: toPrimitive,

	ToBoolean: function ToBoolean(value) {
		return !!value;
	},
	ToNumber: function ToNumber(value) {
		return +value; // eslint-disable-line no-implicit-coercion
	},
	ToInteger: function ToInteger(value) {
		var number = this.ToNumber(value);
		if ($isNaN(number)) { return 0; }
		if (number === 0 || !$isFinite(number)) { return number; }
		return sign(number) * Math.floor(Math.abs(number));
	},
	ToInt32: function ToInt32(x) {
		return this.ToNumber(x) >> 0;
	},
	ToUint32: function ToUint32(x) {
		return this.ToNumber(x) >>> 0;
	},
	ToUint16: function ToUint16(value) {
		var number = this.ToNumber(value);
		if ($isNaN(number) || number === 0 || !$isFinite(number)) { return 0; }
		var posInt = sign(number) * Math.floor(Math.abs(number));
		return mod(posInt, 0x10000);
	},
	ToString: function ToString(value) {
		return $String(value);
	},
	ToObject: function ToObject(value) {
		this.CheckObjectCoercible(value);
		return $Object(value);
	},
	CheckObjectCoercible: function CheckObjectCoercible(value, optMessage) {
		/* jshint eqnull:true */
		if (value == null) {
			throw new $TypeError(optMessage || 'Cannot call method on ' + value);
		}
		return value;
	},
	IsCallable: IsCallable,
	SameValue: function SameValue(x, y) {
		if (x === y) { // 0 === -0, but they are not identical.
			if (x === 0) { return 1 / x === 1 / y; }
			return true;
		}
		return $isNaN(x) && $isNaN(y);
	},

	// https://www.ecma-international.org/ecma-262/5.1/#sec-8
	Type: function Type(x) {
		if (x === null) {
			return 'Null';
		}
		if (typeof x === 'undefined') {
			return 'Undefined';
		}
		if (typeof x === 'function' || typeof x === 'object') {
			return 'Object';
		}
		if (typeof x === 'number') {
			return 'Number';
		}
		if (typeof x === 'boolean') {
			return 'Boolean';
		}
		if (typeof x === 'string') {
			return 'String';
		}
	},

	// https://ecma-international.org/ecma-262/6.0/#sec-property-descriptor-specification-type
	IsPropertyDescriptor: function IsPropertyDescriptor(Desc) {
		if (this.Type(Desc) !== 'Object') {
			return false;
		}
		var allowed = {
			'[[Configurable]]': true,
			'[[Enumerable]]': true,
			'[[Get]]': true,
			'[[Set]]': true,
			'[[Value]]': true,
			'[[Writable]]': true
		};

		for (var key in Desc) { // eslint-disable-line
			if (has(Desc, key) && !allowed[key]) {
				return false;
			}
		}

		var isData = has(Desc, '[[Value]]');
		var IsAccessor = has(Desc, '[[Get]]') || has(Desc, '[[Set]]');
		if (isData && IsAccessor) {
			throw new $TypeError('Property Descriptors may not be both accessor and data descriptors');
		}
		return true;
	},

	// https://ecma-international.org/ecma-262/5.1/#sec-8.10.1
	IsAccessorDescriptor: function IsAccessorDescriptor(Desc) {
		if (typeof Desc === 'undefined') {
			return false;
		}

		assertRecord(this, 'Property Descriptor', 'Desc', Desc);

		if (!has(Desc, '[[Get]]') && !has(Desc, '[[Set]]')) {
			return false;
		}

		return true;
	},

	// https://ecma-international.org/ecma-262/5.1/#sec-8.10.2
	IsDataDescriptor: function IsDataDescriptor(Desc) {
		if (typeof Desc === 'undefined') {
			return false;
		}

		assertRecord(this, 'Property Descriptor', 'Desc', Desc);

		if (!has(Desc, '[[Value]]') && !has(Desc, '[[Writable]]')) {
			return false;
		}

		return true;
	},

	// https://ecma-international.org/ecma-262/5.1/#sec-8.10.3
	IsGenericDescriptor: function IsGenericDescriptor(Desc) {
		if (typeof Desc === 'undefined') {
			return false;
		}

		assertRecord(this, 'Property Descriptor', 'Desc', Desc);

		if (!this.IsAccessorDescriptor(Desc) && !this.IsDataDescriptor(Desc)) {
			return true;
		}

		return false;
	},

	// https://ecma-international.org/ecma-262/5.1/#sec-8.10.4
	FromPropertyDescriptor: function FromPropertyDescriptor(Desc) {
		if (typeof Desc === 'undefined') {
			return Desc;
		}

		assertRecord(this, 'Property Descriptor', 'Desc', Desc);

		if (this.IsDataDescriptor(Desc)) {
			return {
				value: Desc['[[Value]]'],
				writable: !!Desc['[[Writable]]'],
				enumerable: !!Desc['[[Enumerable]]'],
				configurable: !!Desc['[[Configurable]]']
			};
		} else if (this.IsAccessorDescriptor(Desc)) {
			return {
				get: Desc['[[Get]]'],
				set: Desc['[[Set]]'],
				enumerable: !!Desc['[[Enumerable]]'],
				configurable: !!Desc['[[Configurable]]']
			};
		} else {
			throw new $TypeError('FromPropertyDescriptor must be called with a fully populated Property Descriptor');
		}
	},

	// https://ecma-international.org/ecma-262/5.1/#sec-8.10.5
	ToPropertyDescriptor: function ToPropertyDescriptor(Obj) {
		if (this.Type(Obj) !== 'Object') {
			throw new $TypeError('ToPropertyDescriptor requires an object');
		}

		var desc = {};
		if (has(Obj, 'enumerable')) {
			desc['[[Enumerable]]'] = this.ToBoolean(Obj.enumerable);
		}
		if (has(Obj, 'configurable')) {
			desc['[[Configurable]]'] = this.ToBoolean(Obj.configurable);
		}
		if (has(Obj, 'value')) {
			desc['[[Value]]'] = Obj.value;
		}
		if (has(Obj, 'writable')) {
			desc['[[Writable]]'] = this.ToBoolean(Obj.writable);
		}
		if (has(Obj, 'get')) {
			var getter = Obj.get;
			if (typeof getter !== 'undefined' && !this.IsCallable(getter)) {
				throw new TypeError('getter must be a function');
			}
			desc['[[Get]]'] = getter;
		}
		if (has(Obj, 'set')) {
			var setter = Obj.set;
			if (typeof setter !== 'undefined' && !this.IsCallable(setter)) {
				throw new $TypeError('setter must be a function');
			}
			desc['[[Set]]'] = setter;
		}

		if ((has(desc, '[[Get]]') || has(desc, '[[Set]]')) && (has(desc, '[[Value]]') || has(desc, '[[Writable]]'))) {
			throw new $TypeError('Invalid property descriptor. Cannot both specify accessors and a value or writable attribute');
		}
		return desc;
	}
};

module.exports = ES5;

},{"./GetIntrinsic":9,"./helpers/assertRecord":11,"./helpers/isFinite":12,"./helpers/isNaN":13,"./helpers/mod":14,"./helpers/sign":15,"es-to-primitive/es5":16,"has":21,"is-callable":25}],11:[function(require,module,exports){
'use strict';

var GetIntrinsic = require('../GetIntrinsic');

var $TypeError = GetIntrinsic('%TypeError%');
var $SyntaxError = GetIntrinsic('%SyntaxError%');

var has = require('has');

var predicates = {
  // https://ecma-international.org/ecma-262/6.0/#sec-property-descriptor-specification-type
  'Property Descriptor': function isPropertyDescriptor(ES, Desc) {
    if (ES.Type(Desc) !== 'Object') {
      return false;
    }
    var allowed = {
      '[[Configurable]]': true,
      '[[Enumerable]]': true,
      '[[Get]]': true,
      '[[Set]]': true,
      '[[Value]]': true,
      '[[Writable]]': true
    };

    for (var key in Desc) { // eslint-disable-line
      if (has(Desc, key) && !allowed[key]) {
        return false;
      }
    }

    var isData = has(Desc, '[[Value]]');
    var IsAccessor = has(Desc, '[[Get]]') || has(Desc, '[[Set]]');
    if (isData && IsAccessor) {
      throw new $TypeError('Property Descriptors may not be both accessor and data descriptors');
    }
    return true;
  }
};

module.exports = function assertRecord(ES, recordType, argumentName, value) {
  var predicate = predicates[recordType];
  if (typeof predicate !== 'function') {
    throw new $SyntaxError('unknown record type: ' + recordType);
  }
  if (!predicate(ES, value)) {
    throw new $TypeError(argumentName + ' must be a ' + recordType);
  }
  console.log(predicate(ES, value), value);
};

},{"../GetIntrinsic":9,"has":21}],12:[function(require,module,exports){
var $isNaN = Number.isNaN || function (a) { return a !== a; };

module.exports = Number.isFinite || function (x) { return typeof x === 'number' && !$isNaN(x) && x !== Infinity && x !== -Infinity; };

},{}],13:[function(require,module,exports){
module.exports = Number.isNaN || function isNaN(a) {
	return a !== a;
};

},{}],14:[function(require,module,exports){
module.exports = function mod(number, modulo) {
	var remain = number % modulo;
	return Math.floor(remain >= 0 ? remain : remain + modulo);
};

},{}],15:[function(require,module,exports){
module.exports = function sign(number) {
	return number >= 0 ? 1 : -1;
};

},{}],16:[function(require,module,exports){
'use strict';

var toStr = Object.prototype.toString;

var isPrimitive = require('./helpers/isPrimitive');

var isCallable = require('is-callable');

// http://ecma-international.org/ecma-262/5.1/#sec-8.12.8
var ES5internalSlots = {
	'[[DefaultValue]]': function (O) {
		var actualHint;
		if (arguments.length > 1) {
			actualHint = arguments[1];
		} else {
			actualHint = toStr.call(O) === '[object Date]' ? String : Number;
		}

		if (actualHint === String || actualHint === Number) {
			var methods = actualHint === String ? ['toString', 'valueOf'] : ['valueOf', 'toString'];
			var value, i;
			for (i = 0; i < methods.length; ++i) {
				if (isCallable(O[methods[i]])) {
					value = O[methods[i]]();
					if (isPrimitive(value)) {
						return value;
					}
				}
			}
			throw new TypeError('No default value');
		}
		throw new TypeError('invalid [[DefaultValue]] hint supplied');
	}
};

// http://ecma-international.org/ecma-262/5.1/#sec-9.1
module.exports = function ToPrimitive(input) {
	if (isPrimitive(input)) {
		return input;
	}
	if (arguments.length > 1) {
		return ES5internalSlots['[[DefaultValue]]'](input, arguments[1]);
	}
	return ES5internalSlots['[[DefaultValue]]'](input);
};

},{"./helpers/isPrimitive":17,"is-callable":25}],17:[function(require,module,exports){
module.exports = function isPrimitive(value) {
	return value === null || (typeof value !== 'function' && typeof value !== 'object');
};

},{}],18:[function(require,module,exports){
'use strict';

var isCallable = require('is-callable');

var toStr = Object.prototype.toString;
var hasOwnProperty = Object.prototype.hasOwnProperty;

var forEachArray = function forEachArray(array, iterator, receiver) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            if (receiver == null) {
                iterator(array[i], i, array);
            } else {
                iterator.call(receiver, array[i], i, array);
            }
        }
    }
};

var forEachString = function forEachString(string, iterator, receiver) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        if (receiver == null) {
            iterator(string.charAt(i), i, string);
        } else {
            iterator.call(receiver, string.charAt(i), i, string);
        }
    }
};

var forEachObject = function forEachObject(object, iterator, receiver) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            if (receiver == null) {
                iterator(object[k], k, object);
            } else {
                iterator.call(receiver, object[k], k, object);
            }
        }
    }
};

var forEach = function forEach(list, iterator, thisArg) {
    if (!isCallable(iterator)) {
        throw new TypeError('iterator must be a function');
    }

    var receiver;
    if (arguments.length >= 3) {
        receiver = thisArg;
    }

    if (toStr.call(list) === '[object Array]') {
        forEachArray(list, iterator, receiver);
    } else if (typeof list === 'string') {
        forEachString(list, iterator, receiver);
    } else {
        forEachObject(list, iterator, receiver);
    }
};

module.exports = forEach;

},{"is-callable":25}],19:[function(require,module,exports){
'use strict';

/* eslint no-invalid-this: 1 */

var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var slice = Array.prototype.slice;
var toStr = Object.prototype.toString;
var funcType = '[object Function]';

module.exports = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr.call(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slice.call(arguments, 1);

    var bound;
    var binder = function () {
        if (this instanceof bound) {
            var result = target.apply(
                this,
                args.concat(slice.call(arguments))
            );
            if (Object(result) === result) {
                return result;
            }
            return this;
        } else {
            return target.apply(
                that,
                args.concat(slice.call(arguments))
            );
        }
    };

    var boundLength = Math.max(0, target.length - args.length);
    var boundArgs = [];
    for (var i = 0; i < boundLength; i++) {
        boundArgs.push('$' + i);
    }

    bound = Function('binder', 'return function (' + boundArgs.join(',') + '){ return binder.apply(this,arguments); }')(binder);

    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }

    return bound;
};

},{}],20:[function(require,module,exports){
'use strict';

var implementation = require('./implementation');

module.exports = Function.prototype.bind || implementation;

},{"./implementation":19}],21:[function(require,module,exports){
'use strict';

var bind = require('function-bind');

module.exports = bind.call(Function.call, Object.prototype.hasOwnProperty);

},{"function-bind":20}],22:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],23:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],24:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],25:[function(require,module,exports){
'use strict';

var fnToStr = Function.prototype.toString;

var constructorRegex = /^\s*class\b/;
var isES6ClassFn = function isES6ClassFunction(value) {
	try {
		var fnStr = fnToStr.call(value);
		return constructorRegex.test(fnStr);
	} catch (e) {
		return false; // not a function
	}
};

var tryFunctionObject = function tryFunctionToStr(value) {
	try {
		if (isES6ClassFn(value)) { return false; }
		fnToStr.call(value);
		return true;
	} catch (e) {
		return false;
	}
};
var toStr = Object.prototype.toString;
var fnClass = '[object Function]';
var genClass = '[object GeneratorFunction]';
var hasToStringTag = typeof Symbol === 'function' && typeof Symbol.toStringTag === 'symbol';

module.exports = function isCallable(value) {
	if (!value) { return false; }
	if (typeof value !== 'function' && typeof value !== 'object') { return false; }
	if (typeof value === 'function' && !value.prototype) { return true; }
	if (hasToStringTag) { return tryFunctionObject(value); }
	if (isES6ClassFn(value)) { return false; }
	var strClass = toStr.call(value);
	return strClass === fnClass || strClass === genClass;
};

},{}],26:[function(require,module,exports){
var hasMap = typeof Map === 'function' && Map.prototype;
var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, 'size') : null;
var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === 'function' ? mapSizeDescriptor.get : null;
var mapForEach = hasMap && Map.prototype.forEach;
var hasSet = typeof Set === 'function' && Set.prototype;
var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, 'size') : null;
var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === 'function' ? setSizeDescriptor.get : null;
var setForEach = hasSet && Set.prototype.forEach;
var booleanValueOf = Boolean.prototype.valueOf;
var objectToString = Object.prototype.toString;
var bigIntValueOf = typeof BigInt === 'function' ? BigInt.prototype.valueOf : null;

var inspectCustom = require('./util.inspect').custom;
var inspectSymbol = (inspectCustom && isSymbol(inspectCustom)) ? inspectCustom : null;

module.exports = function inspect_ (obj, opts, depth, seen) {
    if (!opts) opts = {};

    if (has(opts, 'quoteStyle') && (opts.quoteStyle !== 'single' && opts.quoteStyle !== 'double')) {
        throw new TypeError('option "quoteStyle" must be "single" or "double"');
    }

    if (typeof obj === 'undefined') {
        return 'undefined';
    }
    if (obj === null) {
        return 'null';
    }
    if (typeof obj === 'boolean') {
        return obj ? 'true' : 'false';
    }

    if (typeof obj === 'string') {
        return inspectString(obj, opts);
    }
    if (typeof obj === 'number') {
      if (obj === 0) {
        return Infinity / obj > 0 ? '0' : '-0';
      }
      return String(obj);
    }
    if (typeof obj === 'bigint') {
      return String(obj) + 'n';
    }

    var maxDepth = typeof opts.depth === 'undefined' ? 5 : opts.depth;
    if (typeof depth === 'undefined') depth = 0;
    if (depth >= maxDepth && maxDepth > 0 && typeof obj === 'object') {
        return '[Object]';
    }

    if (typeof seen === 'undefined') seen = [];
    else if (indexOf(seen, obj) >= 0) {
        return '[Circular]';
    }

    function inspect (value, from) {
        if (from) {
            seen = seen.slice();
            seen.push(from);
        }
        return inspect_(value, opts, depth + 1, seen);
    }

    if (typeof obj === 'function') {
        var name = nameOf(obj);
        return '[Function' + (name ? ': ' + name : '') + ']';
    }
    if (isSymbol(obj)) {
        var symString = Symbol.prototype.toString.call(obj);
        return typeof obj === 'object' ? markBoxed(symString) : symString;
    }
    if (isElement(obj)) {
        var s = '<' + String(obj.nodeName).toLowerCase();
        var attrs = obj.attributes || [];
        for (var i = 0; i < attrs.length; i++) {
            s += ' ' + attrs[i].name + '=' + wrapQuotes(quote(attrs[i].value), 'double', opts);
        }
        s += '>';
        if (obj.childNodes && obj.childNodes.length) s += '...';
        s += '</' + String(obj.nodeName).toLowerCase() + '>';
        return s;
    }
    if (isArray(obj)) {
        if (obj.length === 0) return '[]';
        return '[ ' + arrObjKeys(obj, inspect).join(', ') + ' ]';
    }
    if (isError(obj)) {
        var parts = arrObjKeys(obj, inspect);
        if (parts.length === 0) return '[' + String(obj) + ']';
        return '{ [' + String(obj) + '] ' + parts.join(', ') + ' }';
    }
    if (typeof obj === 'object') {
        if (inspectSymbol && typeof obj[inspectSymbol] === 'function') {
            return obj[inspectSymbol]();
        } else if (typeof obj.inspect === 'function') {
            return obj.inspect();
        }
    }
    if (isMap(obj)) {
        var parts = [];
        mapForEach.call(obj, function (value, key) {
            parts.push(inspect(key, obj) + ' => ' + inspect(value, obj));
        });
        return collectionOf('Map', mapSize.call(obj), parts);
    }
    if (isSet(obj)) {
        var parts = [];
        setForEach.call(obj, function (value ) {
            parts.push(inspect(value, obj));
        });
        return collectionOf('Set', setSize.call(obj), parts);
    }
    if (isNumber(obj)) {
        return markBoxed(inspect(Number(obj)));
    }
    if (isBigInt(obj)) {
        return markBoxed(inspect(bigIntValueOf.call(obj)));
    }
    if (isBoolean(obj)) {
        return markBoxed(booleanValueOf.call(obj));
    }
    if (isString(obj)) {
        return markBoxed(inspect(String(obj)));
    }
    if (!isDate(obj) && !isRegExp(obj)) {
        var xs = arrObjKeys(obj, inspect);
        if (xs.length === 0) return '{}';
        return '{ ' + xs.join(', ') + ' }';
    }
    return String(obj);
};

function wrapQuotes (s, defaultStyle, opts) {
    var quoteChar = (opts.quoteStyle || defaultStyle) === 'double' ? '"' : "'";
    return quoteChar + s + quoteChar;
}

function quote (s) {
    return String(s).replace(/"/g, '&quot;');
}

function isArray (obj) { return toStr(obj) === '[object Array]'; }
function isDate (obj) { return toStr(obj) === '[object Date]'; }
function isRegExp (obj) { return toStr(obj) === '[object RegExp]'; }
function isError (obj) { return toStr(obj) === '[object Error]'; }
function isSymbol (obj) { return toStr(obj) === '[object Symbol]'; }
function isString (obj) { return toStr(obj) === '[object String]'; }
function isNumber (obj) { return toStr(obj) === '[object Number]'; }
function isBigInt (obj) { return toStr(obj) === '[object BigInt]'; }
function isBoolean (obj) { return toStr(obj) === '[object Boolean]'; }

var hasOwn = Object.prototype.hasOwnProperty || function (key) { return key in this; };
function has (obj, key) {
    return hasOwn.call(obj, key);
}

function toStr (obj) {
    return objectToString.call(obj);
}

function nameOf (f) {
    if (f.name) return f.name;
    var m = String(f).match(/^function\s*([\w$]+)/);
    if (m) return m[1];
}

function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) return i;
    }
    return -1;
}

function isMap (x) {
    if (!mapSize) {
        return false;
    }
    try {
        mapSize.call(x);
        try {
            setSize.call(x);
        } catch (s) {
            return true;
        }
        return x instanceof Map; // core-js workaround, pre-v2.5.0
    } catch (e) {}
    return false;
}

function isSet (x) {
    if (!setSize) {
        return false;
    }
    try {
        setSize.call(x);
        try {
            mapSize.call(x);
        } catch (m) {
            return true;
        }
        return x instanceof Set; // core-js workaround, pre-v2.5.0
    } catch (e) {}
    return false;
}

function isElement (x) {
    if (!x || typeof x !== 'object') return false;
    if (typeof HTMLElement !== 'undefined' && x instanceof HTMLElement) {
        return true;
    }
    return typeof x.nodeName === 'string'
        && typeof x.getAttribute === 'function'
    ;
}

function inspectString (str, opts) {
    var s = str.replace(/(['\\])/g, '\\$1').replace(/[\x00-\x1f]/g, lowbyte);
    return wrapQuotes(s, 'single', opts);
}

function lowbyte (c) {
    var n = c.charCodeAt(0);
    var x = { 8: 'b', 9: 't', 10: 'n', 12: 'f', 13: 'r' }[n];
    if (x) return '\\' + x;
    return '\\x' + (n < 0x10 ? '0' : '') + n.toString(16);
}

function markBoxed (str) {
    return 'Object(' + str + ')';
}

function collectionOf (type, size, entries) {
    return type + ' (' + size + ') {' + entries.join(', ') + '}';
}

function arrObjKeys (obj, inspect) {
    var isArr = isArray(obj);
    var xs = [];
    if (isArr) {
        xs.length = obj.length;
        for (var i = 0; i < obj.length; i++) {
            xs[i] = has(obj, i) ? inspect(obj[i], obj) : '';
        }
    }
    for (var key in obj) {
        if (!has(obj, key)) continue;
        if (isArr && String(Number(key)) === key && key < obj.length) continue;
        if (/[^\w$]/.test(key)) {
            xs.push(inspect(key, obj) + ': ' + inspect(obj[key], obj));
        } else {
            xs.push(key + ': ' + inspect(obj[key], obj));
        }
    }
    return xs;
}

},{"./util.inspect":2}],27:[function(require,module,exports){
'use strict';

var keysShim;
if (!Object.keys) {
	// modified from https://github.com/es-shims/es5-shim
	var has = Object.prototype.hasOwnProperty;
	var toStr = Object.prototype.toString;
	var isArgs = require('./isArguments'); // eslint-disable-line global-require
	var isEnumerable = Object.prototype.propertyIsEnumerable;
	var hasDontEnumBug = !isEnumerable.call({ toString: null }, 'toString');
	var hasProtoEnumBug = isEnumerable.call(function () {}, 'prototype');
	var dontEnums = [
		'toString',
		'toLocaleString',
		'valueOf',
		'hasOwnProperty',
		'isPrototypeOf',
		'propertyIsEnumerable',
		'constructor'
	];
	var equalsConstructorPrototype = function (o) {
		var ctor = o.constructor;
		return ctor && ctor.prototype === o;
	};
	var excludedKeys = {
		$applicationCache: true,
		$console: true,
		$external: true,
		$frame: true,
		$frameElement: true,
		$frames: true,
		$innerHeight: true,
		$innerWidth: true,
		$outerHeight: true,
		$outerWidth: true,
		$pageXOffset: true,
		$pageYOffset: true,
		$parent: true,
		$scrollLeft: true,
		$scrollTop: true,
		$scrollX: true,
		$scrollY: true,
		$self: true,
		$webkitIndexedDB: true,
		$webkitStorageInfo: true,
		$window: true
	};
	var hasAutomationEqualityBug = (function () {
		/* global window */
		if (typeof window === 'undefined') { return false; }
		for (var k in window) {
			try {
				if (!excludedKeys['$' + k] && has.call(window, k) && window[k] !== null && typeof window[k] === 'object') {
					try {
						equalsConstructorPrototype(window[k]);
					} catch (e) {
						return true;
					}
				}
			} catch (e) {
				return true;
			}
		}
		return false;
	}());
	var equalsConstructorPrototypeIfNotBuggy = function (o) {
		/* global window */
		if (typeof window === 'undefined' || !hasAutomationEqualityBug) {
			return equalsConstructorPrototype(o);
		}
		try {
			return equalsConstructorPrototype(o);
		} catch (e) {
			return false;
		}
	};

	keysShim = function keys(object) {
		var isObject = object !== null && typeof object === 'object';
		var isFunction = toStr.call(object) === '[object Function]';
		var isArguments = isArgs(object);
		var isString = isObject && toStr.call(object) === '[object String]';
		var theKeys = [];

		if (!isObject && !isFunction && !isArguments) {
			throw new TypeError('Object.keys called on a non-object');
		}

		var skipProto = hasProtoEnumBug && isFunction;
		if (isString && object.length > 0 && !has.call(object, 0)) {
			for (var i = 0; i < object.length; ++i) {
				theKeys.push(String(i));
			}
		}

		if (isArguments && object.length > 0) {
			for (var j = 0; j < object.length; ++j) {
				theKeys.push(String(j));
			}
		} else {
			for (var name in object) {
				if (!(skipProto && name === 'prototype') && has.call(object, name)) {
					theKeys.push(String(name));
				}
			}
		}

		if (hasDontEnumBug) {
			var skipConstructor = equalsConstructorPrototypeIfNotBuggy(object);

			for (var k = 0; k < dontEnums.length; ++k) {
				if (!(skipConstructor && dontEnums[k] === 'constructor') && has.call(object, dontEnums[k])) {
					theKeys.push(dontEnums[k]);
				}
			}
		}
		return theKeys;
	};
}
module.exports = keysShim;

},{"./isArguments":29}],28:[function(require,module,exports){
'use strict';

var slice = Array.prototype.slice;
var isArgs = require('./isArguments');

var origKeys = Object.keys;
var keysShim = origKeys ? function keys(o) { return origKeys(o); } : require('./implementation');

var originalKeys = Object.keys;

keysShim.shim = function shimObjectKeys() {
	if (Object.keys) {
		var keysWorksWithArguments = (function () {
			// Safari 5.0 bug
			var args = Object.keys(arguments);
			return args && args.length === arguments.length;
		}(1, 2));
		if (!keysWorksWithArguments) {
			Object.keys = function keys(object) { // eslint-disable-line func-name-matching
				if (isArgs(object)) {
					return originalKeys(slice.call(object));
				}
				return originalKeys(object);
			};
		}
	} else {
		Object.keys = keysShim;
	}
	return Object.keys || keysShim;
};

module.exports = keysShim;

},{"./implementation":27,"./isArguments":29}],29:[function(require,module,exports){
'use strict';

var toStr = Object.prototype.toString;

module.exports = function isArguments(value) {
	var str = toStr.call(value);
	var isArgs = str === '[object Arguments]';
	if (!isArgs) {
		isArgs = str !== '[object Array]' &&
			value !== null &&
			typeof value === 'object' &&
			typeof value.length === 'number' &&
			value.length >= 0 &&
			toStr.call(value.callee) === '[object Function]';
	}
	return isArgs;
};

},{}],30:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))

},{"_process":33}],31:[function(require,module,exports){
function findChildsExposedBox(child){
    var childWindow = (child.ownerDocument || child).defaultView,
        childDocument = child.ownerDocument || child,
        originalBounds = child.getBoundingClientRect(),
        parent = child.parentNode,
        parentOverflow,
        parentBounds,
        bounds;

    // Convert bounds object to pojo.
    bounds = {
        original: originalBounds,
        height: originalBounds.height,
        width: originalBounds.width,
        left: originalBounds.left,
        top: originalBounds.top,
        right: originalBounds.right,
        bottom: originalBounds.bottom
    };

    while(parent){
        if(parent === childDocument){
            parentBounds = {
                top: 0,
                left: 0,
                bottom: childWindow.innerHeight,
                right: childWindow.innerWidth,
                height: childWindow.innerHeight,
                width: childWindow.innerWidth
            };
        }else{
            var parentOverflow = childWindow.getComputedStyle(parent).overflow;
            if(parentOverflow === '' || parentOverflow === 'visible'){
                parent = parent.parentNode;
                continue;
            }
            parentBounds = parent.getBoundingClientRect();
        }

        if(parentBounds.top > bounds.top){
            bounds.height = bounds.height - (parentBounds.top - bounds.top);
            bounds.top = parentBounds.top;
        }
        if(parentBounds.left > bounds.left){
            bounds.width = bounds.width - (parentBounds.left - bounds.left);
            bounds.left = parentBounds.left;
        }
        if(parentBounds.right < bounds.right){
            bounds.width = bounds.width - (bounds.right - parentBounds.right);
            bounds.right = parentBounds.right;
        }
        if(parentBounds.bottom < bounds.bottom){
            bounds.height = bounds.height - (bounds.bottom - parentBounds.bottom);
            bounds.bottom = parentBounds.bottom;
        }

        if(bounds.width <= 0 || bounds.height <= 0){
            bounds.hidden = true;
            bounds.width = Math.max(bounds.width, 0);
            bounds.height = Math.max(bounds.height, 0);
            return bounds;
        }

        parent = parent.parentNode;
    }

    return bounds;
}

module.exports = findChildsExposedBox;
},{}],32:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = { nextTick: nextTick };
} else {
  module.exports = process
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}


}).call(this,require('_process'))

},{"_process":33}],33:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],34:[function(require,module,exports){
module.exports = require('./lib/_stream_duplex.js');

},{"./lib/_stream_duplex.js":35}],35:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

{
  // avoid scope creep, the keys array can then be collected
  var keys = objectKeys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  pna.nextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

Object.defineProperty(Duplex.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

Duplex.prototype._destroy = function (err, cb) {
  this.push(null);
  this.end();

  pna.nextTick(cb, err);
};
},{"./_stream_readable":37,"./_stream_writable":39,"core-util-is":3,"inherits":23,"process-nextick-args":32}],36:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":38,"core-util-is":3,"inherits":23}],37:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var destroyImpl = require('./internal/streams/destroy');
var StringDecoder;

util.inherits(Readable, Stream);

var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn);

  // This is a hack to make sure that our error handler is attached before any
  // userland ones.  NEVER DO THIS. This is here only because this code needs
  // to continue to work with older versions of Node.js that do not include
  // the prependListener() method. The goal is to eventually remove this hack.
  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
}

function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var readableHwm = options.readableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options) {
    if (typeof options.read === 'function') this._read = options.read;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }

  Stream.call(this);
}

Object.defineProperty(Readable.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
  }
});

Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function (err, cb) {
  this.push(null);
  cb(err);
};

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;

  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }

  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};

function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = _uint8ArrayToBuffer(chunk);
      }

      if (addToFront) {
        if (state.endEmitted) stream.emit('error', new Error('stream.unshift() after end event'));else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        stream.emit('error', new Error('stream.push() after EOF'));
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
    }
  }

  return needMoreData(state);
}

function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    stream.emit('data', chunk);
    stream.read(0);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}

function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) pna.nextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    pna.nextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('_read() is not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) pna.nextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = { hasUnpiped: false };

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this, unpipeInfo);
    }return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;

  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this, unpipeInfo);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        pna.nextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    pna.nextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var _this = this;

  var state = this._readableState;
  var paused = false;

  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) _this.push(chunk);
    }

    _this.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = _this.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
  }

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  this._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return this;
};

Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._readableState.highWaterMark;
  }
});

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = Buffer.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    pna.nextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./_stream_duplex":35,"./internal/streams/BufferList":40,"./internal/streams/destroy":41,"./internal/streams/stream":42,"_process":33,"core-util-is":3,"events":67,"inherits":23,"isarray":43,"process-nextick-args":32,"safe-buffer":50,"string_decoder/":44,"util":2}],38:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function afterTransform(er, data) {
  var ts = this._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) {
    return this.emit('error', new Error('write callback called multiple times'));
  }

  ts.writechunk = null;
  ts.writecb = null;

  if (data != null) // single equals check for both `null` and `undefined`
    this.push(data);

  cb(er);

  var rs = this._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    this._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = {
    afterTransform: afterTransform.bind(this),
    needTransform: false,
    transforming: false,
    writecb: null,
    writechunk: null,
    writeencoding: null
  };

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.on('prefinish', prefinish);
}

function prefinish() {
  var _this = this;

  if (typeof this._flush === 'function') {
    this._flush(function (er, data) {
      done(_this, er, data);
    });
  } else {
    done(this, null, null);
  }
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('_transform() is not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

Transform.prototype._destroy = function (err, cb) {
  var _this2 = this;

  Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
    _this2.emit('close');
  });
};

function done(stream, er, data) {
  if (er) return stream.emit('error', er);

  if (data != null) // single equals check for both `null` and `undefined`
    stream.push(data);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  if (stream._writableState.length) throw new Error('Calling transform done when ws.length != 0');

  if (stream._transformState.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":35,"core-util-is":3,"inherits":23}],39:[function(require,module,exports){
(function (process,global,setImmediate){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Writable;

/* <replacement> */
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

var destroyImpl = require('./internal/streams/destroy');

util.inherits(Writable, Stream);

function nop() {}

function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var writableHwm = options.writableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function (object) {
      if (realHasInstance.call(this, object)) return true;
      if (this !== Writable) return false;

      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function (object) {
    return object instanceof this;
  };
}

function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
    return new Writable(options);
  }

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;

    if (typeof options.final === 'function') this._final = options.final;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  pna.nextTick(cb, er);
}

// Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;

  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    pna.nextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = !state.objectMode && _isUint8Array(chunk);

  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}

Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;

  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    pna.nextTick(cb, er);
    // this can emit finish, and it will always happen
    // after error
    pna.nextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
    // this can emit finish, but finish must
    // always follow error
    finishMaybe(stream, state);
  }
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
    state.bufferedRequestCount = 0;
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      state.bufferedRequestCount--;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('_write() is not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      stream.emit('error', err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function') {
      state.pendingcb++;
      state.finalCalled = true;
      pna.nextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) pna.nextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  }
  if (state.corkedRequestsFree) {
    state.corkedRequestsFree.next = corkReq;
  } else {
    state.corkedRequestsFree = corkReq;
  }
}

Object.defineProperty(Writable.prototype, 'destroyed', {
  get: function () {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._writableState.destroyed = value;
  }
});

Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  this.end();
  cb(err);
};
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("timers").setImmediate)

},{"./_stream_duplex":35,"./internal/streams/destroy":41,"./internal/streams/stream":42,"_process":33,"core-util-is":3,"inherits":23,"process-nextick-args":32,"safe-buffer":50,"timers":62,"util-deprecate":63}],40:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = require('safe-buffer').Buffer;
var util = require('util');

function copyBuffer(src, target, offset) {
  src.copy(target, offset);
}

module.exports = function () {
  function BufferList() {
    _classCallCheck(this, BufferList);

    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function push(v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function unshift(v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function shift() {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function clear() {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function join(s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function concat(n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      copyBuffer(p.data, ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  return BufferList;
}();

if (util && util.inspect && util.inspect.custom) {
  module.exports.prototype[util.inspect.custom] = function () {
    var obj = util.inspect({ length: this.length });
    return this.constructor.name + ' ' + obj;
  };
}
},{"safe-buffer":50,"util":2}],41:[function(require,module,exports){
'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

// undocumented cb() API, needed for core, not for public API
function destroy(err, cb) {
  var _this = this;

  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;

  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err && (!this._writableState || !this._writableState.errorEmitted)) {
      pna.nextTick(emitErrorNT, this, err);
    }
    return this;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }

  this._destroy(err || null, function (err) {
    if (!cb && err) {
      pna.nextTick(emitErrorNT, _this, err);
      if (_this._writableState) {
        _this._writableState.errorEmitted = true;
      }
    } else if (cb) {
      cb(err);
    }
  });

  return this;
}

function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }

  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}

function emitErrorNT(self, err) {
  self.emit('error', err);
}

module.exports = {
  destroy: destroy,
  undestroy: undestroy
};
},{"process-nextick-args":32}],42:[function(require,module,exports){
module.exports = require('events').EventEmitter;

},{"events":67}],43:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],44:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
/*</replacement>*/

var isEncoding = Buffer.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
};

// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
exports.StringDecoder = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte. If an invalid byte is detected, -2 is returned.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return byte >> 6 === 0x02 ? -1 : -2;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd';
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd';
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd';
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf, p);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character is added when ending on a partial
// character.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd';
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}
},{"safe-buffer":50}],45:[function(require,module,exports){
module.exports = require('./readable').PassThrough

},{"./readable":46}],46:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":35,"./lib/_stream_passthrough.js":36,"./lib/_stream_readable.js":37,"./lib/_stream_transform.js":38,"./lib/_stream_writable.js":39}],47:[function(require,module,exports){
module.exports = require('./readable').Transform

},{"./readable":46}],48:[function(require,module,exports){
module.exports = require('./lib/_stream_writable.js');

},{"./lib/_stream_writable.js":39}],49:[function(require,module,exports){
(function (process,setImmediate){
var through = require('through');
var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

module.exports = function (write, end) {
    var tr = through(write, end);
    tr.pause();
    var resume = tr.resume;
    var pause = tr.pause;
    var paused = false;
    
    tr.pause = function () {
        paused = true;
        return pause.apply(this, arguments);
    };
    
    tr.resume = function () {
        paused = false;
        return resume.apply(this, arguments);
    };
    
    nextTick(function () {
        if (!paused) tr.resume();
    });
    
    return tr;
};

}).call(this,require('_process'),require("timers").setImmediate)

},{"_process":33,"through":61,"timers":62}],50:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":66}],51:[function(require,module,exports){
var COMPLETE = 'complete',
    CANCELED = 'canceled';

function raf(task){
    if('requestAnimationFrame' in window){
        return window.requestAnimationFrame(task);
    }

    setTimeout(task, 16);
}

function setElementScroll(element, x, y){
    if(element.self === element){
        element.scrollTo(x, y);
    }else{
        element.scrollLeft = x;
        element.scrollTop = y;
    }
}

function getTargetScrollLocation(target, parent, align){
    var targetPosition = target.getBoundingClientRect(),
        parentPosition,
        x,
        y,
        differenceX,
        differenceY,
        targetWidth,
        targetHeight,
        leftAlign = align && align.left != null ? align.left : 0.5,
        topAlign = align && align.top != null ? align.top : 0.5,
        leftOffset = align && align.leftOffset != null ? align.leftOffset : 0,
        topOffset = align && align.topOffset != null ? align.topOffset : 0,
        leftScalar = leftAlign,
        topScalar = topAlign;

    if(parent.self === parent){
        targetWidth = Math.min(targetPosition.width, parent.innerWidth);
        targetHeight = Math.min(targetPosition.height, parent.innerHeight);
        x = targetPosition.left + parent.pageXOffset - parent.innerWidth * leftScalar + targetWidth * leftScalar;
        y = targetPosition.top + parent.pageYOffset - parent.innerHeight * topScalar + targetHeight * topScalar;
        x -= leftOffset;
        y -= topOffset;
        differenceX = x - parent.pageXOffset;
        differenceY = y - parent.pageYOffset;
    }else{
        targetWidth = targetPosition.width;
        targetHeight = targetPosition.height;
        parentPosition = parent.getBoundingClientRect();
        var offsetLeft = targetPosition.left - (parentPosition.left - parent.scrollLeft);
        var offsetTop = targetPosition.top - (parentPosition.top - parent.scrollTop);
        x = offsetLeft + (targetWidth * leftScalar) - parent.clientWidth * leftScalar;
        y = offsetTop + (targetHeight * topScalar) - parent.clientHeight * topScalar;
        x = Math.max(Math.min(x, parent.scrollWidth - parent.clientWidth), 0);
        y = Math.max(Math.min(y, parent.scrollHeight - parent.clientHeight), 0);
        x -= leftOffset;
        y -= topOffset;
        differenceX = x - parent.scrollLeft;
        differenceY = y - parent.scrollTop;
    }

    return {
        x: x,
        y: y,
        differenceX: differenceX,
        differenceY: differenceY
    };
}

function animate(parent){
    var scrollSettings = parent._scrollSettings;
    if(!scrollSettings){
        return;
    }

    var location = getTargetScrollLocation(scrollSettings.target, parent, scrollSettings.align),
        time = Date.now() - scrollSettings.startTime,
        timeValue = Math.min(1 / scrollSettings.time * time, 1);

    if(
        time > scrollSettings.time &&
        scrollSettings.endIterations > 3
    ){
        setElementScroll(parent, location.x, location.y);
        parent._scrollSettings = null;
        return scrollSettings.end(COMPLETE);
    }

    scrollSettings.endIterations++;

    var easeValue = 1 - scrollSettings.ease(timeValue);

    setElementScroll(parent,
        location.x - location.differenceX * easeValue,
        location.y - location.differenceY * easeValue
    );

    // At the end of animation, loop synchronously
    // to try and hit the taget location.
    if(time >= scrollSettings.time){
        return animate(parent);
    }

    raf(animate.bind(null, parent));
}
function transitionScrollTo(target, parent, settings, callback){
    var idle = !parent._scrollSettings,
        lastSettings = parent._scrollSettings,
        now = Date.now(),
        endHandler;

    if(lastSettings){
        lastSettings.end(CANCELED);
    }

    function end(endType){
        parent._scrollSettings = null;
        if(parent.parentElement && parent.parentElement._scrollSettings){
            parent.parentElement._scrollSettings.end(endType);
        }
        callback(endType);
        parent.removeEventListener('touchstart', endHandler, { passive: true });
        parent.removeEventListener('wheel', endHandler, { passive: true });
    }

    parent._scrollSettings = {
        startTime: lastSettings ? lastSettings.startTime : Date.now(),
        endIterations: 0,
        target: target,
        time: settings.time + (lastSettings ? now - lastSettings.startTime : 0),
        ease: settings.ease,
        align: settings.align,
        end: end
    };

    endHandler = end.bind(null, CANCELED);
    parent.addEventListener('touchstart', endHandler, { passive: true });
    parent.addEventListener('wheel', endHandler, { passive: true });

    if(idle){
        animate(parent);
    }
}

function defaultIsScrollable(element){
    return (
        'pageXOffset' in element ||
        (
            element.scrollHeight !== element.clientHeight ||
            element.scrollWidth !== element.clientWidth
        ) &&
        getComputedStyle(element).overflow !== 'hidden'
    );
}

function defaultValidTarget(){
    return true;
}

module.exports = function(target, settings, callback){
    if(!target){
        return;
    }

    if(typeof settings === 'function'){
        callback = settings;
        settings = null;
    }

    if(!settings){
        settings = {};
    }

    settings.time = isNaN(settings.time) ? 1000 : settings.time;
    settings.ease = settings.ease || function(v){return 1 - Math.pow(1 - v, v / 2);};

    var parent = target.parentElement,
        parents = 0;

    function done(endType){
        parents--;
        if(!parents){
            callback && callback(endType);
        }
    }

    var validTarget = settings.validTarget || defaultValidTarget;
    var isScrollable = settings.isScrollable;

    while(parent){
        if(validTarget(parent, parents) && (isScrollable ? isScrollable(parent, defaultIsScrollable) : defaultIsScrollable(parent))){
            parents++;
            transitionScrollTo(target, parent, settings, done);
        }

        parent = parent.parentElement;

        if(!parent){
            return;
        }

        if(parent.tagName === 'BODY'){
            parent = parent.ownerDocument;
            parent = parent.defaultView || parent.ownerWindow;
        }
    }
};

},{}],52:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":67,"inherits":23,"readable-stream/duplex.js":34,"readable-stream/passthrough.js":45,"readable-stream/readable.js":46,"readable-stream/transform.js":47,"readable-stream/writable.js":48}],53:[function(require,module,exports){
'use strict';

var bind = require('function-bind');
var ES = require('es-abstract/es5');
var replace = bind.call(Function.call, String.prototype.replace);

var leftWhitespace = /^[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/;
var rightWhitespace = /[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+$/;

module.exports = function trim() {
	var S = ES.ToString(ES.CheckObjectCoercible(this));
	return replace(replace(S, leftWhitespace, ''), rightWhitespace, '');
};

},{"es-abstract/es5":10,"function-bind":20}],54:[function(require,module,exports){
'use strict';

var bind = require('function-bind');
var define = require('define-properties');

var implementation = require('./implementation');
var getPolyfill = require('./polyfill');
var shim = require('./shim');

var boundTrim = bind.call(Function.call, getPolyfill());

define(boundTrim, {
	getPolyfill: getPolyfill,
	implementation: implementation,
	shim: shim
});

module.exports = boundTrim;

},{"./implementation":53,"./polyfill":55,"./shim":56,"define-properties":7,"function-bind":20}],55:[function(require,module,exports){
'use strict';

var implementation = require('./implementation');

var zeroWidthSpace = '\u200b';

module.exports = function getPolyfill() {
	if (String.prototype.trim && zeroWidthSpace.trim() === zeroWidthSpace) {
		return String.prototype.trim;
	}
	return implementation;
};

},{"./implementation":53}],56:[function(require,module,exports){
'use strict';

var define = require('define-properties');
var getPolyfill = require('./polyfill');

module.exports = function shimStringTrim() {
	var polyfill = getPolyfill();
	define(String.prototype, { trim: polyfill }, { trim: function () { return String.prototype.trim !== polyfill; } });
	return polyfill;
};

},{"./polyfill":55,"define-properties":7}],57:[function(require,module,exports){
(function (process,setImmediate){
var defined = require('defined');
var createDefaultStream = require('./lib/default_stream');
var Test = require('./lib/test');
var createResult = require('./lib/results');
var through = require('through');

var canEmitExit = typeof process !== 'undefined' && process
    && typeof process.on === 'function' && process.browser !== true
;
var canExit = typeof process !== 'undefined' && process
    && typeof process.exit === 'function'
;

var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

exports = module.exports = (function () {
    var harness;
    var lazyLoad = function () {
        return getHarness().apply(this, arguments);
    };

    lazyLoad.only = function () {
        return getHarness().only.apply(this, arguments);
    };

    lazyLoad.createStream = function (opts) {
        if (!opts) opts = {};
        if (!harness) {
            var output = through();
            getHarness({ stream: output, objectMode: opts.objectMode });
            return output;
        }
        return harness.createStream(opts);
    };

    lazyLoad.onFinish = function () {
        return getHarness().onFinish.apply(this, arguments);
    };

    lazyLoad.onFailure = function () {
        return getHarness().onFailure.apply(this, arguments);
    };

    lazyLoad.getHarness = getHarness

    return lazyLoad

    function getHarness(opts) {
        if (!opts) opts = {};
        opts.autoclose = !canEmitExit;
        if (!harness) harness = createExitHarness(opts);
        return harness;
    }
})();

function createExitHarness(conf) {
    if (!conf) conf = {};
    var harness = createHarness({
        autoclose: defined(conf.autoclose, false)
    });

    var stream = harness.createStream({ objectMode: conf.objectMode });
    var es = stream.pipe(conf.stream || createDefaultStream());
    if (canEmitExit) {
        es.on('error', function (err) { harness._exitCode = 1 });
    }

    var ended = false;
    stream.on('end', function () { ended = true });

    if (conf.exit === false) return harness;
    if (!canEmitExit || !canExit) return harness;

    var inErrorState = false;

    process.on('exit', function (code) {
        // let the process exit cleanly.
        if (code !== 0) {
            return
        }

        if (!ended) {
            var only = harness._results._only;
            for (var i = 0; i < harness._tests.length; i++) {
                var t = harness._tests[i];
                if (only && t !== only) continue;
                t._exit();
            }
        }
        harness.close();
        process.exit(code || harness._exitCode);
    });

    return harness;
}

exports.createHarness = createHarness;
exports.Test = Test;
exports.test = exports; // tap compat
exports.test.skip = Test.skip;

var exitInterval;

function createHarness(conf_) {
    if (!conf_) conf_ = {};
    var results = createResult();
    if (conf_.autoclose !== false) {
        results.once('done', function () { results.close() });
    }

    var test = function (name, conf, cb) {
        var t = new Test(name, conf, cb);
        test._tests.push(t);

        (function inspectCode(st) {
            st.on('test', function sub(st_) {
                inspectCode(st_);
            });
            st.on('result', function (r) {
                if (!r.ok && typeof r !== 'string') test._exitCode = 1
            });
        })(t);

        results.push(t);
        return t;
    };
    test._results = results;

    test._tests = [];

    test.createStream = function (opts) {
        return results.createStream(opts);
    };

    test.onFinish = function (cb) {
        results.on('done', cb);
    };

    test.onFailure = function (cb) {
        results.on('fail', cb);
    };

    var only = false;
    test.only = function () {
        if (only) throw new Error('there can only be one only test');
        only = true;
        var t = test.apply(null, arguments);
        results.only(t);
        return t;
    };
    test._exitCode = 0;

    test.close = function () { results.close() };

    return test;
}

}).call(this,require('_process'),require("timers").setImmediate)

},{"./lib/default_stream":58,"./lib/results":59,"./lib/test":60,"_process":33,"defined":8,"through":61,"timers":62}],58:[function(require,module,exports){
(function (process){
var through = require('through');
var fs = require('fs');

module.exports = function () {
    var line = '';
    var stream = through(write, flush);
    return stream;

    function write(buf) {
        for (var i = 0; i < buf.length; i++) {
            var c = typeof buf === 'string'
                ? buf.charAt(i)
                : String.fromCharCode(buf[i])
            ;
            if (c === '\n') flush();
            else line += c;
        }
    }

    function flush() {
        if (fs.writeSync && /^win/.test(process.platform)) {
            try { fs.writeSync(1, line + '\n'); }
            catch (e) { stream.emit('error', e) }
        } else {
            try { console.log(line) }
            catch (e) { stream.emit('error', e) }
        }
        line = '';
    }
};

}).call(this,require('_process'))

},{"_process":33,"fs":65,"through":61}],59:[function(require,module,exports){
(function (process,setImmediate){
var defined = require('defined');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var through = require('through');
var resumer = require('resumer');
var inspect = require('object-inspect');
var bind = require('function-bind');
var has = require('has');
var regexpTest = bind.call(Function.call, RegExp.prototype.test);
var yamlIndicators = /\:|\-|\?/;
var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

module.exports = Results;
inherits(Results, EventEmitter);

function Results() {
    if (!(this instanceof Results)) return new Results;
    this.count = 0;
    this.fail = 0;
    this.pass = 0;
    this.todo = 0;
    this._stream = through();
    this.tests = [];
    this._only = null;
    this._isRunning = false;
}

Results.prototype.createStream = function (opts) {
    if (!opts) opts = {};
    var self = this;
    var output, testId = 0;
    if (opts.objectMode) {
        output = through();
        self.on('_push', function ontest(t, extra) {
            if (!extra) extra = {};
            var id = testId++;
            t.once('prerun', function () {
                var row = {
                    type: 'test',
                    name: t.name,
                    id: id
                };
                if (has(extra, 'parent')) {
                    row.parent = extra.parent;
                }
                output.queue(row);
            });
            t.on('test', function (st) {
                ontest(st, { parent: id });
            });
            t.on('result', function (res) {
                res.test = id;
                res.type = 'assert';
                output.queue(res);
            });
            t.on('end', function () {
                output.queue({ type: 'end', test: id });
            });
        });
        self.on('done', function () { output.queue(null) });
    } else {
        output = resumer();
        output.queue('TAP version 13\n');
        self._stream.pipe(output);
    }

    if (!this._isRunning) {
        this._isRunning = true;
        nextTick(function next() {
            var t;
            while (t = getNextTest(self)) {
                t.run();
                if (!t.ended) return t.once('end', function () { nextTick(next); });
            }
            self.emit('done');
        });
    }

    return output;
};

Results.prototype.push = function (t) {
    var self = this;
    self.tests.push(t);
    self._watch(t);
    self.emit('_push', t);
};

Results.prototype.only = function (t) {
    this._only = t;
};

Results.prototype._watch = function (t) {
    var self = this;
    var write = function (s) { self._stream.queue(s) };
    t.once('prerun', function () {
        write('# ' + t.name + '\n');
    });

    t.on('result', function (res) {
        if (typeof res === 'string') {
            write('# ' + res + '\n');
            return;
        }
        write(encodeResult(res, self.count + 1));
        self.count ++;

        if (res.ok || res.todo) self.pass ++
        else {
            self.fail ++;
            self.emit('fail');
        }
    });

    t.on('test', function (st) { self._watch(st) });
};

Results.prototype.close = function () {
    var self = this;
    if (self.closed) self._stream.emit('error', new Error('ALREADY CLOSED'));
    self.closed = true;
    var write = function (s) { self._stream.queue(s) };

    write('\n1..' + self.count + '\n');
    write('# tests ' + self.count + '\n');
    write('# pass  ' + (self.pass + self.todo) + '\n');
    if (self.todo) write('# todo  ' + self.todo + '\n');
    if (self.fail) write('# fail  ' + self.fail + '\n');
    else write('\n# ok\n');

    self._stream.queue(null);
};

function encodeResult(res, count) {
    var output = '';
    output += (res.ok ? 'ok ' : 'not ok ') + count;
    output += res.name ? ' ' + res.name.toString().replace(/\s+/g, ' ') : '';

    if (res.skip) output += ' # SKIP';
    else if (res.todo) output += ' # TODO';

    output += '\n';
    if (res.ok) return output;

    var outer = '  ';
    var inner = outer + '  ';
    output += outer + '---\n';
    output += inner + 'operator: ' + res.operator + '\n';

    if (has(res, 'expected') || has(res, 'actual')) {
        var ex = inspect(res.expected, {depth: res.objectPrintDepth});
        var ac = inspect(res.actual, {depth: res.objectPrintDepth});

        if (Math.max(ex.length, ac.length) > 65 || invalidYaml(ex) || invalidYaml(ac)) {
            output += inner + 'expected: |-\n' + inner + '  ' + ex + '\n';
            output += inner + 'actual: |-\n' + inner + '  ' + ac + '\n';
        } else {
            output += inner + 'expected: ' + ex + '\n';
            output += inner + 'actual:   ' + ac + '\n';
        }
    }
    if (res.at) {
        output += inner + 'at: ' + res.at + '\n';
    }

    var actualStack = res.actual && (typeof res.actual === 'object' || typeof res.actual === 'function') ? res.actual.stack : undefined;
    var errorStack = res.error && res.error.stack;
    var stack = defined(actualStack, errorStack);
    if (stack) {
        var lines = String(stack).split('\n');
        output += inner + 'stack: |-\n';
        for (var i = 0; i < lines.length; i++) {
            output += inner + '  ' + lines[i] + '\n';
        }
    }

    output += outer + '...\n';
    return output;
}

function getNextTest(results) {
    if (!results._only) {
        return results.tests.shift();
    }

    do {
        var t = results.tests.shift();
        if (!t) continue;
        if (results._only === t) {
            return t;
        }
    } while (results.tests.length !== 0)
}

function invalidYaml(str) {
    return regexpTest(yamlIndicators, str);
}

}).call(this,require('_process'),require("timers").setImmediate)

},{"_process":33,"defined":8,"events":67,"function-bind":20,"has":21,"inherits":23,"object-inspect":26,"resumer":49,"through":61,"timers":62}],60:[function(require,module,exports){
(function (process,setImmediate,__dirname){
var deepEqual = require('deep-equal');
var defined = require('defined');
var path = require('path');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var has = require('has');
var trim = require('string.prototype.trim');
var bind = require('function-bind');
var forEach = require('for-each');
var isEnumerable = bind.call(Function.call, Object.prototype.propertyIsEnumerable);
var toLowerCase = bind.call(Function.call, String.prototype.toLowerCase);

module.exports = Test;

var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick;
var safeSetTimeout = setTimeout;
var safeClearTimeout = clearTimeout;

inherits(Test, EventEmitter);

var getTestArgs = function (name_, opts_, cb_) {
    var name = '(anonymous)';
    var opts = {};
    var cb;

    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        var t = typeof arg;
        if (t === 'string') {
            name = arg;
        } else if (t === 'object') {
            opts = arg || opts;
        } else if (t === 'function') {
            cb = arg;
        }
    }
    return { name: name, opts: opts, cb: cb };
};

function Test(name_, opts_, cb_) {
    if (! (this instanceof Test)) {
        return new Test(name_, opts_, cb_);
    }

    var args = getTestArgs(name_, opts_, cb_);

    this.readable = true;
    this.name = args.name || '(anonymous)';
    this.assertCount = 0;
    this.pendingCount = 0;
    this._skip = args.opts.skip || false;
    this._todo = args.opts.todo || false;
    this._timeout = args.opts.timeout;
    this._plan = undefined;
    this._cb = args.cb;
    this._progeny = [];
    this._ok = true;
    var depthEnvVar = process.env.NODE_TAPE_OBJECT_PRINT_DEPTH;
    if (args.opts.objectPrintDepth) {
        this._objectPrintDepth = args.opts.objectPrintDepth;
    } else if (depthEnvVar) {
        if (toLowerCase(depthEnvVar) === 'infinity') {
            this._objectPrintDepth = Infinity;
        } else {
            this._objectPrintDepth = depthEnvVar;
        }
    } else {
        this._objectPrintDepth = 5;
    }

    for (var prop in this) {
        this[prop] = (function bind(self, val) {
            if (typeof val === 'function') {
                return function bound() {
                    return val.apply(self, arguments);
                };
            }
            return val;
        })(this, this[prop]);
    }
}

Test.prototype.run = function () {
    if (this._skip) {
        this.comment('SKIP ' + this.name);
    }
    if (!this._cb || this._skip) {
        return this._end();
    }
    if (this._timeout != null) {
        this.timeoutAfter(this._timeout);
    }
    this.emit('prerun');
    this._cb(this);
    this.emit('run');
};

Test.prototype.test = function (name, opts, cb) {
    var self = this;
    var t = new Test(name, opts, cb);
    this._progeny.push(t);
    this.pendingCount++;
    this.emit('test', t);
    t.on('prerun', function () {
        self.assertCount++;
    })

    if (!self._pendingAsserts()) {
        nextTick(function () {
            self._end();
        });
    }

    nextTick(function () {
        if (!self._plan && self.pendingCount == self._progeny.length) {
            self._end();
        }
    });
};

Test.prototype.comment = function (msg) {
    var that = this;
    forEach(trim(msg).split('\n'), function (aMsg) {
        that.emit('result', trim(aMsg).replace(/^#\s*/, ''));
    });
};

Test.prototype.plan = function (n) {
    this._plan = n;
    this.emit('plan', n);
};

Test.prototype.timeoutAfter = function (ms) {
    if (!ms) throw new Error('timeoutAfter requires a timespan');
    var self = this;
    var timeout = safeSetTimeout(function () {
        self.fail('test timed out after ' + ms + 'ms');
        self.end();
    }, ms);
    this.once('end', function () {
        safeClearTimeout(timeout);
    });
}

Test.prototype.end = function (err) {
    var self = this;
    if (arguments.length >= 1 && !!err) {
        this.ifError(err);
    }

    if (this.calledEnd) {
        this.fail('.end() called twice');
    }
    this.calledEnd = true;
    this._end();
};

Test.prototype._end = function (err) {
    var self = this;
    if (this._progeny.length) {
        var t = this._progeny.shift();
        t.on('end', function () { self._end() });
        t.run();
        return;
    }

    if (!this.ended) this.emit('end');
    var pendingAsserts = this._pendingAsserts();
    if (!this._planError && this._plan !== undefined && pendingAsserts) {
        this._planError = true;
        this.fail('plan != count', {
            expected : this._plan,
            actual : this.assertCount
        });
    }
    this.ended = true;
};

Test.prototype._exit = function () {
    if (this._plan !== undefined &&
        !this._planError && this.assertCount !== this._plan) {
        this._planError = true;
        this.fail('plan != count', {
            expected : this._plan,
            actual : this.assertCount,
            exiting : true
        });
    } else if (!this.ended) {
        this.fail('test exited without ending', {
            exiting: true
        });
    }
};

Test.prototype._pendingAsserts = function () {
    if (this._plan === undefined) {
        return 1;
    }
    return this._plan - (this._progeny.length + this.assertCount);
};

Test.prototype._assert = function assert(ok, opts) {
    var self = this;
    var extra = opts.extra || {};

    var res = {
        id: self.assertCount++,
        ok: Boolean(ok),
        skip: defined(extra.skip, opts.skip),
        todo: defined(extra.todo, opts.todo, self._todo),
        name: defined(extra.message, opts.message, '(unnamed assert)'),
        operator: defined(extra.operator, opts.operator),
        objectPrintDepth: self._objectPrintDepth
    };
    if (has(opts, 'actual') || has(extra, 'actual')) {
        res.actual = defined(extra.actual, opts.actual);
    }
    if (has(opts, 'expected') || has(extra, 'expected')) {
        res.expected = defined(extra.expected, opts.expected);
    }
    this._ok = Boolean(this._ok && ok);

    if (!ok && !res.todo) {
        res.error = defined(extra.error, opts.error, new Error(res.name));
    }

    if (!ok) {
        var e = new Error('exception');
        var err = (e.stack || '').split('\n');
        var dir = __dirname + path.sep;

        for (var i = 0; i < err.length; i++) {
            /*
                Stack trace lines may resemble one of the following. We need
                to should correctly extract a function name (if any) and
                path / line no. for each line.

                    at myFunction (/path/to/file.js:123:45)
                    at myFunction (/path/to/file.other-ext:123:45)
                    at myFunction (/path to/file.js:123:45)
                    at myFunction (C:\path\to\file.js:123:45)
                    at myFunction (/path/to/file.js:123)
                    at Test.<anonymous> (/path/to/file.js:123:45)
                    at Test.bound [as run] (/path/to/file.js:123:45)
                    at /path/to/file.js:123:45

                Regex has three parts. First is non-capturing group for 'at '
                (plus anything preceding it).

                    /^(?:[^\s]*\s*\bat\s+)/

                Second captures function call description (optional). This is
                not necessarily a valid JS function name, but just what the
                stack trace is using to represent a function call. It may look
                like `<anonymous>` or 'Test.bound [as run]'.

                For our purposes, we assume that, if there is a function
                name, it's everything leading up to the first open
                parentheses (trimmed) before our pathname.

                    /(?:(.*)\s+\()?/

                Last part captures file path plus line no (and optional
                column no).

                    /((?:\/|[a-zA-Z]:\\)[^:\)]+:(\d+)(?::(\d+))?)/
            */
            var re = /^(?:[^\s]*\s*\bat\s+)(?:(.*)\s+\()?((?:\/|[a-zA-Z]:\\)[^:\)]+:(\d+)(?::(\d+))?)/
            var m = re.exec(err[i]);

            if (!m) {
                continue;
            }

            var callDescription = m[1] || '<anonymous>';
            var filePath = m[2];

            if (filePath.slice(0, dir.length) === dir) {
                continue;
            }

            // Function call description may not (just) be a function name.
            // Try to extract function name by looking at first "word" only.
            res.functionName = callDescription.split(/\s+/)[0]
            res.file = filePath;
            res.line = Number(m[3]);
            if (m[4]) res.column = Number(m[4]);

            res.at = callDescription + ' (' + filePath + ')';
            break;
        }
    }

    self.emit('result', res);

    var pendingAsserts = self._pendingAsserts();
    if (!pendingAsserts) {
        if (extra.exiting) {
            self._end();
        } else {
            nextTick(function () {
                self._end();
            });
        }
    }

    if (!self._planError && pendingAsserts < 0) {
        self._planError = true;
        self.fail('plan != count', {
            expected : self._plan,
            actual : self._plan - pendingAsserts
        });
    }
};

Test.prototype.fail = function (msg, extra) {
    this._assert(false, {
        message : msg,
        operator : 'fail',
        extra : extra
    });
};

Test.prototype.pass = function (msg, extra) {
    this._assert(true, {
        message : msg,
        operator : 'pass',
        extra : extra
    });
};

Test.prototype.skip = function (msg, extra) {
    this._assert(true, {
        message : msg,
        operator : 'skip',
        skip : true,
        extra : extra
    });
};

function assert(value, msg, extra) {
    this._assert(value, {
        message : defined(msg, 'should be truthy'),
        operator : 'ok',
        expected : true,
        actual : value,
        extra : extra
    });
}
Test.prototype.ok
= Test.prototype['true']
= Test.prototype.assert
= assert;

function notOK(value, msg, extra) {
    this._assert(!value, {
        message : defined(msg, 'should be falsy'),
        operator : 'notOk',
        expected : false,
        actual : value,
        extra : extra
    });
}
Test.prototype.notOk
= Test.prototype['false']
= Test.prototype.notok
= notOK;

function error(err, msg, extra) {
    this._assert(!err, {
        message : defined(msg, String(err)),
        operator : 'error',
        actual : err,
        extra : extra
    });
}
Test.prototype.error
= Test.prototype.ifError
= Test.prototype.ifErr
= Test.prototype.iferror
= error;

function equal(a, b, msg, extra) {
    this._assert(a === b, {
        message : defined(msg, 'should be equal'),
        operator : 'equal',
        actual : a,
        expected : b,
        extra : extra
    });
}
Test.prototype.equal
= Test.prototype.equals
= Test.prototype.isEqual
= Test.prototype.is
= Test.prototype.strictEqual
= Test.prototype.strictEquals
= equal;

function notEqual(a, b, msg, extra) {
    this._assert(a !== b, {
        message : defined(msg, 'should not be equal'),
        operator : 'notEqual',
        actual : a,
        expected : b,
        extra : extra
    });
}
Test.prototype.notEqual
= Test.prototype.notEquals
= Test.prototype.notStrictEqual
= Test.prototype.notStrictEquals
= Test.prototype.isNotEqual
= Test.prototype.isNot
= Test.prototype.not
= Test.prototype.doesNotEqual
= Test.prototype.isInequal
= notEqual;

function tapeDeepEqual(a, b, msg, extra) {
    this._assert(deepEqual(a, b, { strict: true }), {
        message : defined(msg, 'should be equivalent'),
        operator : 'deepEqual',
        actual : a,
        expected : b,
        extra : extra
    });
}
Test.prototype.deepEqual
= Test.prototype.deepEquals
= Test.prototype.isEquivalent
= Test.prototype.same
= tapeDeepEqual;

function deepLooseEqual(a, b, msg, extra) {
    this._assert(deepEqual(a, b), {
        message : defined(msg, 'should be equivalent'),
        operator : 'deepLooseEqual',
        actual : a,
        expected : b,
        extra : extra
    });
}
Test.prototype.deepLooseEqual
= Test.prototype.looseEqual
= Test.prototype.looseEquals
= deepLooseEqual;

function notDeepEqual(a, b, msg, extra) {
    this._assert(!deepEqual(a, b, { strict: true }), {
        message : defined(msg, 'should not be equivalent'),
        operator : 'notDeepEqual',
        actual : a,
        expected : b,
        extra : extra
    });
}
Test.prototype.notDeepEqual
= Test.prototype.notDeepEquals
= Test.prototype.notEquivalent
= Test.prototype.notDeeply
= Test.prototype.notSame
= Test.prototype.isNotDeepEqual
= Test.prototype.isNotDeeply
= Test.prototype.isNotEquivalent
= Test.prototype.isInequivalent
= notDeepEqual;

function notDeepLooseEqual(a, b, msg, extra) {
    this._assert(!deepEqual(a, b), {
        message : defined(msg, 'should be equivalent'),
        operator : 'notDeepLooseEqual',
        actual : a,
        expected : b,
        extra : extra
    });
}
Test.prototype.notDeepLooseEqual
= Test.prototype.notLooseEqual
= Test.prototype.notLooseEquals
= notDeepLooseEqual;

Test.prototype['throws'] = function (fn, expected, msg, extra) {
    if (typeof expected === 'string') {
        msg = expected;
        expected = undefined;
    }

    var caught = undefined;

    try {
        fn();
    } catch (err) {
        caught = { error : err };
        if ((err != null) && (!isEnumerable(err, 'message') || !has(err, 'message'))) {
            var message = err.message;
            delete err.message;
            err.message = message;
        }
    }

    var passed = caught;

    if (expected instanceof RegExp) {
        passed = expected.test(caught && caught.error);
        expected = String(expected);
    }

    if (typeof expected === 'function' && caught) {
        passed = caught.error instanceof expected;
        caught.error = caught.error.constructor;
    }

    this._assert(typeof fn === 'function' && passed, {
        message : defined(msg, 'should throw'),
        operator : 'throws',
        actual : caught && caught.error,
        expected : expected,
        error: !passed && caught && caught.error,
        extra : extra
    });
};

Test.prototype.doesNotThrow = function (fn, expected, msg, extra) {
    if (typeof expected === 'string') {
        msg = expected;
        expected = undefined;
    }
    var caught = undefined;
    try {
        fn();
    }
    catch (err) {
        caught = { error : err };
    }
    this._assert(!caught, {
        message : defined(msg, 'should not throw'),
        operator : 'throws',
        actual : caught && caught.error,
        expected : expected,
        error : caught && caught.error,
        extra : extra
    });
};

Test.skip = function (name_, _opts, _cb) {
    var args = getTestArgs.apply(null, arguments);
    args.opts.skip = true;
    return Test(args.name, args.opts, args.cb);
};

// vim: set softtabstop=4 shiftwidth=4:

}).call(this,require('_process'),require("timers").setImmediate,"/node_modules/tape/lib")

},{"_process":33,"deep-equal":4,"defined":8,"events":67,"for-each":18,"function-bind":20,"has":21,"inherits":23,"path":30,"string.prototype.trim":54,"timers":62}],61:[function(require,module,exports){
(function (process){
var Stream = require('stream')

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

exports = module.exports = through
through.through = through

//create a readable writable stream.

function through (write, end, opts) {
  write = write || function (data) { this.queue(data) }
  end = end || function () { this.queue(null) }

  var ended = false, destroyed = false, buffer = [], _ended = false
  var stream = new Stream()
  stream.readable = stream.writable = true
  stream.paused = false

//  stream.autoPause   = !(opts && opts.autoPause   === false)
  stream.autoDestroy = !(opts && opts.autoDestroy === false)

  stream.write = function (data) {
    write.call(this, data)
    return !stream.paused
  }

  function drain() {
    while(buffer.length && !stream.paused) {
      var data = buffer.shift()
      if(null === data)
        return stream.emit('end')
      else
        stream.emit('data', data)
    }
  }

  stream.queue = stream.push = function (data) {
//    console.error(ended)
    if(_ended) return stream
    if(data === null) _ended = true
    buffer.push(data)
    drain()
    return stream
  }

  //this will be registered as the first 'end' listener
  //must call destroy next tick, to make sure we're after any
  //stream piped from here.
  //this is only a problem if end is not emitted synchronously.
  //a nicer way to do this is to make sure this is the last listener for 'end'

  stream.on('end', function () {
    stream.readable = false
    if(!stream.writable && stream.autoDestroy)
      process.nextTick(function () {
        stream.destroy()
      })
  })

  function _end () {
    stream.writable = false
    end.call(stream)
    if(!stream.readable && stream.autoDestroy)
      stream.destroy()
  }

  stream.end = function (data) {
    if(ended) return
    ended = true
    if(arguments.length) stream.write(data)
    _end() // will emit or queue
    return stream
  }

  stream.destroy = function () {
    if(destroyed) return
    destroyed = true
    ended = true
    buffer.length = 0
    stream.writable = stream.readable = false
    stream.emit('close')
    return stream
  }

  stream.pause = function () {
    if(stream.paused) return
    stream.paused = true
    return stream
  }

  stream.resume = function () {
    if(stream.paused) {
      stream.paused = false
      stream.emit('resume')
    }
    drain()
    //may have become paused again,
    //as drain emits 'data'.
    if(!stream.paused)
      stream.emit('drain')
    return stream
  }
  return stream
}


}).call(this,require('_process'))

},{"_process":33,"stream":52}],62:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)

},{"process/browser.js":33,"timers":62}],63:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],64:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],65:[function(require,module,exports){
arguments[4][2][0].apply(exports,arguments)
},{"dup":2}],66:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)

},{"base64-js":64,"buffer":66,"ieee754":22}],67:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],68:[function(require,module,exports){
var test = require('tape'),
    driver = require('../');

window.onload = function(){
    driver.init({
        runDelay: 10,
        keyPressDelay: 1
    });

    test('do stuff', function(t) {
        t.plan(3);

        driver()
            .click('I am a button')
            .focus('test input', 'field')
            .pressKey('1')
            .wait(200)
            .pressKey('a')
            .then(function(result, callback){
                t.equal(result.tagName, 'INPUT', 'Result is focused input');
                callback(null, result);
            })
            .click('I am a button')
            .blur()
            .go(function(error, result) {

                t.notOk(error, 'should not error');
                t.ok(result, 'got a result');
            });
    });

    test('test placeholder', function(t) {
        driver()
            .focus('input with placeholder')
            .pressKeys('test value')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.ok(result, 'got a result');
            });
    });

    test('test regex', function(t) {
        driver()
            .focus(/.*test.*/i)
            .pressKeys('test value')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.ok(result, 'got a result');
            });
    });

    test('test button value', function(t) {
        driver()
            .click('i need a click')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a button');
                t.equal(result.value, 'i need a click', 'got correct button');
            });
    });

    test('test aria-label', function(t) {
        driver()
            .click('click me')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a button');
                t.equal(result.getAttribute('aria-label'), 'click me', 'got correct button');
            });
    });

    test('test aria role button', function(t) {
        driver()
            .click('I\'m like a button')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'LABEL', 'got a "button"');
                t.equal(result.getAttribute('role'), 'button', 'got correct "button"');
            });
    });

    test('test aria role non-button text', function(t) {
        driver()
            .findUi('I\'m like a button', 'label')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'LABEL', 'got a "button"');
                t.notEqual(result.getAttribute('role'), 'button', 'got correct "button"');
            });
    });
};

},{"../":1,"tape":57}]},{},[68])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyLXJlc29sdmUvZW1wdHkuanMiLCJub2RlX21vZHVsZXMvY29yZS11dGlsLWlzL2xpYi91dGlsLmpzIiwibm9kZV9tb2R1bGVzL2RlZXAtZXF1YWwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVlcC1lcXVhbC9saWIvaXNfYXJndW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL2RlZXAtZXF1YWwvbGliL2tleXMuanMiLCJub2RlX21vZHVsZXMvZGVmaW5lLXByb3BlcnRpZXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVmaW5lZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lcy1hYnN0cmFjdC9HZXRJbnRyaW5zaWMuanMiLCJub2RlX21vZHVsZXMvZXMtYWJzdHJhY3QvZXM1LmpzIiwibm9kZV9tb2R1bGVzL2VzLWFic3RyYWN0L2hlbHBlcnMvYXNzZXJ0UmVjb3JkLmpzIiwibm9kZV9tb2R1bGVzL2VzLWFic3RyYWN0L2hlbHBlcnMvaXNGaW5pdGUuanMiLCJub2RlX21vZHVsZXMvZXMtYWJzdHJhY3QvaGVscGVycy9pc05hTi5qcyIsIm5vZGVfbW9kdWxlcy9lcy1hYnN0cmFjdC9oZWxwZXJzL21vZC5qcyIsIm5vZGVfbW9kdWxlcy9lcy1hYnN0cmFjdC9oZWxwZXJzL3NpZ24uanMiLCJub2RlX21vZHVsZXMvZXMtdG8tcHJpbWl0aXZlL2VzNS5qcyIsIm5vZGVfbW9kdWxlcy9lcy10by1wcmltaXRpdmUvaGVscGVycy9pc1ByaW1pdGl2ZS5qcyIsIm5vZGVfbW9kdWxlcy9mb3ItZWFjaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mdW5jdGlvbi1iaW5kL2ltcGxlbWVudGF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2Z1bmN0aW9uLWJpbmQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaGFzL3NyYy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2luaGVyaXRzL2luaGVyaXRzX2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvaXMtYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2lzLWNhbGxhYmxlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL29iamVjdC1rZXlzL2ltcGxlbWVudGF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL29iamVjdC1rZXlzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL29iamVjdC1rZXlzL2lzQXJndW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL3BhdGgtYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcmVkYXRvci9wcmVkYXRvci5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzLW5leHRpY2stYXJncy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2R1cGxleC1icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9kdXBsZXguanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3Bhc3N0aHJvdWdoLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9yZWFkYWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV93cml0YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL2ludGVybmFsL3N0cmVhbXMvQnVmZmVyTGlzdC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL2ludGVybmFsL3N0cmVhbXMvZGVzdHJveS5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL2ludGVybmFsL3N0cmVhbXMvc3RyZWFtLWJyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9ub2RlX21vZHVsZXMvc3RyaW5nX2RlY29kZXIvbGliL3N0cmluZ19kZWNvZGVyLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9wYXNzdGhyb3VnaC5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vcmVhZGFibGUtYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS93cml0YWJsZS1icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3Jlc3VtZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2FmZS1idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2Nyb2xsLWludG8tdmlldy9zY3JvbGxJbnRvVmlldy5qcyIsIm5vZGVfbW9kdWxlcy9zdHJlYW0tYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zdHJpbmcucHJvdG90eXBlLnRyaW0vaW1wbGVtZW50YXRpb24uanMiLCJub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N0cmluZy5wcm90b3R5cGUudHJpbS9wb2x5ZmlsbC5qcyIsIm5vZGVfbW9kdWxlcy9zdHJpbmcucHJvdG90eXBlLnRyaW0vc2hpbS5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbGliL2RlZmF1bHRfc3RyZWFtLmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbGliL3Jlc3VsdHMuanMiLCJub2RlX21vZHVsZXMvdGFwZS9saWIvdGVzdC5qcyIsIm5vZGVfbW9kdWxlcy90aHJvdWdoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3RpbWVycy1icm93c2VyaWZ5L21haW4uanMiLCJub2RlX21vZHVsZXMvdXRpbC1kZXByZWNhdGUvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCJ0ZXN0cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNjQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOXFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2U0E7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7O0FDREE7QUFDQTs7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL01BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQy9KQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDMWlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN2SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2p2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgcHJlZGF0b3IgPSByZXF1aXJlKCdwcmVkYXRvcicpO1xudmFyIHNjcm9sbEludG9WaWV3ID0gcmVxdWlyZSgnc2Nyb2xsLWludG8tdmlldycpO1xuXG4vLyBMaXN0IG9mIHNlbGVjdG9ycyBvcmRlcmVkIGJ5IHRoZWlyIGxpa2VsaW5lc3MgdG8gYmUgdGhlIHRhcmdldCBvZiB0ZXh0L2NsaWNrL3ZhbHVlIHNlbGVjdGlvblxudmFyIHRleHRXZWlnaHRpbmcgPSBbJ2gxJywgJ2gyJywgJ2gzJywgJ2g0JywgJ2xhYmVsJywgJ3AnLCAnYScsICdidXR0b24nLCAnW3JvbGU9YnV0dG9uXSddO1xudmFyIGNsaWNrV2VpZ2h0aW5nID0gWydidXR0b24nLCAnW3JvbGU9YnV0dG9uXScsICdpbnB1dCcsICdhJywgJ2gxJywgJ2gyJywgJ2gzJywgJ2g0JywgJ2knLCAnbGFiZWwnXTtcbnZhciB2YWx1ZVdlaWdodGluZyA9IFsnaW5wdXQnLCAndGV4dGFyZWEnLCAnc2VsZWN0JywgJ2xhYmVsJ107XG5cbnZhciB0eXBlcyA9IHtcbiAgICAgICAgJ2J1dHRvbic6IFsnYnV0dG9uJywgJ2EnLCAnaW5wdXRbdHlwZT1idXR0b25dJywgJ1tyb2xlPWJ1dHRvbl0nXSxcbiAgICAgICAgJ2xhYmVsJzogWydsYWJlbCcsICdzcGFuJywgJzpub3QoW3JvbGU9YnV0dG9uXSknXSxcbiAgICAgICAgJ2hlYWRpbmcnOiBbJ1tyb2xlPWhlYWRpbmddJywgJ2gxJywgJ2gyJywgJ2gzJywgJ2g0J10sXG4gICAgICAgICdpbWFnZSc6IFsnaW1nJywgJ3N2ZycsICdbcm9sZT1pbWddJ10sXG4gICAgICAgICdmaWVsZCc6IFsnaW5wdXQnLCAndGV4dGFyZWEnLCAnc2VsZWN0JywgJ2xhYmVsJ10sXG4gICAgICAgICdhbGwnOiBbJyonXSxcbiAgICAgICAgJ3RleHQnOiBbJyonXVxuICAgIH0sXG4gICAgbm9FbGVtZW50T2ZUeXBlID0gJ25vIGVsZW1lbnRzIG9mIHR5cGUgJyxcbiAgICBkb2N1bWVudFNjb3BlLFxuICAgIHdpbmRvd1Njb3BlLFxuICAgIHJ1bkRlbGF5LFxuICAgIGtleVByZXNzRGVsYXksXG4gICAgaW5pdGlhbGlzZWQ7XG5cbmZ1bmN0aW9uIF9wcmVzc0tleShrZXksIGRvbmUpIHtcbiAgICB2YXIgZWxlbWVudCA9IHRoaXMuY3VycmVudENvbnRleHQuYWN0aXZlRWxlbWVudDtcblxuICAgIGVsZW1lbnQudmFsdWUgKz0ga2V5O1xuXG4gICAgdmFyIGtleWRvd25FdmVudCA9IG5ldyB3aW5kb3dTY29wZS5LZXlib2FyZEV2ZW50KCdrZXlkb3duJyksXG4gICAgICAgIGtleXVwRXZlbnQgPSBuZXcgd2luZG93U2NvcGUuS2V5Ym9hcmRFdmVudCgna2V5dXAnKSxcbiAgICAgICAgcHJlc3NLZXlFdmVudCA9IG5ldyB3aW5kb3dTY29wZS5LZXlib2FyZEV2ZW50KCdwcmVzc0tleScpO1xuXG4gICAgdmFyIG1ldGhvZCA9ICdpbml0S2V5Ym9hcmRFdmVudCcgaW4ga2V5ZG93bkV2ZW50ID8gJ2luaXRLZXlib2FyZEV2ZW50JyA6ICdpbml0S2V5RXZlbnQnO1xuXG4gICAga2V5ZG93bkV2ZW50W21ldGhvZF0oJ2tleWRvd24nLCB0cnVlLCB0cnVlLCB3aW5kb3dTY29wZSwga2V5LCAzLCB0cnVlLCBmYWxzZSwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcbiAgICBrZXl1cEV2ZW50W21ldGhvZF0oJ2tleXVwJywgdHJ1ZSwgdHJ1ZSwgd2luZG93U2NvcGUsIGtleSwgMywgdHJ1ZSwgZmFsc2UsIHRydWUsIGZhbHNlLCBmYWxzZSk7XG4gICAgcHJlc3NLZXlFdmVudFttZXRob2RdKCdwcmVzc0tleScsIHRydWUsIHRydWUsIHdpbmRvd1Njb3BlLCBrZXksIDMsIHRydWUsIGZhbHNlLCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xuXG4gICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGtleWRvd25FdmVudCk7XG4gICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGtleXVwRXZlbnQpO1xuICAgIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChwcmVzc0tleUV2ZW50KTtcblxuICAgIGRvbmUobnVsbCwgZWxlbWVudCk7XG59XG5cbmZ1bmN0aW9uIF9wcmVzc0tleXMoa2V5cywgZG9uZSkge1xuICAgIHZhciBzdGF0ZSA9IHRoaXMsXG4gICAgICAgIG5leHRLZXkgPSBTdHJpbmcoa2V5cykuY2hhckF0KDApO1xuXG4gICAgaWYobmV4dEtleSA9PT0gJycpe1xuICAgICAgICByZXR1cm4gZG9uZShudWxsLCB0aGlzLmN1cnJlbnRDb250ZXh0LmFjdGl2ZUVsZW1lbnQpO1xuICAgIH1cblxuICAgIF9wcmVzc0tleS5jYWxsKHN0YXRlLCBuZXh0S2V5LCBmdW5jdGlvbigpIHtcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgX3ByZXNzS2V5cy5jYWxsKHN0YXRlLCBTdHJpbmcoa2V5cykuc2xpY2UoMSksIGRvbmUpO1xuICAgICAgICB9LCBzdGF0ZS5rZXlQcmVzc0RlbGF5KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZmluZFVpKGN1cnJlbnRDb250ZXgsIHNlbGVjdG9ycykge1xuICAgIHZhciBjYW5kaWRhdGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoY3VycmVudENvbnRleC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9ycykpO1xuXG4gICAgcmV0dXJuIGNhbmRpZGF0ZXMuc29ydChmdW5jdGlvbihhLCBiKXtcbiAgICAgICAgICAgIHJldHVybiAhYS5jb250YWlucyhiKSA/IC0xIDogMDtcbiAgICAgICAgfSk7IC8vIGRlZXBlciBlbGVtZW50cyB0YWtlIHByZWNlZGVuY2UuXG59XG5cbmZ1bmN0aW9uIF9uYXZpZ2F0ZShsb2NhdGlvbiwgcHJldmlvdXNFbGVtZW50LCBkb25lKSB7XG4gICAgdmFyIGNhbGxiYWNrVGltZXI7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGV3aW5kb3dTY29wZUVycm9yKGVycm9yKSB7XG4gICAgICAgIGNsZWFyVGltZW91dChjYWxsYmFja1RpbWVyKTtcblxuICAgICAgICBkb25lKGVycm9yKTtcbiAgICAgICAgd2luZG93U2NvcGUucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCBoYW5kbGV3aW5kb3dTY29wZUVycm9yKTtcbiAgICB9XG5cbiAgICB3aW5kb3dTY29wZS5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGhhbmRsZXdpbmRvd1Njb3BlRXJyb3IpO1xuICAgIHdpbmRvd1Njb3BlLmxvY2F0aW9uID0gbG9jYXRpb247XG5cbiAgICBjYWxsYmFja1RpbWVyID0gc2V0VGltZW91dChkb25lLCAxNTApO1xufVxuXG5mdW5jdGlvbiBfZ2V0TG9jYXRpb24oZG9uZSkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGRvbmUobnVsbCwgd2luZG93U2NvcGUubG9jYXRpb24pO1xuICAgIH0sIDUwMCk7XG59XG5cbmZ1bmN0aW9uIGNoZWNrTWF0Y2hWYWx1ZSh0YXJnZXRWYWx1ZSwgdmFsdWUpe1xuICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKXtcbiAgICAgICAgcmV0dXJuIHRhcmdldFZhbHVlICYmIHRhcmdldFZhbHVlLm1hdGNoKHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0VmFsdWUgJiYgdGFyZ2V0VmFsdWUudG9Mb3dlckNhc2UoKS50cmltKCkgPT09IHZhbHVlLnRvTG93ZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIG1hdGNoRWxlbWVudFZhbHVlKGVsZW1lbnQsIHZhbHVlKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICAgY2hlY2tNYXRjaFZhbHVlKGVsZW1lbnQudGV4dENvbnRlbnQsIHZhbHVlKSB8fFxuICAgICAgICBjaGVja01hdGNoVmFsdWUoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3RpdGxlJyksIHZhbHVlKSB8fFxuICAgICAgICBjaGVja01hdGNoVmFsdWUoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJyksIHZhbHVlKSB8fFxuICAgICAgICBjaGVja01hdGNoVmFsdWUoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgdmFsdWUpIHx8XG4gICAgICAgIGNoZWNrTWF0Y2hWYWx1ZShlbGVtZW50LnZhbHVlLCB2YWx1ZSlcbiAgICApO1xufVxuXG5mdW5jdGlvbiBmaW5kTWF0Y2hpbmdFbGVtZW50cyh2YWx1ZSwgdHlwZSwgZWxlbWVudHNMaXN0KSB7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGVsZW1lbnRzTGlzdClcbiAgICAgICAgLmZpbHRlcihmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gbWF0Y2hFbGVtZW50VmFsdWUoZWxlbWVudCwgdmFsdWUpO1xuICAgICAgICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudFRleHRXZWlnaHQoZWxlbWVudCkge1xuICAgIHZhciBpbmRleCA9IHRleHRXZWlnaHRpbmcuZmluZEluZGV4KHNlbGVjdG9yID0+IGVsZW1lbnQubWF0Y2hlcyhzZWxlY3RvcikpO1xuICAgIHJldHVybiB0ZXh0V2VpZ2h0aW5nLmxlbmd0aCAtIChpbmRleCA8IDAgPyBJbmZpbml0eSA6IGluZGV4KTtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudENsaWNrV2VpZ2h0KGVsZW1lbnQpIHtcbiAgICB2YXIgaW5kZXggPSBjbGlja1dlaWdodGluZy5maW5kSW5kZXgoc2VsZWN0b3IgPT4gZWxlbWVudC5tYXRjaGVzKHNlbGVjdG9yKSk7XG4gICAgcmV0dXJuIGNsaWNrV2VpZ2h0aW5nLmxlbmd0aCAtIChpbmRleCA8IDAgPyBJbmZpbml0eSA6IGluZGV4KTtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudFZhbHVlV2VpZ2h0KGVsZW1lbnQpIHtcbiAgICB2YXIgaW5kZXggPSB2YWx1ZVdlaWdodGluZy5maW5kSW5kZXgoc2VsZWN0b3IgPT4gZWxlbWVudC5tYXRjaGVzKHNlbGVjdG9yKSk7XG4gICAgcmV0dXJuIHZhbHVlV2VpZ2h0aW5nLmxlbmd0aCAtIChpbmRleCA8IDAgPyBJbmZpbml0eSA6IGluZGV4KTtcbn1cblxuZnVuY3Rpb24gX2ZpbmRBbGxVaSh2YWx1ZSwgdHlwZSwgZG9uZSl7XG4gICAgaWYoIXR5cGUpe1xuICAgICAgICB0eXBlID0gJ2FsbCc7XG4gICAgfVxuXG4gICAgdmFyIGVsZW1lbnRUeXBlcyA9IHR5cGVzW3R5cGVdO1xuXG5cbiAgICBpZighZWxlbWVudFR5cGVzKSB7XG4gICAgICAgIHJldHVybiBkb25lKG5ldyBFcnJvcih0eXBlICsgJyBpcyBub3QgYSB2YWxpZCB1aSB0eXBlJykpO1xuICAgIH1cblxuICAgIHZhciBlbGVtZW50cyA9IGZpbmRVaSh0aGlzLmN1cnJlbnRDb250ZXh0LCBlbGVtZW50VHlwZXMpO1xuXG4gICAgaWYoIWVsZW1lbnRzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZG9uZShuZXcgRXJyb3Iobm9FbGVtZW50T2ZUeXBlICsgdHlwZSkpO1xuICAgIH1cblxuICAgIHZhciByZXN1bHRzID0gZmluZE1hdGNoaW5nRWxlbWVudHModmFsdWUsIHR5cGUsIGVsZW1lbnRzKVxuICAgICAgICAuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0RWxlbWVudFRleHRXZWlnaHQoYikgLSBnZXRFbGVtZW50VGV4dFdlaWdodChhKTtcbiAgICAgICAgfSk7XG5cbiAgICBkb25lKG51bGwsIHJlc3VsdHMpO1xufVxuXG5mdW5jdGlvbiBfZmluZFVpKHZhbHVlLCB0eXBlLCByZXR1cm5BcnJheSwgZG9uZSkge1xuICAgIGlmKCFkb25lKSB7XG4gICAgICAgIGRvbmUgPSByZXR1cm5BcnJheTtcbiAgICAgICAgcmV0dXJuQXJyYXkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBfZmluZEFsbFVpLmNhbGwodGhpcywgdmFsdWUsIHR5cGUsIGZ1bmN0aW9uKGVycm9yLCBlbGVtZW50cyl7XG4gICAgICAgIGlmKGVycm9yKXtcbiAgICAgICAgICAgIHJldHVybiBkb25lKGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCFlbGVtZW50cy5sZW5ndGgpe1xuICAgICAgICAgICAgcmV0dXJuIGRvbmUobmV3IEVycm9yKCdcIicgKyB2YWx1ZSArICdcIiB3YXMgbm90IGZvdW5kJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHJlc3VsdHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChlbGVtZW50cylcbiAgICAgICAgICAgIC5maWx0ZXIoZnVuY3Rpb24oZWxlbWVudCl7XG4gICAgICAgICAgICAgICAgcmV0dXJuICFwcmVkYXRvcihlbGVtZW50KS5oaWRkZW47XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICBpZighcmVzdWx0cy5sZW5ndGgpe1xuICAgICAgICAgICAgcmV0dXJuIGRvbmUobmV3IEVycm9yKCdcIicgKyB2YWx1ZSArICdcIiB3YXMgZm91bmQgYnV0IG5vdCB2aXNpYmxlIG9uIHNjcmVlbicpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRvbmUobnVsbCwgcmV0dXJuQXJyYXkgPyByZXN1bHRzIDogcmVzdWx0cy5zaGlmdCgpKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX3NldFZhbHVlKHZhbHVlLCB0eXBlLCB0ZXh0LCBkb25lKSB7XG4gICAgX2ZvY3VzLmNhbGwodGhpcywgdmFsdWUsIHR5cGUsIGZ1bmN0aW9uKGVycm9yLCBlbGVtZW50KSB7XG4gICAgICAgIGlmKGVycm9yKXtcbiAgICAgICAgICAgIHJldHVybiBkb25lKGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsZW1lbnQudmFsdWUgPSB0ZXh0O1xuXG4gICAgICAgIGRvbmUobnVsbCwgZWxlbWVudCk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF93YWl0KHRpbWUsIGRvbmUpIHtcbiAgICBzZXRUaW1lb3V0KGRvbmUsIHRpbWUgfHwgMCk7XG59XG5cbmZ1bmN0aW9uIGZpbmRDbGlja2FibGUoY3VycmVudENvbnRleHQsIGVsZW1lbnRzKXtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgZWxlbWVudHMubGVuZ3RoOyBpKyspe1xuICAgICAgICB2YXIgZWxlbWVudCA9IGVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgICAgICBjbGlja0VsZW1lbnQgPSBjdXJyZW50Q29udGV4dC5lbGVtZW50RnJvbVBvaW50KHJlY3QubGVmdCArIHJlY3Qud2lkdGggLyAyLCByZWN0LnRvcCArIHJlY3QuaGVpZ2h0IC8gMiksXG4gICAgICAgICAgICBjbGlja0VsZW1lbnRJbkVsZW1lbnQgPSBlbGVtZW50LmNvbnRhaW5zKGNsaWNrRWxlbWVudCksXG4gICAgICAgICAgICBlbGVtZW50SW5DbGlja0VsZW1lbnQgPSBjbGlja0VsZW1lbnQuY29udGFpbnMoZWxlbWVudCk7XG5cbiAgICAgICAgaWYoY2xpY2tFbGVtZW50SW5FbGVtZW50IHx8IGVsZW1lbnRJbkNsaWNrRWxlbWVudCB8fCBjbGlja0VsZW1lbnQgPT09IGVsZW1lbnQpe1xuICAgICAgICAgICAgcmV0dXJuIGNsaWNrRWxlbWVudDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZXhlY3V0ZUNsaWNrKHZhbHVlLCB0eXBlLCBkb25lKSB7XG4gICAgdmFyIHN0YXRlID0gdGhpcztcbiAgICBfZmluZFVpLmNhbGwoc3RhdGUsIHZhbHVlLCAnYWxsJywgdHJ1ZSwgZnVuY3Rpb24oZXJyb3IsIGVsZW1lbnRzKSB7XG4gICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZG9uZShlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2xpY2thYmxlRWxlbWVudHMgPSBlbGVtZW50c1xuICAgICAgICAgICAgLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRFbGVtZW50Q2xpY2tXZWlnaHQoYikgLSBnZXRFbGVtZW50Q2xpY2tXZWlnaHQoYSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB2YXIgZWxlbWVudCA9IGZpbmRDbGlja2FibGUoc3RhdGUuY3VycmVudENvbnRleHQsIGVsZW1lbnRzKTtcblxuICAgICAgICBpZighZWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIGRvbmUobmV3IEVycm9yKCdjb3VsZCBub3QgZmluZCBjbGlja2FibGUgZWxlbWVudCBtYXRjaGluZyBcIicgKyB2YWx1ZSArICdcIicpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNWRyBwYXRoc1xuICAgICAgICB3aGlsZSghZWxlbWVudC5jbGljayl7XG4gICAgICAgICAgICBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZWxlbWVudC5jbGljaygpO1xuXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGRvbmUobnVsbCwgZWxlbWVudCk7XG4gICAgICAgIH0sIGNsaWNrRGVsYXkpXG5cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2ZvY3VzKHZhbHVlLCB0eXBlLCBkb25lKSB7XG4gICBfZmluZFVpLmNhbGwodGhpcywgdmFsdWUsIHR5cGUsIHRydWUsIGZ1bmN0aW9uKGVycm9yLCBlbGVtZW50cyl7XG4gICAgICAgIGlmKGVycm9yKXtcbiAgICAgICAgICAgIHJldHVybiBkb25lKGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXN1bHQgPSBlbGVtZW50c1xuICAgICAgICAgICAgLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRFbGVtZW50VmFsdWVXZWlnaHQoYikgLSBnZXRFbGVtZW50VmFsdWVXZWlnaHQoYSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnNoaWZ0KCk7XG5cbiAgICAgICAgcmVzdWx0LmZvY3VzKCk7XG5cbiAgICAgICAgZG9uZShudWxsLCByZXN1bHQpO1xuICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9jaGFuZ2VWYWx1ZSh2YWx1ZSwgdHlwZSwgdGV4dCwgZG9uZSkge1xuICAgIHZhciBzdGF0ZSA9IHRoaXM7XG5cbiAgICBfZm9jdXMuY2FsbChzdGF0ZSwgdmFsdWUsIHR5cGUsIGZ1bmN0aW9uKGVycm9yLCBlbGVtZW50KSB7XG4gICAgICAgIGlmKGVycm9yKXtcbiAgICAgICAgICAgIHJldHVybiBkb25lKGVycm9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF9wcmVzc0tleXMuY2FsbChzdGF0ZSwgdGV4dCwgZnVuY3Rpb24oZXJyb3Ipe1xuICAgICAgICAgICAgaWYoZXJyb3Ipe1xuICAgICAgICAgICAgICAgIHJldHVybiBkb25lKGVycm9yKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWxlbWVudC5ibHVyKCk7XG5cbiAgICAgICAgICAgIHZhciBldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdIVE1MRXZlbnRzJyk7XG5cbiAgICAgICAgICAgIGV2ZW50LmluaXRFdmVudCgnY2hhbmdlJywgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcblxuICAgICAgICAgICAgZG9uZShudWxsLCBlbGVtZW50KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9nZXRWYWx1ZSh2YWx1ZSwgdHlwZSwgZG9uZSkge1xuICAgIF9mb2N1cy5jYWxsKHRoaXMsIHZhbHVlLCB0eXBlLCBmdW5jdGlvbihlcnJvciwgZWxlbWVudCkge1xuICAgICAgICBpZihlcnJvcil7XG4gICAgICAgICAgICByZXR1cm4gZG9uZShlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICBkb25lKG51bGwsICd2YWx1ZScgaW4gZWxlbWVudCA/IGVsZW1lbnQudmFsdWUgOiBlbGVtZW50LnRleHRDb250ZW50KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX3RoZW4odGFzaywgZG9uZSkge1xuICAgIHZhciBzdGF0ZSA9IHRoaXM7XG4gICAgdGFzayhzdGF0ZS5sYXN0UmVzdWx0LCBkb25lKTtcbn1cblxuZnVuY3Rpb24gX2JsdXIoZG9uZSkge1xuICAgIHZhciBlbGVtZW50ID0gdGhpcy5jdXJyZW50Q29udGV4dC5hY3RpdmVFbGVtZW50O1xuICAgIGVsZW1lbnQuYmx1cigpO1xuXG4gICAgZG9uZShudWxsLCBlbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gX3Njcm9sbFRvKHZhbHVlLCB0eXBlLCBkb25lKXtcbiAgICBfZmluZEFsbFVpLmNhbGwodGhpcywgdmFsdWUsIHR5cGUsIGZ1bmN0aW9uKGVycm9yLCBlbGVtZW50cykge1xuICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGRvbmUoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIWVsZW1lbnRzLmxlbmd0aCl7XG4gICAgICAgICAgICByZXR1cm4gZG9uZShuZXcgRXJyb3IoJ1wiJyArIHZhbHVlICsgJ1wiIHdhcyBub3QgZm91bmQnKSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdGFyZ2V0RWxlbWVudCA9IGVsZW1lbnRzLnNoaWZ0KCk7XG5cbiAgICAgICAgc2Nyb2xsSW50b1ZpZXcodGFyZ2V0RWxlbWVudCwgeyB0aW1lOiA1MCB9LCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgZG9uZShudWxsLCB0YXJnZXRFbGVtZW50KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHJ1blRhc2tzKHN0YXRlLCB0YXNrcywgY2FsbGJhY2spIHtcbiAgICBpZih0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgdGFza3Muc2hpZnQoKShmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0YXRlLmxhc3RSZXN1bHQgPSByZXN1bHQ7XG5cbiAgICAgICAgICAgICAgICBpZih0YXNrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBydW5UYXNrcyhzdGF0ZSwgdGFza3MsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJpdmVVaShjdXJyZW50Q29udGV4dCl7XG4gICAgdmFyIHRhc2tzID0gW10sXG4gICAgICAgIGRyaXZlckZ1bmN0aW9ucyA9IHt9LFxuICAgICAgICBzdGF0ZSA9IHtcbiAgICAgICAgICAgIGN1cnJlbnRDb250ZXh0OiBjdXJyZW50Q29udGV4dCB8fCBkb2N1bWVudFNjb3BlXG4gICAgICAgIH07XG5cbiAgICBmdW5jdGlvbiBhZGRUYXNrKHRhc2spe1xuICAgICAgICB0YXNrcy5wdXNoKHRhc2spO1xuXG4gICAgICAgIHJldHVybiBkcml2ZXJGdW5jdGlvbnM7XG4gICAgfVxuXG4gICAgZHJpdmVyRnVuY3Rpb25zID0ge1xuICAgICAgICBuYXZpZ2F0ZTogZnVuY3Rpb24obG9jYXRpb24pe1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX25hdmlnYXRlLmJpbmQoc3RhdGUsIGxvY2F0aW9uKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGZpbmRVaTogZnVuY3Rpb24odmFsdWUsIHR5cGUpe1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX2ZpbmRVaS5iaW5kKHN0YXRlLCB2YWx1ZSwgdHlwZSkpO1xuICAgICAgICB9LFxuICAgICAgICBnZXRMb2NhdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhfZ2V0TG9jYXRpb24uYmluZChzdGF0ZSkpO1xuICAgICAgICB9LFxuICAgICAgICBmb2N1czogZnVuY3Rpb24odmFsdWUsIHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKF9mb2N1cy5iaW5kKHN0YXRlLCB2YWx1ZSwgdHlwZSkpO1xuICAgICAgICB9LFxuICAgICAgICBibHVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKF9ibHVyLmJpbmQoc3RhdGUpKTtcbiAgICAgICAgfSxcbiAgICAgICAgY2xpY2s6IGZ1bmN0aW9uKHZhbHVlLCB0eXBlKXtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKGV4ZWN1dGVDbGljay5iaW5kKHN0YXRlLCB2YWx1ZSwgdHlwZSkpO1xuICAgICAgICB9LFxuICAgICAgICBwcmVzc0tleTogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKF9wcmVzc0tleS5iaW5kKHN0YXRlLCB2YWx1ZSkpO1xuICAgICAgICB9LFxuICAgICAgICBwcmVzc0tleXM6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhfcHJlc3NLZXlzLmJpbmQoc3RhdGUsIHZhbHVlKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGNoYW5nZVZhbHVlOiBmdW5jdGlvbih2YWx1ZSwgdHlwZSwgdGV4dCkge1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX2NoYW5nZVZhbHVlLmJpbmQoc3RhdGUsIHZhbHVlLCB0eXBlLCB0ZXh0KSk7XG4gICAgICAgIH0sXG4gICAgICAgIHNldFZhbHVlOiBmdW5jdGlvbih2YWx1ZSwgdHlwZSwgdGV4dCkge1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX3NldFZhbHVlLmJpbmQoc3RhdGUsIHZhbHVlLCB0eXBlLCB0ZXh0KSk7XG4gICAgICAgIH0sXG4gICAgICAgIGdldFZhbHVlOiBmdW5jdGlvbih2YWx1ZSwgdHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX2dldFZhbHVlLmJpbmQoc3RhdGUsIHZhbHVlLCB0eXBlKSk7XG4gICAgICAgIH0sXG4gICAgICAgIHdhaXQ6IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgICAgICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGltZSA9IHJ1bkRlbGF5O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhfd2FpdC5iaW5kKHN0YXRlLCB0aW1lKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGRvOiBmdW5jdGlvbihkcml2ZXIpe1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soZHJpdmVyLmdvKTtcbiAgICAgICAgfSxcbiAgICAgICAgdGhlbjogZnVuY3Rpb24odGFzayl7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhfdGhlbi5iaW5kKHN0YXRlLCB0YXNrKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGluOiBmdW5jdGlvbih2YWx1ZSwgdHlwZSwgYWRkU3ViVGFza3Mpe1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soZnVuY3Rpb24oZG9uZSl7XG4gICAgICAgICAgICAgICAgX2ZpbmRVaS5jYWxsKHN0YXRlLCB2YWx1ZSwgdHlwZSwgZnVuY3Rpb24oZXJyb3IsIGVsZW1lbnQpe1xuICAgICAgICAgICAgICAgICAgICBpZihlcnJvcil7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZG9uZShlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB2YXIgbmV3RHJpdmVyID0gZHJpdmVVaShlbGVtZW50KTtcblxuICAgICAgICAgICAgICAgICAgICBhZGRTdWJUYXNrcyhuZXdEcml2ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIG5ld0RyaXZlci5nbyhkb25lKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBjaGVjazogZnVuY3Rpb24odGFzayl7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhmdW5jdGlvbihjYWxsYmFjayl7XG4gICAgICAgICAgICAgICAgdGFzayhzdGF0ZS5sYXN0UmVzdWx0LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2Nyb2xsVG86IGZ1bmN0aW9uKHZhbHVlLCB0eXBlKXtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKF9zY3JvbGxUby5iaW5kKHN0YXRlLCB2YWx1ZSwgdHlwZSkpO1xuICAgICAgICB9LFxuICAgICAgICBnbzogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmKCFpbml0aWFsaXNlZCkge1xuICAgICAgICAgICAgICAgIHRocm93KG5ldyBFcnJvcignaW5pdCBtdXN0IGJlY2FsbGVkIGJlZm9yZSBjYWxsaW5nIGdvJykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZih0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0YXNrcy51bnNoaWZ0KF93YWl0LmJpbmQoc3RhdGUsIHJ1bkRlbGF5KSk7XG4gICAgICAgICAgICAgICAgcnVuVGFza3Moc3RhdGUsIHRhc2tzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG5ldyBFcnJvcignTm8gdGFza3MgZGVmaW5lZCcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gZHJpdmVyRnVuY3Rpb25zO1xufVxuXG5kcml2ZVVpLmluaXQgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICAgIGRvY3VtZW50U2NvcGUgPSBzZXR0aW5ncy5kb2N1bWVudCB8fCBkb2N1bWVudDtcbiAgICB3aW5kb3dTY29wZSA9IHNldHRpbmdzLndpbmRvdyB8fCB3aW5kb3c7XG4gICAgcnVuRGVsYXkgPSBzZXR0aW5ncy5ydW5EZWxheSB8fCAwO1xuICAgIGNsaWNrRGVsYXkgPSBzZXR0aW5ncy5jbGlja0RlbGF5IHx8IDEwMDtcbiAgICBrZXlQcmVzc0RlbGF5ID0gc2V0dGluZ3Mua2V5UHJlc3NEZWxheSB8fCA1MDtcblxuICAgIGluaXRpYWxpc2VkID0gdHJ1ZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZHJpdmVVaTtcbiIsIiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuXG5mdW5jdGlvbiBpc0FycmF5KGFyZykge1xuICBpZiAoQXJyYXkuaXNBcnJheSkge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGFyZyk7XG4gIH1cbiAgcmV0dXJuIG9iamVjdFRvU3RyaW5nKGFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiAob2JqZWN0VG9TdHJpbmcoZSkgPT09ICdbb2JqZWN0IEVycm9yXScgfHwgZSBpbnN0YW5jZW9mIEVycm9yKTtcbn1cbmV4cG9ydHMuaXNFcnJvciA9IGlzRXJyb3I7XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcblxuZnVuY3Rpb24gaXNQcmltaXRpdmUoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGwgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3ltYm9sJyB8fCAgLy8gRVM2IHN5bWJvbFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3VuZGVmaW5lZCc7XG59XG5leHBvcnRzLmlzUHJpbWl0aXZlID0gaXNQcmltaXRpdmU7XG5cbmV4cG9ydHMuaXNCdWZmZXIgPSBCdWZmZXIuaXNCdWZmZXI7XG5cbmZ1bmN0aW9uIG9iamVjdFRvU3RyaW5nKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn1cbiIsInZhciBwU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgb2JqZWN0S2V5cyA9IHJlcXVpcmUoJy4vbGliL2tleXMuanMnKTtcbnZhciBpc0FyZ3VtZW50cyA9IHJlcXVpcmUoJy4vbGliL2lzX2FyZ3VtZW50cy5qcycpO1xuXG52YXIgZGVlcEVxdWFsID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3B0cykge1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fTtcbiAgLy8gNy4xLiBBbGwgaWRlbnRpY2FsIHZhbHVlcyBhcmUgZXF1aXZhbGVudCwgYXMgZGV0ZXJtaW5lZCBieSA9PT0uXG4gIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgfSBlbHNlIGlmIChhY3R1YWwgaW5zdGFuY2VvZiBEYXRlICYmIGV4cGVjdGVkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiBhY3R1YWwuZ2V0VGltZSgpID09PSBleHBlY3RlZC5nZXRUaW1lKCk7XG5cbiAgLy8gNy4zLiBPdGhlciBwYWlycyB0aGF0IGRvIG5vdCBib3RoIHBhc3MgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnLFxuICAvLyBlcXVpdmFsZW5jZSBpcyBkZXRlcm1pbmVkIGJ5ID09LlxuICB9IGVsc2UgaWYgKCFhY3R1YWwgfHwgIWV4cGVjdGVkIHx8IHR5cGVvZiBhY3R1YWwgIT0gJ29iamVjdCcgJiYgdHlwZW9mIGV4cGVjdGVkICE9ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG9wdHMuc3RyaWN0ID8gYWN0dWFsID09PSBleHBlY3RlZCA6IGFjdHVhbCA9PSBleHBlY3RlZDtcblxuICAvLyA3LjQuIEZvciBhbGwgb3RoZXIgT2JqZWN0IHBhaXJzLCBpbmNsdWRpbmcgQXJyYXkgb2JqZWN0cywgZXF1aXZhbGVuY2UgaXNcbiAgLy8gZGV0ZXJtaW5lZCBieSBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGFzIHZlcmlmaWVkXG4gIC8vIHdpdGggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKSwgdGhlIHNhbWUgc2V0IG9mIGtleXNcbiAgLy8gKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksIGVxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeVxuICAvLyBjb3JyZXNwb25kaW5nIGtleSwgYW5kIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS4gTm90ZTogdGhpc1xuICAvLyBhY2NvdW50cyBmb3IgYm90aCBuYW1lZCBhbmQgaW5kZXhlZCBwcm9wZXJ0aWVzIG9uIEFycmF5cy5cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb2JqRXF1aXYoYWN0dWFsLCBleHBlY3RlZCwgb3B0cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWRPck51bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyICh4KSB7XG4gIGlmICgheCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcgfHwgdHlwZW9mIHgubGVuZ3RoICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICBpZiAodHlwZW9mIHguY29weSAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgeC5zbGljZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoeC5sZW5ndGggPiAwICYmIHR5cGVvZiB4WzBdICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gb2JqRXF1aXYoYSwgYiwgb3B0cykge1xuICB2YXIgaSwga2V5O1xuICBpZiAoaXNVbmRlZmluZWRPck51bGwoYSkgfHwgaXNVbmRlZmluZWRPck51bGwoYikpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvLyBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuXG4gIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgLy9+fn5JJ3ZlIG1hbmFnZWQgdG8gYnJlYWsgT2JqZWN0LmtleXMgdGhyb3VnaCBzY3Jld3kgYXJndW1lbnRzIHBhc3NpbmcuXG4gIC8vICAgQ29udmVydGluZyB0byBhcnJheSBzb2x2ZXMgdGhlIHByb2JsZW0uXG4gIGlmIChpc0FyZ3VtZW50cyhhKSkge1xuICAgIGlmICghaXNBcmd1bWVudHMoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYSA9IHBTbGljZS5jYWxsKGEpO1xuICAgIGIgPSBwU2xpY2UuY2FsbChiKTtcbiAgICByZXR1cm4gZGVlcEVxdWFsKGEsIGIsIG9wdHMpO1xuICB9XG4gIGlmIChpc0J1ZmZlcihhKSkge1xuICAgIGlmICghaXNCdWZmZXIoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB0cnkge1xuICAgIHZhciBrYSA9IG9iamVjdEtleXMoYSksXG4gICAgICAgIGtiID0gb2JqZWN0S2V5cyhiKTtcbiAgfSBjYXRjaCAoZSkgey8vaGFwcGVucyB3aGVuIG9uZSBpcyBhIHN0cmluZyBsaXRlcmFsIGFuZCB0aGUgb3RoZXIgaXNuJ3RcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlc1xuICAvLyBoYXNPd25Qcm9wZXJ0eSlcbiAgaWYgKGthLmxlbmd0aCAhPSBrYi5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcbiAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChrYVtpXSAhPSBrYltpXSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvL2VxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeSBjb3JyZXNwb25kaW5nIGtleSwgYW5kXG4gIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGtleSA9IGthW2ldO1xuICAgIGlmICghZGVlcEVxdWFsKGFba2V5XSwgYltrZXldLCBvcHRzKSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gdHlwZW9mIGI7XG59XG4iLCJ2YXIgc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA9IChmdW5jdGlvbigpe1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50cylcbn0pKCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPyBzdXBwb3J0ZWQgOiB1bnN1cHBvcnRlZDtcblxuZXhwb3J0cy5zdXBwb3J0ZWQgPSBzdXBwb3J0ZWQ7XG5mdW5jdGlvbiBzdXBwb3J0ZWQob2JqZWN0KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcbn07XG5cbmV4cG9ydHMudW5zdXBwb3J0ZWQgPSB1bnN1cHBvcnRlZDtcbmZ1bmN0aW9uIHVuc3VwcG9ydGVkKG9iamVjdCl7XG4gIHJldHVybiBvYmplY3QgJiZcbiAgICB0eXBlb2Ygb2JqZWN0ID09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIG9iamVjdC5sZW5ndGggPT0gJ251bWJlcicgJiZcbiAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCAnY2FsbGVlJykgJiZcbiAgICAhT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpIHx8XG4gICAgZmFsc2U7XG59O1xuIiwiZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gdHlwZW9mIE9iamVjdC5rZXlzID09PSAnZnVuY3Rpb24nXG4gID8gT2JqZWN0LmtleXMgOiBzaGltO1xuXG5leHBvcnRzLnNoaW0gPSBzaGltO1xuZnVuY3Rpb24gc2hpbSAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIGtleXMucHVzaChrZXkpO1xuICByZXR1cm4ga2V5cztcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGtleXMgPSByZXF1aXJlKCdvYmplY3Qta2V5cycpO1xudmFyIGhhc1N5bWJvbHMgPSB0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBTeW1ib2woJ2ZvbycpID09PSAnc3ltYm9sJztcblxudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciBjb25jYXQgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0O1xudmFyIG9yaWdEZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eTtcblxudmFyIGlzRnVuY3Rpb24gPSBmdW5jdGlvbiAoZm4pIHtcblx0cmV0dXJuIHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyAmJiB0b1N0ci5jYWxsKGZuKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn07XG5cbnZhciBhcmVQcm9wZXJ0eURlc2NyaXB0b3JzU3VwcG9ydGVkID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgb2JqID0ge307XG5cdHRyeSB7XG5cdFx0b3JpZ0RlZmluZVByb3BlcnR5KG9iaiwgJ3gnLCB7IGVudW1lcmFibGU6IGZhbHNlLCB2YWx1ZTogb2JqIH0pO1xuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycywgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0XHRmb3IgKHZhciBfIGluIG9iaikgeyAvLyBqc2NzOmlnbm9yZSBkaXNhbGxvd1VudXNlZFZhcmlhYmxlc1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gb2JqLnggPT09IG9iajtcblx0fSBjYXRjaCAoZSkgeyAvKiB0aGlzIGlzIElFIDguICovXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xudmFyIHN1cHBvcnRzRGVzY3JpcHRvcnMgPSBvcmlnRGVmaW5lUHJvcGVydHkgJiYgYXJlUHJvcGVydHlEZXNjcmlwdG9yc1N1cHBvcnRlZCgpO1xuXG52YXIgZGVmaW5lUHJvcGVydHkgPSBmdW5jdGlvbiAob2JqZWN0LCBuYW1lLCB2YWx1ZSwgcHJlZGljYXRlKSB7XG5cdGlmIChuYW1lIGluIG9iamVjdCAmJiAoIWlzRnVuY3Rpb24ocHJlZGljYXRlKSB8fCAhcHJlZGljYXRlKCkpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGlmIChzdXBwb3J0c0Rlc2NyaXB0b3JzKSB7XG5cdFx0b3JpZ0RlZmluZVByb3BlcnR5KG9iamVjdCwgbmFtZSwge1xuXHRcdFx0Y29uZmlndXJhYmxlOiB0cnVlLFxuXHRcdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdFx0XHR2YWx1ZTogdmFsdWUsXG5cdFx0XHR3cml0YWJsZTogdHJ1ZVxuXHRcdH0pO1xuXHR9IGVsc2Uge1xuXHRcdG9iamVjdFtuYW1lXSA9IHZhbHVlO1xuXHR9XG59O1xuXG52YXIgZGVmaW5lUHJvcGVydGllcyA9IGZ1bmN0aW9uIChvYmplY3QsIG1hcCkge1xuXHR2YXIgcHJlZGljYXRlcyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyID8gYXJndW1lbnRzWzJdIDoge307XG5cdHZhciBwcm9wcyA9IGtleXMobWFwKTtcblx0aWYgKGhhc1N5bWJvbHMpIHtcblx0XHRwcm9wcyA9IGNvbmNhdC5jYWxsKHByb3BzLCBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKG1hcCkpO1xuXHR9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpICs9IDEpIHtcblx0XHRkZWZpbmVQcm9wZXJ0eShvYmplY3QsIHByb3BzW2ldLCBtYXBbcHJvcHNbaV1dLCBwcmVkaWNhdGVzW3Byb3BzW2ldXSk7XG5cdH1cbn07XG5cbmRlZmluZVByb3BlcnRpZXMuc3VwcG9ydHNEZXNjcmlwdG9ycyA9ICEhc3VwcG9ydHNEZXNjcmlwdG9ycztcblxubW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVQcm9wZXJ0aWVzO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50c1tpXSAhPT0gdW5kZWZpbmVkKSByZXR1cm4gYXJndW1lbnRzW2ldO1xuICAgIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qIGdsb2JhbHNcblx0U2V0LFxuXHRNYXAsXG5cdFdlYWtTZXQsXG5cdFdlYWtNYXAsXG5cblx0UHJvbWlzZSxcblxuXHRTeW1ib2wsXG5cdFByb3h5LFxuXG5cdEF0b21pY3MsXG5cdFNoYXJlZEFycmF5QnVmZmVyLFxuXG5cdEFycmF5QnVmZmVyLFxuXHREYXRhVmlldyxcblx0VWludDhBcnJheSxcblx0RmxvYXQzMkFycmF5LFxuXHRGbG9hdDY0QXJyYXksXG5cdEludDhBcnJheSxcblx0SW50MTZBcnJheSxcblx0SW50MzJBcnJheSxcblx0VWludDhDbGFtcGVkQXJyYXksXG5cdFVpbnQxNkFycmF5LFxuXHRVaW50MzJBcnJheSxcbiovXG5cbnZhciB1bmRlZmluZWQ7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tc2hhZG93LXJlc3RyaWN0ZWQtbmFtZXNcblxudmFyIFRocm93VHlwZUVycm9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvclxuXHQ/IChmdW5jdGlvbiAoKSB7IHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGFyZ3VtZW50cywgJ2NhbGxlZScpLmdldDsgfSgpKVxuXHQ6IGZ1bmN0aW9uICgpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcigpOyB9O1xuXG52YXIgaGFzU3ltYm9scyA9IHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gJ3N5bWJvbCc7XG5cbnZhciBnZXRQcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZiB8fCBmdW5jdGlvbiAoeCkgeyByZXR1cm4geC5fX3Byb3RvX187IH07IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tcHJvdG9cblxudmFyIGdlbmVyYXRvcjsgLy8gPSBmdW5jdGlvbiAqICgpIHt9O1xudmFyIGdlbmVyYXRvckZ1bmN0aW9uID0gZ2VuZXJhdG9yID8gZ2V0UHJvdG8oZ2VuZXJhdG9yKSA6IHVuZGVmaW5lZDtcbnZhciBhc3luY0ZuOyAvLyBhc3luYyBmdW5jdGlvbigpIHt9O1xudmFyIGFzeW5jRnVuY3Rpb24gPSBhc3luY0ZuID8gYXN5bmNGbi5jb25zdHJ1Y3RvciA6IHVuZGVmaW5lZDtcbnZhciBhc3luY0dlbjsgLy8gYXN5bmMgZnVuY3Rpb24gKiAoKSB7fTtcbnZhciBhc3luY0dlbkZ1bmN0aW9uID0gYXN5bmNHZW4gPyBnZXRQcm90byhhc3luY0dlbikgOiB1bmRlZmluZWQ7XG52YXIgYXN5bmNHZW5JdGVyYXRvciA9IGFzeW5jR2VuID8gYXN5bmNHZW4oKSA6IHVuZGVmaW5lZDtcblxudmFyIFR5cGVkQXJyYXkgPSB0eXBlb2YgVWludDhBcnJheSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBnZXRQcm90byhVaW50OEFycmF5KTtcblxudmFyIElOVFJJTlNJQ1MgPSB7XG5cdCckICVBcnJheSUnOiBBcnJheSxcblx0JyQgJUFycmF5QnVmZmVyJSc6IHR5cGVvZiBBcnJheUJ1ZmZlciA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBBcnJheUJ1ZmZlcixcblx0JyQgJUFycmF5QnVmZmVyUHJvdG90eXBlJSc6IHR5cGVvZiBBcnJheUJ1ZmZlciA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBBcnJheUJ1ZmZlci5wcm90b3R5cGUsXG5cdCckICVBcnJheUl0ZXJhdG9yUHJvdG90eXBlJSc6IGhhc1N5bWJvbHMgPyBnZXRQcm90byhbXVtTeW1ib2wuaXRlcmF0b3JdKCkpIDogdW5kZWZpbmVkLFxuXHQnJCAlQXJyYXlQcm90b3R5cGUlJzogQXJyYXkucHJvdG90eXBlLFxuXHQnJCAlQXJyYXlQcm90b19lbnRyaWVzJSc6IEFycmF5LnByb3RvdHlwZS5lbnRyaWVzLFxuXHQnJCAlQXJyYXlQcm90b19mb3JFYWNoJSc6IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLFxuXHQnJCAlQXJyYXlQcm90b19rZXlzJSc6IEFycmF5LnByb3RvdHlwZS5rZXlzLFxuXHQnJCAlQXJyYXlQcm90b192YWx1ZXMlJzogQXJyYXkucHJvdG90eXBlLnZhbHVlcyxcblx0JyQgJUFzeW5jRnJvbVN5bmNJdGVyYXRvclByb3RvdHlwZSUnOiB1bmRlZmluZWQsXG5cdCckICVBc3luY0Z1bmN0aW9uJSc6IGFzeW5jRnVuY3Rpb24sXG5cdCckICVBc3luY0Z1bmN0aW9uUHJvdG90eXBlJSc6IGFzeW5jRnVuY3Rpb24gPyBhc3luY0Z1bmN0aW9uLnByb3RvdHlwZSA6IHVuZGVmaW5lZCxcblx0JyQgJUFzeW5jR2VuZXJhdG9yJSc6IGFzeW5jR2VuID8gZ2V0UHJvdG8oYXN5bmNHZW5JdGVyYXRvcikgOiB1bmRlZmluZWQsXG5cdCckICVBc3luY0dlbmVyYXRvckZ1bmN0aW9uJSc6IGFzeW5jR2VuRnVuY3Rpb24sXG5cdCckICVBc3luY0dlbmVyYXRvclByb3RvdHlwZSUnOiBhc3luY0dlbkZ1bmN0aW9uID8gYXN5bmNHZW5GdW5jdGlvbi5wcm90b3R5cGUgOiB1bmRlZmluZWQsXG5cdCckICVBc3luY0l0ZXJhdG9yUHJvdG90eXBlJSc6IGFzeW5jR2VuSXRlcmF0b3IgJiYgaGFzU3ltYm9scyAmJiBTeW1ib2wuYXN5bmNJdGVyYXRvciA/IGFzeW5jR2VuSXRlcmF0b3JbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkgOiB1bmRlZmluZWQsXG5cdCckICVBdG9taWNzJSc6IHR5cGVvZiBBdG9taWNzID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEF0b21pY3MsXG5cdCckICVCb29sZWFuJSc6IEJvb2xlYW4sXG5cdCckICVCb29sZWFuUHJvdG90eXBlJSc6IEJvb2xlYW4ucHJvdG90eXBlLFxuXHQnJCAlRGF0YVZpZXclJzogdHlwZW9mIERhdGFWaWV3ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IERhdGFWaWV3LFxuXHQnJCAlRGF0YVZpZXdQcm90b3R5cGUlJzogdHlwZW9mIERhdGFWaWV3ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IERhdGFWaWV3LnByb3RvdHlwZSxcblx0JyQgJURhdGUlJzogRGF0ZSxcblx0JyQgJURhdGVQcm90b3R5cGUlJzogRGF0ZS5wcm90b3R5cGUsXG5cdCckICVkZWNvZGVVUkklJzogZGVjb2RlVVJJLFxuXHQnJCAlZGVjb2RlVVJJQ29tcG9uZW50JSc6IGRlY29kZVVSSUNvbXBvbmVudCxcblx0JyQgJWVuY29kZVVSSSUnOiBlbmNvZGVVUkksXG5cdCckICVlbmNvZGVVUklDb21wb25lbnQlJzogZW5jb2RlVVJJQ29tcG9uZW50LFxuXHQnJCAlRXJyb3IlJzogRXJyb3IsXG5cdCckICVFcnJvclByb3RvdHlwZSUnOiBFcnJvci5wcm90b3R5cGUsXG5cdCckICVldmFsJSc6IGV2YWwsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZXZhbFxuXHQnJCAlRXZhbEVycm9yJSc6IEV2YWxFcnJvcixcblx0JyQgJUV2YWxFcnJvclByb3RvdHlwZSUnOiBFdmFsRXJyb3IucHJvdG90eXBlLFxuXHQnJCAlRmxvYXQzMkFycmF5JSc6IHR5cGVvZiBGbG9hdDMyQXJyYXkgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogRmxvYXQzMkFycmF5LFxuXHQnJCAlRmxvYXQzMkFycmF5UHJvdG90eXBlJSc6IHR5cGVvZiBGbG9hdDMyQXJyYXkgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogRmxvYXQzMkFycmF5LnByb3RvdHlwZSxcblx0JyQgJUZsb2F0NjRBcnJheSUnOiB0eXBlb2YgRmxvYXQ2NEFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEZsb2F0NjRBcnJheSxcblx0JyQgJUZsb2F0NjRBcnJheVByb3RvdHlwZSUnOiB0eXBlb2YgRmxvYXQ2NEFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEZsb2F0NjRBcnJheS5wcm90b3R5cGUsXG5cdCckICVGdW5jdGlvbiUnOiBGdW5jdGlvbixcblx0JyQgJUZ1bmN0aW9uUHJvdG90eXBlJSc6IEZ1bmN0aW9uLnByb3RvdHlwZSxcblx0JyQgJUdlbmVyYXRvciUnOiBnZW5lcmF0b3IgPyBnZXRQcm90byhnZW5lcmF0b3IoKSkgOiB1bmRlZmluZWQsXG5cdCckICVHZW5lcmF0b3JGdW5jdGlvbiUnOiBnZW5lcmF0b3JGdW5jdGlvbixcblx0JyQgJUdlbmVyYXRvclByb3RvdHlwZSUnOiBnZW5lcmF0b3JGdW5jdGlvbiA/IGdlbmVyYXRvckZ1bmN0aW9uLnByb3RvdHlwZSA6IHVuZGVmaW5lZCxcblx0JyQgJUludDhBcnJheSUnOiB0eXBlb2YgSW50OEFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEludDhBcnJheSxcblx0JyQgJUludDhBcnJheVByb3RvdHlwZSUnOiB0eXBlb2YgSW50OEFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEludDhBcnJheS5wcm90b3R5cGUsXG5cdCckICVJbnQxNkFycmF5JSc6IHR5cGVvZiBJbnQxNkFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEludDE2QXJyYXksXG5cdCckICVJbnQxNkFycmF5UHJvdG90eXBlJSc6IHR5cGVvZiBJbnQxNkFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEludDhBcnJheS5wcm90b3R5cGUsXG5cdCckICVJbnQzMkFycmF5JSc6IHR5cGVvZiBJbnQzMkFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEludDMyQXJyYXksXG5cdCckICVJbnQzMkFycmF5UHJvdG90eXBlJSc6IHR5cGVvZiBJbnQzMkFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IEludDMyQXJyYXkucHJvdG90eXBlLFxuXHQnJCAlaXNGaW5pdGUlJzogaXNGaW5pdGUsXG5cdCckICVpc05hTiUnOiBpc05hTixcblx0JyQgJUl0ZXJhdG9yUHJvdG90eXBlJSc6IGhhc1N5bWJvbHMgPyBnZXRQcm90byhnZXRQcm90byhbXVtTeW1ib2wuaXRlcmF0b3JdKCkpKSA6IHVuZGVmaW5lZCxcblx0JyQgJUpTT04lJzogSlNPTixcblx0JyQgJUpTT05QYXJzZSUnOiBKU09OLnBhcnNlLFxuXHQnJCAlTWFwJSc6IHR5cGVvZiBNYXAgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogTWFwLFxuXHQnJCAlTWFwSXRlcmF0b3JQcm90b3R5cGUlJzogdHlwZW9mIE1hcCA9PT0gJ3VuZGVmaW5lZCcgfHwgIWhhc1N5bWJvbHMgPyB1bmRlZmluZWQgOiBnZXRQcm90byhuZXcgTWFwKClbU3ltYm9sLml0ZXJhdG9yXSgpKSxcblx0JyQgJU1hcFByb3RvdHlwZSUnOiB0eXBlb2YgTWFwID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IE1hcC5wcm90b3R5cGUsXG5cdCckICVNYXRoJSc6IE1hdGgsXG5cdCckICVOdW1iZXIlJzogTnVtYmVyLFxuXHQnJCAlTnVtYmVyUHJvdG90eXBlJSc6IE51bWJlci5wcm90b3R5cGUsXG5cdCckICVPYmplY3QlJzogT2JqZWN0LFxuXHQnJCAlT2JqZWN0UHJvdG90eXBlJSc6IE9iamVjdC5wcm90b3R5cGUsXG5cdCckICVPYmpQcm90b190b1N0cmluZyUnOiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuXHQnJCAlT2JqUHJvdG9fdmFsdWVPZiUnOiBPYmplY3QucHJvdG90eXBlLnZhbHVlT2YsXG5cdCckICVwYXJzZUZsb2F0JSc6IHBhcnNlRmxvYXQsXG5cdCckICVwYXJzZUludCUnOiBwYXJzZUludCxcblx0JyQgJVByb21pc2UlJzogdHlwZW9mIFByb21pc2UgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogUHJvbWlzZSxcblx0JyQgJVByb21pc2VQcm90b3R5cGUlJzogdHlwZW9mIFByb21pc2UgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogUHJvbWlzZS5wcm90b3R5cGUsXG5cdCckICVQcm9taXNlUHJvdG9fdGhlbiUnOiB0eXBlb2YgUHJvbWlzZSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBQcm9taXNlLnByb3RvdHlwZS50aGVuLFxuXHQnJCAlUHJvbWlzZV9hbGwlJzogdHlwZW9mIFByb21pc2UgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogUHJvbWlzZS5hbGwsXG5cdCckICVQcm9taXNlX3JlamVjdCUnOiB0eXBlb2YgUHJvbWlzZSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBQcm9taXNlLnJlamVjdCxcblx0JyQgJVByb21pc2VfcmVzb2x2ZSUnOiB0eXBlb2YgUHJvbWlzZSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBQcm9taXNlLnJlc29sdmUsXG5cdCckICVQcm94eSUnOiB0eXBlb2YgUHJveHkgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogUHJveHksXG5cdCckICVSYW5nZUVycm9yJSc6IFJhbmdlRXJyb3IsXG5cdCckICVSYW5nZUVycm9yUHJvdG90eXBlJSc6IFJhbmdlRXJyb3IucHJvdG90eXBlLFxuXHQnJCAlUmVmZXJlbmNlRXJyb3IlJzogUmVmZXJlbmNlRXJyb3IsXG5cdCckICVSZWZlcmVuY2VFcnJvclByb3RvdHlwZSUnOiBSZWZlcmVuY2VFcnJvci5wcm90b3R5cGUsXG5cdCckICVSZWZsZWN0JSc6IHR5cGVvZiBSZWZsZWN0ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IFJlZmxlY3QsXG5cdCckICVSZWdFeHAlJzogUmVnRXhwLFxuXHQnJCAlUmVnRXhwUHJvdG90eXBlJSc6IFJlZ0V4cC5wcm90b3R5cGUsXG5cdCckICVTZXQlJzogdHlwZW9mIFNldCA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBTZXQsXG5cdCckICVTZXRJdGVyYXRvclByb3RvdHlwZSUnOiB0eXBlb2YgU2V0ID09PSAndW5kZWZpbmVkJyB8fCAhaGFzU3ltYm9scyA/IHVuZGVmaW5lZCA6IGdldFByb3RvKG5ldyBTZXQoKVtTeW1ib2wuaXRlcmF0b3JdKCkpLFxuXHQnJCAlU2V0UHJvdG90eXBlJSc6IHR5cGVvZiBTZXQgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogU2V0LnByb3RvdHlwZSxcblx0JyQgJVNoYXJlZEFycmF5QnVmZmVyJSc6IHR5cGVvZiBTaGFyZWRBcnJheUJ1ZmZlciA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBTaGFyZWRBcnJheUJ1ZmZlcixcblx0JyQgJVNoYXJlZEFycmF5QnVmZmVyUHJvdG90eXBlJSc6IHR5cGVvZiBTaGFyZWRBcnJheUJ1ZmZlciA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBTaGFyZWRBcnJheUJ1ZmZlci5wcm90b3R5cGUsXG5cdCckICVTdHJpbmclJzogU3RyaW5nLFxuXHQnJCAlU3RyaW5nSXRlcmF0b3JQcm90b3R5cGUlJzogaGFzU3ltYm9scyA/IGdldFByb3RvKCcnW1N5bWJvbC5pdGVyYXRvcl0oKSkgOiB1bmRlZmluZWQsXG5cdCckICVTdHJpbmdQcm90b3R5cGUlJzogU3RyaW5nLnByb3RvdHlwZSxcblx0JyQgJVN5bWJvbCUnOiBoYXNTeW1ib2xzID8gU3ltYm9sIDogdW5kZWZpbmVkLFxuXHQnJCAlU3ltYm9sUHJvdG90eXBlJSc6IGhhc1N5bWJvbHMgPyBTeW1ib2wucHJvdG90eXBlIDogdW5kZWZpbmVkLFxuXHQnJCAlU3ludGF4RXJyb3IlJzogU3ludGF4RXJyb3IsXG5cdCckICVTeW50YXhFcnJvclByb3RvdHlwZSUnOiBTeW50YXhFcnJvci5wcm90b3R5cGUsXG5cdCckICVUaHJvd1R5cGVFcnJvciUnOiBUaHJvd1R5cGVFcnJvcixcblx0JyQgJVR5cGVkQXJyYXklJzogVHlwZWRBcnJheSxcblx0JyQgJVR5cGVkQXJyYXlQcm90b3R5cGUlJzogVHlwZWRBcnJheSA/IFR5cGVkQXJyYXkucHJvdG90eXBlIDogdW5kZWZpbmVkLFxuXHQnJCAlVHlwZUVycm9yJSc6IFR5cGVFcnJvcixcblx0JyQgJVR5cGVFcnJvclByb3RvdHlwZSUnOiBUeXBlRXJyb3IucHJvdG90eXBlLFxuXHQnJCAlVWludDhBcnJheSUnOiB0eXBlb2YgVWludDhBcnJheSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBVaW50OEFycmF5LFxuXHQnJCAlVWludDhBcnJheVByb3RvdHlwZSUnOiB0eXBlb2YgVWludDhBcnJheSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBVaW50OEFycmF5LnByb3RvdHlwZSxcblx0JyQgJVVpbnQ4Q2xhbXBlZEFycmF5JSc6IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBVaW50OENsYW1wZWRBcnJheSxcblx0JyQgJVVpbnQ4Q2xhbXBlZEFycmF5UHJvdG90eXBlJSc6IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBVaW50OENsYW1wZWRBcnJheS5wcm90b3R5cGUsXG5cdCckICVVaW50MTZBcnJheSUnOiB0eXBlb2YgVWludDE2QXJyYXkgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogVWludDE2QXJyYXksXG5cdCckICVVaW50MTZBcnJheVByb3RvdHlwZSUnOiB0eXBlb2YgVWludDE2QXJyYXkgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogVWludDE2QXJyYXkucHJvdG90eXBlLFxuXHQnJCAlVWludDMyQXJyYXklJzogdHlwZW9mIFVpbnQzMkFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IFVpbnQzMkFycmF5LFxuXHQnJCAlVWludDMyQXJyYXlQcm90b3R5cGUlJzogdHlwZW9mIFVpbnQzMkFycmF5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IFVpbnQzMkFycmF5LnByb3RvdHlwZSxcblx0JyQgJVVSSUVycm9yJSc6IFVSSUVycm9yLFxuXHQnJCAlVVJJRXJyb3JQcm90b3R5cGUlJzogVVJJRXJyb3IucHJvdG90eXBlLFxuXHQnJCAlV2Vha01hcCUnOiB0eXBlb2YgV2Vha01hcCA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBXZWFrTWFwLFxuXHQnJCAlV2Vha01hcFByb3RvdHlwZSUnOiB0eXBlb2YgV2Vha01hcCA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBXZWFrTWFwLnByb3RvdHlwZSxcblx0JyQgJVdlYWtTZXQlJzogdHlwZW9mIFdlYWtTZXQgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogV2Vha1NldCxcblx0JyQgJVdlYWtTZXRQcm90b3R5cGUlJzogdHlwZW9mIFdlYWtTZXQgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogV2Vha1NldC5wcm90b3R5cGVcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gR2V0SW50cmluc2ljKG5hbWUsIGFsbG93TWlzc2luZykge1xuXHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEgJiYgdHlwZW9mIGFsbG93TWlzc2luZyAhPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignXCJhbGxvd01pc3NpbmdcIiBhcmd1bWVudCBtdXN0IGJlIGEgYm9vbGVhbicpO1xuXHR9XG5cblx0dmFyIGtleSA9ICckICcgKyBuYW1lO1xuXHRpZiAoIShrZXkgaW4gSU5UUklOU0lDUykpIHtcblx0XHR0aHJvdyBuZXcgU3ludGF4RXJyb3IoJ2ludHJpbnNpYyAnICsgbmFtZSArICcgZG9lcyBub3QgZXhpc3QhJyk7XG5cdH1cblxuXHQvLyBpc3RhbmJ1bCBpZ25vcmUgaWYgLy8gaG9wZWZ1bGx5IHRoaXMgaXMgaW1wb3NzaWJsZSB0byB0ZXN0IDotKVxuXHRpZiAodHlwZW9mIElOVFJJTlNJQ1Nba2V5XSA9PT0gJ3VuZGVmaW5lZCcgJiYgIWFsbG93TWlzc2luZykge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2ludHJpbnNpYyAnICsgbmFtZSArICcgZXhpc3RzLCBidXQgaXMgbm90IGF2YWlsYWJsZS4gUGxlYXNlIGZpbGUgYW4gaXNzdWUhJyk7XG5cdH1cblx0cmV0dXJuIElOVFJJTlNJQ1Nba2V5XTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBHZXRJbnRyaW5zaWMgPSByZXF1aXJlKCcuL0dldEludHJpbnNpYycpO1xuXG52YXIgJE9iamVjdCA9IEdldEludHJpbnNpYygnJU9iamVjdCUnKTtcbnZhciAkVHlwZUVycm9yID0gR2V0SW50cmluc2ljKCclVHlwZUVycm9yJScpO1xudmFyICRTdHJpbmcgPSBHZXRJbnRyaW5zaWMoJyVTdHJpbmclJyk7XG5cbnZhciBhc3NlcnRSZWNvcmQgPSByZXF1aXJlKCcuL2hlbHBlcnMvYXNzZXJ0UmVjb3JkJyk7XG52YXIgJGlzTmFOID0gcmVxdWlyZSgnLi9oZWxwZXJzL2lzTmFOJyk7XG52YXIgJGlzRmluaXRlID0gcmVxdWlyZSgnLi9oZWxwZXJzL2lzRmluaXRlJyk7XG5cbnZhciBzaWduID0gcmVxdWlyZSgnLi9oZWxwZXJzL3NpZ24nKTtcbnZhciBtb2QgPSByZXF1aXJlKCcuL2hlbHBlcnMvbW9kJyk7XG5cbnZhciBJc0NhbGxhYmxlID0gcmVxdWlyZSgnaXMtY2FsbGFibGUnKTtcbnZhciB0b1ByaW1pdGl2ZSA9IHJlcXVpcmUoJ2VzLXRvLXByaW1pdGl2ZS9lczUnKTtcblxudmFyIGhhcyA9IHJlcXVpcmUoJ2hhcycpO1xuXG4vLyBodHRwczovL2VzNS5naXRodWIuaW8vI3g5XG52YXIgRVM1ID0ge1xuXHRUb1ByaW1pdGl2ZTogdG9QcmltaXRpdmUsXG5cblx0VG9Cb29sZWFuOiBmdW5jdGlvbiBUb0Jvb2xlYW4odmFsdWUpIHtcblx0XHRyZXR1cm4gISF2YWx1ZTtcblx0fSxcblx0VG9OdW1iZXI6IGZ1bmN0aW9uIFRvTnVtYmVyKHZhbHVlKSB7XG5cdFx0cmV0dXJuICt2YWx1ZTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1pbXBsaWNpdC1jb2VyY2lvblxuXHR9LFxuXHRUb0ludGVnZXI6IGZ1bmN0aW9uIFRvSW50ZWdlcih2YWx1ZSkge1xuXHRcdHZhciBudW1iZXIgPSB0aGlzLlRvTnVtYmVyKHZhbHVlKTtcblx0XHRpZiAoJGlzTmFOKG51bWJlcikpIHsgcmV0dXJuIDA7IH1cblx0XHRpZiAobnVtYmVyID09PSAwIHx8ICEkaXNGaW5pdGUobnVtYmVyKSkgeyByZXR1cm4gbnVtYmVyOyB9XG5cdFx0cmV0dXJuIHNpZ24obnVtYmVyKSAqIE1hdGguZmxvb3IoTWF0aC5hYnMobnVtYmVyKSk7XG5cdH0sXG5cdFRvSW50MzI6IGZ1bmN0aW9uIFRvSW50MzIoeCkge1xuXHRcdHJldHVybiB0aGlzLlRvTnVtYmVyKHgpID4+IDA7XG5cdH0sXG5cdFRvVWludDMyOiBmdW5jdGlvbiBUb1VpbnQzMih4KSB7XG5cdFx0cmV0dXJuIHRoaXMuVG9OdW1iZXIoeCkgPj4+IDA7XG5cdH0sXG5cdFRvVWludDE2OiBmdW5jdGlvbiBUb1VpbnQxNih2YWx1ZSkge1xuXHRcdHZhciBudW1iZXIgPSB0aGlzLlRvTnVtYmVyKHZhbHVlKTtcblx0XHRpZiAoJGlzTmFOKG51bWJlcikgfHwgbnVtYmVyID09PSAwIHx8ICEkaXNGaW5pdGUobnVtYmVyKSkgeyByZXR1cm4gMDsgfVxuXHRcdHZhciBwb3NJbnQgPSBzaWduKG51bWJlcikgKiBNYXRoLmZsb29yKE1hdGguYWJzKG51bWJlcikpO1xuXHRcdHJldHVybiBtb2QocG9zSW50LCAweDEwMDAwKTtcblx0fSxcblx0VG9TdHJpbmc6IGZ1bmN0aW9uIFRvU3RyaW5nKHZhbHVlKSB7XG5cdFx0cmV0dXJuICRTdHJpbmcodmFsdWUpO1xuXHR9LFxuXHRUb09iamVjdDogZnVuY3Rpb24gVG9PYmplY3QodmFsdWUpIHtcblx0XHR0aGlzLkNoZWNrT2JqZWN0Q29lcmNpYmxlKHZhbHVlKTtcblx0XHRyZXR1cm4gJE9iamVjdCh2YWx1ZSk7XG5cdH0sXG5cdENoZWNrT2JqZWN0Q29lcmNpYmxlOiBmdW5jdGlvbiBDaGVja09iamVjdENvZXJjaWJsZSh2YWx1ZSwgb3B0TWVzc2FnZSkge1xuXHRcdC8qIGpzaGludCBlcW51bGw6dHJ1ZSAqL1xuXHRcdGlmICh2YWx1ZSA9PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBuZXcgJFR5cGVFcnJvcihvcHRNZXNzYWdlIHx8ICdDYW5ub3QgY2FsbCBtZXRob2Qgb24gJyArIHZhbHVlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9LFxuXHRJc0NhbGxhYmxlOiBJc0NhbGxhYmxlLFxuXHRTYW1lVmFsdWU6IGZ1bmN0aW9uIFNhbWVWYWx1ZSh4LCB5KSB7XG5cdFx0aWYgKHggPT09IHkpIHsgLy8gMCA9PT0gLTAsIGJ1dCB0aGV5IGFyZSBub3QgaWRlbnRpY2FsLlxuXHRcdFx0aWYgKHggPT09IDApIHsgcmV0dXJuIDEgLyB4ID09PSAxIC8geTsgfVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiAkaXNOYU4oeCkgJiYgJGlzTmFOKHkpO1xuXHR9LFxuXG5cdC8vIGh0dHBzOi8vd3d3LmVjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNS4xLyNzZWMtOFxuXHRUeXBlOiBmdW5jdGlvbiBUeXBlKHgpIHtcblx0XHRpZiAoeCA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuICdOdWxsJztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiB4ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuICdVbmRlZmluZWQnO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIHggPT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHggPT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gJ09iamVjdCc7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgeCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiAnTnVtYmVyJztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiB4ID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHJldHVybiAnQm9vbGVhbic7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgeCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiAnU3RyaW5nJztcblx0XHR9XG5cdH0sXG5cblx0Ly8gaHR0cHM6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXByb3BlcnR5LWRlc2NyaXB0b3Itc3BlY2lmaWNhdGlvbi10eXBlXG5cdElzUHJvcGVydHlEZXNjcmlwdG9yOiBmdW5jdGlvbiBJc1Byb3BlcnR5RGVzY3JpcHRvcihEZXNjKSB7XG5cdFx0aWYgKHRoaXMuVHlwZShEZXNjKSAhPT0gJ09iamVjdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dmFyIGFsbG93ZWQgPSB7XG5cdFx0XHQnW1tDb25maWd1cmFibGVdXSc6IHRydWUsXG5cdFx0XHQnW1tFbnVtZXJhYmxlXV0nOiB0cnVlLFxuXHRcdFx0J1tbR2V0XV0nOiB0cnVlLFxuXHRcdFx0J1tbU2V0XV0nOiB0cnVlLFxuXHRcdFx0J1tbVmFsdWVdXSc6IHRydWUsXG5cdFx0XHQnW1tXcml0YWJsZV1dJzogdHJ1ZVxuXHRcdH07XG5cblx0XHRmb3IgKHZhciBrZXkgaW4gRGVzYykgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cdFx0XHRpZiAoaGFzKERlc2MsIGtleSkgJiYgIWFsbG93ZWRba2V5XSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dmFyIGlzRGF0YSA9IGhhcyhEZXNjLCAnW1tWYWx1ZV1dJyk7XG5cdFx0dmFyIElzQWNjZXNzb3IgPSBoYXMoRGVzYywgJ1tbR2V0XV0nKSB8fCBoYXMoRGVzYywgJ1tbU2V0XV0nKTtcblx0XHRpZiAoaXNEYXRhICYmIElzQWNjZXNzb3IpIHtcblx0XHRcdHRocm93IG5ldyAkVHlwZUVycm9yKCdQcm9wZXJ0eSBEZXNjcmlwdG9ycyBtYXkgbm90IGJlIGJvdGggYWNjZXNzb3IgYW5kIGRhdGEgZGVzY3JpcHRvcnMnKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0Ly8gaHR0cHM6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzUuMS8jc2VjLTguMTAuMVxuXHRJc0FjY2Vzc29yRGVzY3JpcHRvcjogZnVuY3Rpb24gSXNBY2Nlc3NvckRlc2NyaXB0b3IoRGVzYykge1xuXHRcdGlmICh0eXBlb2YgRGVzYyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRhc3NlcnRSZWNvcmQodGhpcywgJ1Byb3BlcnR5IERlc2NyaXB0b3InLCAnRGVzYycsIERlc2MpO1xuXG5cdFx0aWYgKCFoYXMoRGVzYywgJ1tbR2V0XV0nKSAmJiAhaGFzKERlc2MsICdbW1NldF1dJykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSxcblxuXHQvLyBodHRwczovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNS4xLyNzZWMtOC4xMC4yXG5cdElzRGF0YURlc2NyaXB0b3I6IGZ1bmN0aW9uIElzRGF0YURlc2NyaXB0b3IoRGVzYykge1xuXHRcdGlmICh0eXBlb2YgRGVzYyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRhc3NlcnRSZWNvcmQodGhpcywgJ1Byb3BlcnR5IERlc2NyaXB0b3InLCAnRGVzYycsIERlc2MpO1xuXG5cdFx0aWYgKCFoYXMoRGVzYywgJ1tbVmFsdWVdXScpICYmICFoYXMoRGVzYywgJ1tbV3JpdGFibGVdXScpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0Ly8gaHR0cHM6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzUuMS8jc2VjLTguMTAuM1xuXHRJc0dlbmVyaWNEZXNjcmlwdG9yOiBmdW5jdGlvbiBJc0dlbmVyaWNEZXNjcmlwdG9yKERlc2MpIHtcblx0XHRpZiAodHlwZW9mIERlc2MgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0UmVjb3JkKHRoaXMsICdQcm9wZXJ0eSBEZXNjcmlwdG9yJywgJ0Rlc2MnLCBEZXNjKTtcblxuXHRcdGlmICghdGhpcy5Jc0FjY2Vzc29yRGVzY3JpcHRvcihEZXNjKSAmJiAhdGhpcy5Jc0RhdGFEZXNjcmlwdG9yKERlc2MpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0sXG5cblx0Ly8gaHR0cHM6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzUuMS8jc2VjLTguMTAuNFxuXHRGcm9tUHJvcGVydHlEZXNjcmlwdG9yOiBmdW5jdGlvbiBGcm9tUHJvcGVydHlEZXNjcmlwdG9yKERlc2MpIHtcblx0XHRpZiAodHlwZW9mIERlc2MgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gRGVzYztcblx0XHR9XG5cblx0XHRhc3NlcnRSZWNvcmQodGhpcywgJ1Byb3BlcnR5IERlc2NyaXB0b3InLCAnRGVzYycsIERlc2MpO1xuXG5cdFx0aWYgKHRoaXMuSXNEYXRhRGVzY3JpcHRvcihEZXNjKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dmFsdWU6IERlc2NbJ1tbVmFsdWVdXSddLFxuXHRcdFx0XHR3cml0YWJsZTogISFEZXNjWydbW1dyaXRhYmxlXV0nXSxcblx0XHRcdFx0ZW51bWVyYWJsZTogISFEZXNjWydbW0VudW1lcmFibGVdXSddLFxuXHRcdFx0XHRjb25maWd1cmFibGU6ICEhRGVzY1snW1tDb25maWd1cmFibGVdXSddXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSBpZiAodGhpcy5Jc0FjY2Vzc29yRGVzY3JpcHRvcihEZXNjKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Z2V0OiBEZXNjWydbW0dldF1dJ10sXG5cdFx0XHRcdHNldDogRGVzY1snW1tTZXRdXSddLFxuXHRcdFx0XHRlbnVtZXJhYmxlOiAhIURlc2NbJ1tbRW51bWVyYWJsZV1dJ10sXG5cdFx0XHRcdGNvbmZpZ3VyYWJsZTogISFEZXNjWydbW0NvbmZpZ3VyYWJsZV1dJ11cblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyAkVHlwZUVycm9yKCdGcm9tUHJvcGVydHlEZXNjcmlwdG9yIG11c3QgYmUgY2FsbGVkIHdpdGggYSBmdWxseSBwb3B1bGF0ZWQgUHJvcGVydHkgRGVzY3JpcHRvcicpO1xuXHRcdH1cblx0fSxcblxuXHQvLyBodHRwczovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNS4xLyNzZWMtOC4xMC41XG5cdFRvUHJvcGVydHlEZXNjcmlwdG9yOiBmdW5jdGlvbiBUb1Byb3BlcnR5RGVzY3JpcHRvcihPYmopIHtcblx0XHRpZiAodGhpcy5UeXBlKE9iaikgIT09ICdPYmplY3QnKSB7XG5cdFx0XHR0aHJvdyBuZXcgJFR5cGVFcnJvcignVG9Qcm9wZXJ0eURlc2NyaXB0b3IgcmVxdWlyZXMgYW4gb2JqZWN0Jyk7XG5cdFx0fVxuXG5cdFx0dmFyIGRlc2MgPSB7fTtcblx0XHRpZiAoaGFzKE9iaiwgJ2VudW1lcmFibGUnKSkge1xuXHRcdFx0ZGVzY1snW1tFbnVtZXJhYmxlXV0nXSA9IHRoaXMuVG9Cb29sZWFuKE9iai5lbnVtZXJhYmxlKTtcblx0XHR9XG5cdFx0aWYgKGhhcyhPYmosICdjb25maWd1cmFibGUnKSkge1xuXHRcdFx0ZGVzY1snW1tDb25maWd1cmFibGVdXSddID0gdGhpcy5Ub0Jvb2xlYW4oT2JqLmNvbmZpZ3VyYWJsZSk7XG5cdFx0fVxuXHRcdGlmIChoYXMoT2JqLCAndmFsdWUnKSkge1xuXHRcdFx0ZGVzY1snW1tWYWx1ZV1dJ10gPSBPYmoudmFsdWU7XG5cdFx0fVxuXHRcdGlmIChoYXMoT2JqLCAnd3JpdGFibGUnKSkge1xuXHRcdFx0ZGVzY1snW1tXcml0YWJsZV1dJ10gPSB0aGlzLlRvQm9vbGVhbihPYmoud3JpdGFibGUpO1xuXHRcdH1cblx0XHRpZiAoaGFzKE9iaiwgJ2dldCcpKSB7XG5cdFx0XHR2YXIgZ2V0dGVyID0gT2JqLmdldDtcblx0XHRcdGlmICh0eXBlb2YgZ2V0dGVyICE9PSAndW5kZWZpbmVkJyAmJiAhdGhpcy5Jc0NhbGxhYmxlKGdldHRlcikpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignZ2V0dGVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXHRcdFx0fVxuXHRcdFx0ZGVzY1snW1tHZXRdXSddID0gZ2V0dGVyO1xuXHRcdH1cblx0XHRpZiAoaGFzKE9iaiwgJ3NldCcpKSB7XG5cdFx0XHR2YXIgc2V0dGVyID0gT2JqLnNldDtcblx0XHRcdGlmICh0eXBlb2Ygc2V0dGVyICE9PSAndW5kZWZpbmVkJyAmJiAhdGhpcy5Jc0NhbGxhYmxlKHNldHRlcikpIHtcblx0XHRcdFx0dGhyb3cgbmV3ICRUeXBlRXJyb3IoJ3NldHRlciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblx0XHRcdH1cblx0XHRcdGRlc2NbJ1tbU2V0XV0nXSA9IHNldHRlcjtcblx0XHR9XG5cblx0XHRpZiAoKGhhcyhkZXNjLCAnW1tHZXRdXScpIHx8IGhhcyhkZXNjLCAnW1tTZXRdXScpKSAmJiAoaGFzKGRlc2MsICdbW1ZhbHVlXV0nKSB8fCBoYXMoZGVzYywgJ1tbV3JpdGFibGVdXScpKSkge1xuXHRcdFx0dGhyb3cgbmV3ICRUeXBlRXJyb3IoJ0ludmFsaWQgcHJvcGVydHkgZGVzY3JpcHRvci4gQ2Fubm90IGJvdGggc3BlY2lmeSBhY2Nlc3NvcnMgYW5kIGEgdmFsdWUgb3Igd3JpdGFibGUgYXR0cmlidXRlJyk7XG5cdFx0fVxuXHRcdHJldHVybiBkZXNjO1xuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVTNTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEdldEludHJpbnNpYyA9IHJlcXVpcmUoJy4uL0dldEludHJpbnNpYycpO1xuXG52YXIgJFR5cGVFcnJvciA9IEdldEludHJpbnNpYygnJVR5cGVFcnJvciUnKTtcbnZhciAkU3ludGF4RXJyb3IgPSBHZXRJbnRyaW5zaWMoJyVTeW50YXhFcnJvciUnKTtcblxudmFyIGhhcyA9IHJlcXVpcmUoJ2hhcycpO1xuXG52YXIgcHJlZGljYXRlcyA9IHtcbiAgLy8gaHR0cHM6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXByb3BlcnR5LWRlc2NyaXB0b3Itc3BlY2lmaWNhdGlvbi10eXBlXG4gICdQcm9wZXJ0eSBEZXNjcmlwdG9yJzogZnVuY3Rpb24gaXNQcm9wZXJ0eURlc2NyaXB0b3IoRVMsIERlc2MpIHtcbiAgICBpZiAoRVMuVHlwZShEZXNjKSAhPT0gJ09iamVjdCcpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGFsbG93ZWQgPSB7XG4gICAgICAnW1tDb25maWd1cmFibGVdXSc6IHRydWUsXG4gICAgICAnW1tFbnVtZXJhYmxlXV0nOiB0cnVlLFxuICAgICAgJ1tbR2V0XV0nOiB0cnVlLFxuICAgICAgJ1tbU2V0XV0nOiB0cnVlLFxuICAgICAgJ1tbVmFsdWVdXSc6IHRydWUsXG4gICAgICAnW1tXcml0YWJsZV1dJzogdHJ1ZVxuICAgIH07XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gRGVzYykgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgICBpZiAoaGFzKERlc2MsIGtleSkgJiYgIWFsbG93ZWRba2V5XSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGlzRGF0YSA9IGhhcyhEZXNjLCAnW1tWYWx1ZV1dJyk7XG4gICAgdmFyIElzQWNjZXNzb3IgPSBoYXMoRGVzYywgJ1tbR2V0XV0nKSB8fCBoYXMoRGVzYywgJ1tbU2V0XV0nKTtcbiAgICBpZiAoaXNEYXRhICYmIElzQWNjZXNzb3IpIHtcbiAgICAgIHRocm93IG5ldyAkVHlwZUVycm9yKCdQcm9wZXJ0eSBEZXNjcmlwdG9ycyBtYXkgbm90IGJlIGJvdGggYWNjZXNzb3IgYW5kIGRhdGEgZGVzY3JpcHRvcnMnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXNzZXJ0UmVjb3JkKEVTLCByZWNvcmRUeXBlLCBhcmd1bWVudE5hbWUsIHZhbHVlKSB7XG4gIHZhciBwcmVkaWNhdGUgPSBwcmVkaWNhdGVzW3JlY29yZFR5cGVdO1xuICBpZiAodHlwZW9mIHByZWRpY2F0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyAkU3ludGF4RXJyb3IoJ3Vua25vd24gcmVjb3JkIHR5cGU6ICcgKyByZWNvcmRUeXBlKTtcbiAgfVxuICBpZiAoIXByZWRpY2F0ZShFUywgdmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3ICRUeXBlRXJyb3IoYXJndW1lbnROYW1lICsgJyBtdXN0IGJlIGEgJyArIHJlY29yZFR5cGUpO1xuICB9XG4gIGNvbnNvbGUubG9nKHByZWRpY2F0ZShFUywgdmFsdWUpLCB2YWx1ZSk7XG59O1xuIiwidmFyICRpc05hTiA9IE51bWJlci5pc05hTiB8fCBmdW5jdGlvbiAoYSkgeyByZXR1cm4gYSAhPT0gYTsgfTtcblxubW9kdWxlLmV4cG9ydHMgPSBOdW1iZXIuaXNGaW5pdGUgfHwgZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHR5cGVvZiB4ID09PSAnbnVtYmVyJyAmJiAhJGlzTmFOKHgpICYmIHggIT09IEluZmluaXR5ICYmIHggIT09IC1JbmZpbml0eTsgfTtcbiIsIm1vZHVsZS5leHBvcnRzID0gTnVtYmVyLmlzTmFOIHx8IGZ1bmN0aW9uIGlzTmFOKGEpIHtcblx0cmV0dXJuIGEgIT09IGE7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBtb2QobnVtYmVyLCBtb2R1bG8pIHtcblx0dmFyIHJlbWFpbiA9IG51bWJlciAlIG1vZHVsbztcblx0cmV0dXJuIE1hdGguZmxvb3IocmVtYWluID49IDAgPyByZW1haW4gOiByZW1haW4gKyBtb2R1bG8pO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2lnbihudW1iZXIpIHtcblx0cmV0dXJuIG51bWJlciA+PSAwID8gMSA6IC0xO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxudmFyIGlzUHJpbWl0aXZlID0gcmVxdWlyZSgnLi9oZWxwZXJzL2lzUHJpbWl0aXZlJyk7XG5cbnZhciBpc0NhbGxhYmxlID0gcmVxdWlyZSgnaXMtY2FsbGFibGUnKTtcblxuLy8gaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNS4xLyNzZWMtOC4xMi44XG52YXIgRVM1aW50ZXJuYWxTbG90cyA9IHtcblx0J1tbRGVmYXVsdFZhbHVlXV0nOiBmdW5jdGlvbiAoTykge1xuXHRcdHZhciBhY3R1YWxIaW50O1xuXHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuXHRcdFx0YWN0dWFsSGludCA9IGFyZ3VtZW50c1sxXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YWN0dWFsSGludCA9IHRvU3RyLmNhbGwoTykgPT09ICdbb2JqZWN0IERhdGVdJyA/IFN0cmluZyA6IE51bWJlcjtcblx0XHR9XG5cblx0XHRpZiAoYWN0dWFsSGludCA9PT0gU3RyaW5nIHx8IGFjdHVhbEhpbnQgPT09IE51bWJlcikge1xuXHRcdFx0dmFyIG1ldGhvZHMgPSBhY3R1YWxIaW50ID09PSBTdHJpbmcgPyBbJ3RvU3RyaW5nJywgJ3ZhbHVlT2YnXSA6IFsndmFsdWVPZicsICd0b1N0cmluZyddO1xuXHRcdFx0dmFyIHZhbHVlLCBpO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IG1ldGhvZHMubGVuZ3RoOyArK2kpIHtcblx0XHRcdFx0aWYgKGlzQ2FsbGFibGUoT1ttZXRob2RzW2ldXSkpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IE9bbWV0aG9kc1tpXV0oKTtcblx0XHRcdFx0XHRpZiAoaXNQcmltaXRpdmUodmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdObyBkZWZhdWx0IHZhbHVlJyk7XG5cdFx0fVxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2ludmFsaWQgW1tEZWZhdWx0VmFsdWVdXSBoaW50IHN1cHBsaWVkJyk7XG5cdH1cbn07XG5cbi8vIGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzUuMS8jc2VjLTkuMVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBUb1ByaW1pdGl2ZShpbnB1dCkge1xuXHRpZiAoaXNQcmltaXRpdmUoaW5wdXQpKSB7XG5cdFx0cmV0dXJuIGlucHV0O1xuXHR9XG5cdGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuXHRcdHJldHVybiBFUzVpbnRlcm5hbFNsb3RzWydbW0RlZmF1bHRWYWx1ZV1dJ10oaW5wdXQsIGFyZ3VtZW50c1sxXSk7XG5cdH1cblx0cmV0dXJuIEVTNWludGVybmFsU2xvdHNbJ1tbRGVmYXVsdFZhbHVlXV0nXShpbnB1dCk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc1ByaW1pdGl2ZSh2YWx1ZSkge1xuXHRyZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgKHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpc0NhbGxhYmxlID0gcmVxdWlyZSgnaXMtY2FsbGFibGUnKTtcblxudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbnZhciBmb3JFYWNoQXJyYXkgPSBmdW5jdGlvbiBmb3JFYWNoQXJyYXkoYXJyYXksIGl0ZXJhdG9yLCByZWNlaXZlcikge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChhcnJheSwgaSkpIHtcbiAgICAgICAgICAgIGlmIChyZWNlaXZlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaXRlcmF0b3IoYXJyYXlbaV0sIGksIGFycmF5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChyZWNlaXZlciwgYXJyYXlbaV0sIGksIGFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnZhciBmb3JFYWNoU3RyaW5nID0gZnVuY3Rpb24gZm9yRWFjaFN0cmluZyhzdHJpbmcsIGl0ZXJhdG9yLCByZWNlaXZlcikge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBzdHJpbmcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgLy8gbm8gc3VjaCB0aGluZyBhcyBhIHNwYXJzZSBzdHJpbmcuXG4gICAgICAgIGlmIChyZWNlaXZlciA9PSBudWxsKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihzdHJpbmcuY2hhckF0KGkpLCBpLCBzdHJpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChyZWNlaXZlciwgc3RyaW5nLmNoYXJBdChpKSwgaSwgc3RyaW5nKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnZhciBmb3JFYWNoT2JqZWN0ID0gZnVuY3Rpb24gZm9yRWFjaE9iamVjdChvYmplY3QsIGl0ZXJhdG9yLCByZWNlaXZlcikge1xuICAgIGZvciAodmFyIGsgaW4gb2JqZWN0KSB7XG4gICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgaykpIHtcbiAgICAgICAgICAgIGlmIChyZWNlaXZlciA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaXRlcmF0b3Iob2JqZWN0W2tdLCBrLCBvYmplY3QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpdGVyYXRvci5jYWxsKHJlY2VpdmVyLCBvYmplY3Rba10sIGssIG9iamVjdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG52YXIgZm9yRWFjaCA9IGZ1bmN0aW9uIGZvckVhY2gobGlzdCwgaXRlcmF0b3IsIHRoaXNBcmcpIHtcbiAgICBpZiAoIWlzQ2FsbGFibGUoaXRlcmF0b3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2l0ZXJhdG9yIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgIH1cblxuICAgIHZhciByZWNlaXZlcjtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAzKSB7XG4gICAgICAgIHJlY2VpdmVyID0gdGhpc0FyZztcbiAgICB9XG5cbiAgICBpZiAodG9TdHIuY2FsbChsaXN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICBmb3JFYWNoQXJyYXkobGlzdCwgaXRlcmF0b3IsIHJlY2VpdmVyKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBsaXN0ID09PSAnc3RyaW5nJykge1xuICAgICAgICBmb3JFYWNoU3RyaW5nKGxpc3QsIGl0ZXJhdG9yLCByZWNlaXZlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yRWFjaE9iamVjdChsaXN0LCBpdGVyYXRvciwgcmVjZWl2ZXIpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZm9yRWFjaDtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZXNsaW50IG5vLWludmFsaWQtdGhpczogMSAqL1xuXG52YXIgRVJST1JfTUVTU0FHRSA9ICdGdW5jdGlvbi5wcm90b3R5cGUuYmluZCBjYWxsZWQgb24gaW5jb21wYXRpYmxlICc7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIGZ1bmNUeXBlID0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBiaW5kKHRoYXQpIHtcbiAgICB2YXIgdGFyZ2V0ID0gdGhpcztcbiAgICBpZiAodHlwZW9mIHRhcmdldCAhPT0gJ2Z1bmN0aW9uJyB8fCB0b1N0ci5jYWxsKHRhcmdldCkgIT09IGZ1bmNUeXBlKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoRVJST1JfTUVTU0FHRSArIHRhcmdldCk7XG4gICAgfVxuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgdmFyIGJvdW5kO1xuICAgIHZhciBiaW5kZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzIGluc3RhbmNlb2YgYm91bmQpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSB0YXJnZXQuYXBwbHkoXG4gICAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgICBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKE9iamVjdChyZXN1bHQpID09PSByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0LmFwcGx5KFxuICAgICAgICAgICAgICAgIHRoYXQsXG4gICAgICAgICAgICAgICAgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgYm91bmRMZW5ndGggPSBNYXRoLm1heCgwLCB0YXJnZXQubGVuZ3RoIC0gYXJncy5sZW5ndGgpO1xuICAgIHZhciBib3VuZEFyZ3MgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJvdW5kTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYm91bmRBcmdzLnB1c2goJyQnICsgaSk7XG4gICAgfVxuXG4gICAgYm91bmQgPSBGdW5jdGlvbignYmluZGVyJywgJ3JldHVybiBmdW5jdGlvbiAoJyArIGJvdW5kQXJncy5qb2luKCcsJykgKyAnKXsgcmV0dXJuIGJpbmRlci5hcHBseSh0aGlzLGFyZ3VtZW50cyk7IH0nKShiaW5kZXIpO1xuXG4gICAgaWYgKHRhcmdldC5wcm90b3R5cGUpIHtcbiAgICAgICAgdmFyIEVtcHR5ID0gZnVuY3Rpb24gRW1wdHkoKSB7fTtcbiAgICAgICAgRW1wdHkucHJvdG90eXBlID0gdGFyZ2V0LnByb3RvdHlwZTtcbiAgICAgICAgYm91bmQucHJvdG90eXBlID0gbmV3IEVtcHR5KCk7XG4gICAgICAgIEVtcHR5LnByb3RvdHlwZSA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJvdW5kO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGltcGxlbWVudGF0aW9uID0gcmVxdWlyZSgnLi9pbXBsZW1lbnRhdGlvbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kIHx8IGltcGxlbWVudGF0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYmluZCA9IHJlcXVpcmUoJ2Z1bmN0aW9uLWJpbmQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBiaW5kLmNhbGwoRnVuY3Rpb24uY2FsbCwgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSk7XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IChuQnl0ZXMgKiA4KSAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IChlICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IChtICogMjU2KSArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSAobkJ5dGVzICogOCkgLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKCh2YWx1ZSAqIGMpIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicpIHtcbiAgLy8gaW1wbGVtZW50YXRpb24gZnJvbSBzdGFuZGFyZCBub2RlLmpzICd1dGlsJyBtb2R1bGVcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcbn0gZWxzZSB7XG4gIC8vIG9sZCBzY2hvb2wgc2hpbSBmb3Igb2xkIGJyb3dzZXJzXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3JcbiAgICB2YXIgVGVtcEN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICAgIFRlbXBDdG9yLnByb3RvdHlwZSA9IHN1cGVyQ3Rvci5wcm90b3R5cGVcbiAgICBjdG9yLnByb3RvdHlwZSA9IG5ldyBUZW1wQ3RvcigpXG4gICAgY3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjdG9yXG4gIH1cbn1cbiIsIi8qIVxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBhIEJ1ZmZlclxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxuLy8gVGhlIF9pc0J1ZmZlciBjaGVjayBpcyBmb3IgU2FmYXJpIDUtNyBzdXBwb3J0LCBiZWNhdXNlIGl0J3MgbWlzc2luZ1xuLy8gT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvci4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiBvYmogIT0gbnVsbCAmJiAoaXNCdWZmZXIob2JqKSB8fCBpc1Nsb3dCdWZmZXIob2JqKSB8fCAhIW9iai5faXNCdWZmZXIpXG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyIChvYmopIHtcbiAgcmV0dXJuICEhb2JqLmNvbnN0cnVjdG9yICYmIHR5cGVvZiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iailcbn1cblxuLy8gRm9yIE5vZGUgdjAuMTAgc3VwcG9ydC4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseS5cbmZ1bmN0aW9uIGlzU2xvd0J1ZmZlciAob2JqKSB7XG4gIHJldHVybiB0eXBlb2Ygb2JqLnJlYWRGbG9hdExFID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvYmouc2xpY2UgPT09ICdmdW5jdGlvbicgJiYgaXNCdWZmZXIob2JqLnNsaWNlKDAsIDApKVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZm5Ub1N0ciA9IEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZztcblxudmFyIGNvbnN0cnVjdG9yUmVnZXggPSAvXlxccypjbGFzc1xcYi87XG52YXIgaXNFUzZDbGFzc0ZuID0gZnVuY3Rpb24gaXNFUzZDbGFzc0Z1bmN0aW9uKHZhbHVlKSB7XG5cdHRyeSB7XG5cdFx0dmFyIGZuU3RyID0gZm5Ub1N0ci5jYWxsKHZhbHVlKTtcblx0XHRyZXR1cm4gY29uc3RydWN0b3JSZWdleC50ZXN0KGZuU3RyKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdHJldHVybiBmYWxzZTsgLy8gbm90IGEgZnVuY3Rpb25cblx0fVxufTtcblxudmFyIHRyeUZ1bmN0aW9uT2JqZWN0ID0gZnVuY3Rpb24gdHJ5RnVuY3Rpb25Ub1N0cih2YWx1ZSkge1xuXHR0cnkge1xuXHRcdGlmIChpc0VTNkNsYXNzRm4odmFsdWUpKSB7IHJldHVybiBmYWxzZTsgfVxuXHRcdGZuVG9TdHIuY2FsbCh2YWx1ZSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn07XG52YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIGZuQ2xhc3MgPSAnW29iamVjdCBGdW5jdGlvbl0nO1xudmFyIGdlbkNsYXNzID0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJztcbnZhciBoYXNUb1N0cmluZ1RhZyA9IHR5cGVvZiBTeW1ib2wgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIFN5bWJvbC50b1N0cmluZ1RhZyA9PT0gJ3N5bWJvbCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNDYWxsYWJsZSh2YWx1ZSkge1xuXHRpZiAoIXZhbHVlKSB7IHJldHVybiBmYWxzZTsgfVxuXHRpZiAodHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHsgcmV0dXJuIGZhbHNlOyB9XG5cdGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgIXZhbHVlLnByb3RvdHlwZSkgeyByZXR1cm4gdHJ1ZTsgfVxuXHRpZiAoaGFzVG9TdHJpbmdUYWcpIHsgcmV0dXJuIHRyeUZ1bmN0aW9uT2JqZWN0KHZhbHVlKTsgfVxuXHRpZiAoaXNFUzZDbGFzc0ZuKHZhbHVlKSkgeyByZXR1cm4gZmFsc2U7IH1cblx0dmFyIHN0ckNsYXNzID0gdG9TdHIuY2FsbCh2YWx1ZSk7XG5cdHJldHVybiBzdHJDbGFzcyA9PT0gZm5DbGFzcyB8fCBzdHJDbGFzcyA9PT0gZ2VuQ2xhc3M7XG59O1xuIiwidmFyIGhhc01hcCA9IHR5cGVvZiBNYXAgPT09ICdmdW5jdGlvbicgJiYgTWFwLnByb3RvdHlwZTtcbnZhciBtYXBTaXplRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgJiYgaGFzTWFwID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihNYXAucHJvdG90eXBlLCAnc2l6ZScpIDogbnVsbDtcbnZhciBtYXBTaXplID0gaGFzTWFwICYmIG1hcFNpemVEZXNjcmlwdG9yICYmIHR5cGVvZiBtYXBTaXplRGVzY3JpcHRvci5nZXQgPT09ICdmdW5jdGlvbicgPyBtYXBTaXplRGVzY3JpcHRvci5nZXQgOiBudWxsO1xudmFyIG1hcEZvckVhY2ggPSBoYXNNYXAgJiYgTWFwLnByb3RvdHlwZS5mb3JFYWNoO1xudmFyIGhhc1NldCA9IHR5cGVvZiBTZXQgPT09ICdmdW5jdGlvbicgJiYgU2V0LnByb3RvdHlwZTtcbnZhciBzZXRTaXplRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgJiYgaGFzU2V0ID8gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihTZXQucHJvdG90eXBlLCAnc2l6ZScpIDogbnVsbDtcbnZhciBzZXRTaXplID0gaGFzU2V0ICYmIHNldFNpemVEZXNjcmlwdG9yICYmIHR5cGVvZiBzZXRTaXplRGVzY3JpcHRvci5nZXQgPT09ICdmdW5jdGlvbicgPyBzZXRTaXplRGVzY3JpcHRvci5nZXQgOiBudWxsO1xudmFyIHNldEZvckVhY2ggPSBoYXNTZXQgJiYgU2V0LnByb3RvdHlwZS5mb3JFYWNoO1xudmFyIGJvb2xlYW5WYWx1ZU9mID0gQm9vbGVhbi5wcm90b3R5cGUudmFsdWVPZjtcbnZhciBvYmplY3RUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG52YXIgYmlnSW50VmFsdWVPZiA9IHR5cGVvZiBCaWdJbnQgPT09ICdmdW5jdGlvbicgPyBCaWdJbnQucHJvdG90eXBlLnZhbHVlT2YgOiBudWxsO1xuXG52YXIgaW5zcGVjdEN1c3RvbSA9IHJlcXVpcmUoJy4vdXRpbC5pbnNwZWN0JykuY3VzdG9tO1xudmFyIGluc3BlY3RTeW1ib2wgPSAoaW5zcGVjdEN1c3RvbSAmJiBpc1N5bWJvbChpbnNwZWN0Q3VzdG9tKSkgPyBpbnNwZWN0Q3VzdG9tIDogbnVsbDtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbnNwZWN0XyAob2JqLCBvcHRzLCBkZXB0aCwgc2Vlbikge1xuICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuXG4gICAgaWYgKGhhcyhvcHRzLCAncXVvdGVTdHlsZScpICYmIChvcHRzLnF1b3RlU3R5bGUgIT09ICdzaW5nbGUnICYmIG9wdHMucXVvdGVTdHlsZSAhPT0gJ2RvdWJsZScpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ29wdGlvbiBcInF1b3RlU3R5bGVcIiBtdXN0IGJlIFwic2luZ2xlXCIgb3IgXCJkb3VibGVcIicpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gICAgfVxuICAgIGlmIChvYmogPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICdudWxsJztcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdib29sZWFuJykge1xuICAgICAgICByZXR1cm4gb2JqID8gJ3RydWUnIDogJ2ZhbHNlJztcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGluc3BlY3RTdHJpbmcob2JqLCBvcHRzKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdudW1iZXInKSB7XG4gICAgICBpZiAob2JqID09PSAwKSB7XG4gICAgICAgIHJldHVybiBJbmZpbml0eSAvIG9iaiA+IDAgPyAnMCcgOiAnLTAnO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFN0cmluZyhvYmopO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gJ2JpZ2ludCcpIHtcbiAgICAgIHJldHVybiBTdHJpbmcob2JqKSArICduJztcbiAgICB9XG5cbiAgICB2YXIgbWF4RGVwdGggPSB0eXBlb2Ygb3B0cy5kZXB0aCA9PT0gJ3VuZGVmaW5lZCcgPyA1IDogb3B0cy5kZXB0aDtcbiAgICBpZiAodHlwZW9mIGRlcHRoID09PSAndW5kZWZpbmVkJykgZGVwdGggPSAwO1xuICAgIGlmIChkZXB0aCA+PSBtYXhEZXB0aCAmJiBtYXhEZXB0aCA+IDAgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuICdbT2JqZWN0XSc7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBzZWVuID09PSAndW5kZWZpbmVkJykgc2VlbiA9IFtdO1xuICAgIGVsc2UgaWYgKGluZGV4T2Yoc2Vlbiwgb2JqKSA+PSAwKSB7XG4gICAgICAgIHJldHVybiAnW0NpcmN1bGFyXSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5zcGVjdCAodmFsdWUsIGZyb20pIHtcbiAgICAgICAgaWYgKGZyb20pIHtcbiAgICAgICAgICAgIHNlZW4gPSBzZWVuLnNsaWNlKCk7XG4gICAgICAgICAgICBzZWVuLnB1c2goZnJvbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGluc3BlY3RfKHZhbHVlLCBvcHRzLCBkZXB0aCArIDEsIHNlZW4pO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZhciBuYW1lID0gbmFtZU9mKG9iaik7XG4gICAgICAgIHJldHVybiAnW0Z1bmN0aW9uJyArIChuYW1lID8gJzogJyArIG5hbWUgOiAnJykgKyAnXSc7XG4gICAgfVxuICAgIGlmIChpc1N5bWJvbChvYmopKSB7XG4gICAgICAgIHZhciBzeW1TdHJpbmcgPSBTeW1ib2wucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdvYmplY3QnID8gbWFya0JveGVkKHN5bVN0cmluZykgOiBzeW1TdHJpbmc7XG4gICAgfVxuICAgIGlmIChpc0VsZW1lbnQob2JqKSkge1xuICAgICAgICB2YXIgcyA9ICc8JyArIFN0cmluZyhvYmoubm9kZU5hbWUpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciBhdHRycyA9IG9iai5hdHRyaWJ1dGVzIHx8IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBzICs9ICcgJyArIGF0dHJzW2ldLm5hbWUgKyAnPScgKyB3cmFwUXVvdGVzKHF1b3RlKGF0dHJzW2ldLnZhbHVlKSwgJ2RvdWJsZScsIG9wdHMpO1xuICAgICAgICB9XG4gICAgICAgIHMgKz0gJz4nO1xuICAgICAgICBpZiAob2JqLmNoaWxkTm9kZXMgJiYgb2JqLmNoaWxkTm9kZXMubGVuZ3RoKSBzICs9ICcuLi4nO1xuICAgICAgICBzICs9ICc8LycgKyBTdHJpbmcob2JqLm5vZGVOYW1lKS50b0xvd2VyQ2FzZSgpICsgJz4nO1xuICAgICAgICByZXR1cm4gcztcbiAgICB9XG4gICAgaWYgKGlzQXJyYXkob2JqKSkge1xuICAgICAgICBpZiAob2JqLmxlbmd0aCA9PT0gMCkgcmV0dXJuICdbXSc7XG4gICAgICAgIHJldHVybiAnWyAnICsgYXJyT2JqS2V5cyhvYmosIGluc3BlY3QpLmpvaW4oJywgJykgKyAnIF0nO1xuICAgIH1cbiAgICBpZiAoaXNFcnJvcihvYmopKSB7XG4gICAgICAgIHZhciBwYXJ0cyA9IGFyck9iaktleXMob2JqLCBpbnNwZWN0KTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICdbJyArIFN0cmluZyhvYmopICsgJ10nO1xuICAgICAgICByZXR1cm4gJ3sgWycgKyBTdHJpbmcob2JqKSArICddICcgKyBwYXJ0cy5qb2luKCcsICcpICsgJyB9JztcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChpbnNwZWN0U3ltYm9sICYmIHR5cGVvZiBvYmpbaW5zcGVjdFN5bWJvbF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiBvYmpbaW5zcGVjdFN5bWJvbF0oKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqLmluc3BlY3QgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiBvYmouaW5zcGVjdCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpc01hcChvYmopKSB7XG4gICAgICAgIHZhciBwYXJ0cyA9IFtdO1xuICAgICAgICBtYXBGb3JFYWNoLmNhbGwob2JqLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgcGFydHMucHVzaChpbnNwZWN0KGtleSwgb2JqKSArICcgPT4gJyArIGluc3BlY3QodmFsdWUsIG9iaikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb25PZignTWFwJywgbWFwU2l6ZS5jYWxsKG9iaiksIHBhcnRzKTtcbiAgICB9XG4gICAgaWYgKGlzU2V0KG9iaikpIHtcbiAgICAgICAgdmFyIHBhcnRzID0gW107XG4gICAgICAgIHNldEZvckVhY2guY2FsbChvYmosIGZ1bmN0aW9uICh2YWx1ZSApIHtcbiAgICAgICAgICAgIHBhcnRzLnB1c2goaW5zcGVjdCh2YWx1ZSwgb2JqKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY29sbGVjdGlvbk9mKCdTZXQnLCBzZXRTaXplLmNhbGwob2JqKSwgcGFydHMpO1xuICAgIH1cbiAgICBpZiAoaXNOdW1iZXIob2JqKSkge1xuICAgICAgICByZXR1cm4gbWFya0JveGVkKGluc3BlY3QoTnVtYmVyKG9iaikpKTtcbiAgICB9XG4gICAgaWYgKGlzQmlnSW50KG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtCb3hlZChpbnNwZWN0KGJpZ0ludFZhbHVlT2YuY2FsbChvYmopKSk7XG4gICAgfVxuICAgIGlmIChpc0Jvb2xlYW4ob2JqKSkge1xuICAgICAgICByZXR1cm4gbWFya0JveGVkKGJvb2xlYW5WYWx1ZU9mLmNhbGwob2JqKSk7XG4gICAgfVxuICAgIGlmIChpc1N0cmluZyhvYmopKSB7XG4gICAgICAgIHJldHVybiBtYXJrQm94ZWQoaW5zcGVjdChTdHJpbmcob2JqKSkpO1xuICAgIH1cbiAgICBpZiAoIWlzRGF0ZShvYmopICYmICFpc1JlZ0V4cChvYmopKSB7XG4gICAgICAgIHZhciB4cyA9IGFyck9iaktleXMob2JqLCBpbnNwZWN0KTtcbiAgICAgICAgaWYgKHhzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICd7fSc7XG4gICAgICAgIHJldHVybiAneyAnICsgeHMuam9pbignLCAnKSArICcgfSc7XG4gICAgfVxuICAgIHJldHVybiBTdHJpbmcob2JqKTtcbn07XG5cbmZ1bmN0aW9uIHdyYXBRdW90ZXMgKHMsIGRlZmF1bHRTdHlsZSwgb3B0cykge1xuICAgIHZhciBxdW90ZUNoYXIgPSAob3B0cy5xdW90ZVN0eWxlIHx8IGRlZmF1bHRTdHlsZSkgPT09ICdkb3VibGUnID8gJ1wiJyA6IFwiJ1wiO1xuICAgIHJldHVybiBxdW90ZUNoYXIgKyBzICsgcXVvdGVDaGFyO1xufVxuXG5mdW5jdGlvbiBxdW90ZSAocykge1xuICAgIHJldHVybiBTdHJpbmcocykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xufVxuXG5mdW5jdGlvbiBpc0FycmF5IChvYmopIHsgcmV0dXJuIHRvU3RyKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7IH1cbmZ1bmN0aW9uIGlzRGF0ZSAob2JqKSB7IHJldHVybiB0b1N0cihvYmopID09PSAnW29iamVjdCBEYXRlXSc7IH1cbmZ1bmN0aW9uIGlzUmVnRXhwIChvYmopIHsgcmV0dXJuIHRvU3RyKG9iaikgPT09ICdbb2JqZWN0IFJlZ0V4cF0nOyB9XG5mdW5jdGlvbiBpc0Vycm9yIChvYmopIHsgcmV0dXJuIHRvU3RyKG9iaikgPT09ICdbb2JqZWN0IEVycm9yXSc7IH1cbmZ1bmN0aW9uIGlzU3ltYm9sIChvYmopIHsgcmV0dXJuIHRvU3RyKG9iaikgPT09ICdbb2JqZWN0IFN5bWJvbF0nOyB9XG5mdW5jdGlvbiBpc1N0cmluZyAob2JqKSB7IHJldHVybiB0b1N0cihvYmopID09PSAnW29iamVjdCBTdHJpbmddJzsgfVxuZnVuY3Rpb24gaXNOdW1iZXIgKG9iaikgeyByZXR1cm4gdG9TdHIob2JqKSA9PT0gJ1tvYmplY3QgTnVtYmVyXSc7IH1cbmZ1bmN0aW9uIGlzQmlnSW50IChvYmopIHsgcmV0dXJuIHRvU3RyKG9iaikgPT09ICdbb2JqZWN0IEJpZ0ludF0nOyB9XG5mdW5jdGlvbiBpc0Jvb2xlYW4gKG9iaikgeyByZXR1cm4gdG9TdHIob2JqKSA9PT0gJ1tvYmplY3QgQm9vbGVhbl0nOyB9XG5cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5IHx8IGZ1bmN0aW9uIChrZXkpIHsgcmV0dXJuIGtleSBpbiB0aGlzOyB9O1xuZnVuY3Rpb24gaGFzIChvYmosIGtleSkge1xuICAgIHJldHVybiBoYXNPd24uY2FsbChvYmosIGtleSk7XG59XG5cbmZ1bmN0aW9uIHRvU3RyIChvYmopIHtcbiAgICByZXR1cm4gb2JqZWN0VG9TdHJpbmcuY2FsbChvYmopO1xufVxuXG5mdW5jdGlvbiBuYW1lT2YgKGYpIHtcbiAgICBpZiAoZi5uYW1lKSByZXR1cm4gZi5uYW1lO1xuICAgIHZhciBtID0gU3RyaW5nKGYpLm1hdGNoKC9eZnVuY3Rpb25cXHMqKFtcXHckXSspLyk7XG4gICAgaWYgKG0pIHJldHVybiBtWzFdO1xufVxuXG5mdW5jdGlvbiBpbmRleE9mICh4cywgeCkge1xuICAgIGlmICh4cy5pbmRleE9mKSByZXR1cm4geHMuaW5kZXhPZih4KTtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZiAoeHNbaV0gPT09IHgpIHJldHVybiBpO1xuICAgIH1cbiAgICByZXR1cm4gLTE7XG59XG5cbmZ1bmN0aW9uIGlzTWFwICh4KSB7XG4gICAgaWYgKCFtYXBTaXplKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgbWFwU2l6ZS5jYWxsKHgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc2V0U2l6ZS5jYWxsKHgpO1xuICAgICAgICB9IGNhdGNoIChzKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geCBpbnN0YW5jZW9mIE1hcDsgLy8gY29yZS1qcyB3b3JrYXJvdW5kLCBwcmUtdjIuNS4wXG4gICAgfSBjYXRjaCAoZSkge31cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGlzU2V0ICh4KSB7XG4gICAgaWYgKCFzZXRTaXplKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgc2V0U2l6ZS5jYWxsKHgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbWFwU2l6ZS5jYWxsKHgpO1xuICAgICAgICB9IGNhdGNoIChtKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geCBpbnN0YW5jZW9mIFNldDsgLy8gY29yZS1qcyB3b3JrYXJvdW5kLCBwcmUtdjIuNS4wXG4gICAgfSBjYXRjaCAoZSkge31cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGlzRWxlbWVudCAoeCkge1xuICAgIGlmICgheCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIEhUTUxFbGVtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB4IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiB0eXBlb2YgeC5ub2RlTmFtZSA9PT0gJ3N0cmluZydcbiAgICAgICAgJiYgdHlwZW9mIHguZ2V0QXR0cmlidXRlID09PSAnZnVuY3Rpb24nXG4gICAgO1xufVxuXG5mdW5jdGlvbiBpbnNwZWN0U3RyaW5nIChzdHIsIG9wdHMpIHtcbiAgICB2YXIgcyA9IHN0ci5yZXBsYWNlKC8oWydcXFxcXSkvZywgJ1xcXFwkMScpLnJlcGxhY2UoL1tcXHgwMC1cXHgxZl0vZywgbG93Ynl0ZSk7XG4gICAgcmV0dXJuIHdyYXBRdW90ZXMocywgJ3NpbmdsZScsIG9wdHMpO1xufVxuXG5mdW5jdGlvbiBsb3dieXRlIChjKSB7XG4gICAgdmFyIG4gPSBjLmNoYXJDb2RlQXQoMCk7XG4gICAgdmFyIHggPSB7IDg6ICdiJywgOTogJ3QnLCAxMDogJ24nLCAxMjogJ2YnLCAxMzogJ3InIH1bbl07XG4gICAgaWYgKHgpIHJldHVybiAnXFxcXCcgKyB4O1xuICAgIHJldHVybiAnXFxcXHgnICsgKG4gPCAweDEwID8gJzAnIDogJycpICsgbi50b1N0cmluZygxNik7XG59XG5cbmZ1bmN0aW9uIG1hcmtCb3hlZCAoc3RyKSB7XG4gICAgcmV0dXJuICdPYmplY3QoJyArIHN0ciArICcpJztcbn1cblxuZnVuY3Rpb24gY29sbGVjdGlvbk9mICh0eXBlLCBzaXplLCBlbnRyaWVzKSB7XG4gICAgcmV0dXJuIHR5cGUgKyAnICgnICsgc2l6ZSArICcpIHsnICsgZW50cmllcy5qb2luKCcsICcpICsgJ30nO1xufVxuXG5mdW5jdGlvbiBhcnJPYmpLZXlzIChvYmosIGluc3BlY3QpIHtcbiAgICB2YXIgaXNBcnIgPSBpc0FycmF5KG9iaik7XG4gICAgdmFyIHhzID0gW107XG4gICAgaWYgKGlzQXJyKSB7XG4gICAgICAgIHhzLmxlbmd0aCA9IG9iai5sZW5ndGg7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB4c1tpXSA9IGhhcyhvYmosIGkpID8gaW5zcGVjdChvYmpbaV0sIG9iaikgOiAnJztcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmICghaGFzKG9iaiwga2V5KSkgY29udGludWU7XG4gICAgICAgIGlmIChpc0FyciAmJiBTdHJpbmcoTnVtYmVyKGtleSkpID09PSBrZXkgJiYga2V5IDwgb2JqLmxlbmd0aCkgY29udGludWU7XG4gICAgICAgIGlmICgvW15cXHckXS8udGVzdChrZXkpKSB7XG4gICAgICAgICAgICB4cy5wdXNoKGluc3BlY3Qoa2V5LCBvYmopICsgJzogJyArIGluc3BlY3Qob2JqW2tleV0sIG9iaikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeHMucHVzaChrZXkgKyAnOiAnICsgaW5zcGVjdChvYmpba2V5XSwgb2JqKSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHhzO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIga2V5c1NoaW07XG5pZiAoIU9iamVjdC5rZXlzKSB7XG5cdC8vIG1vZGlmaWVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2VzLXNoaW1zL2VzNS1zaGltXG5cdHZhciBoYXMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXHR2YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXHR2YXIgaXNBcmdzID0gcmVxdWlyZSgnLi9pc0FyZ3VtZW50cycpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGdsb2JhbC1yZXF1aXJlXG5cdHZhciBpc0VudW1lcmFibGUgPSBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXHR2YXIgaGFzRG9udEVudW1CdWcgPSAhaXNFbnVtZXJhYmxlLmNhbGwoeyB0b1N0cmluZzogbnVsbCB9LCAndG9TdHJpbmcnKTtcblx0dmFyIGhhc1Byb3RvRW51bUJ1ZyA9IGlzRW51bWVyYWJsZS5jYWxsKGZ1bmN0aW9uICgpIHt9LCAncHJvdG90eXBlJyk7XG5cdHZhciBkb250RW51bXMgPSBbXG5cdFx0J3RvU3RyaW5nJyxcblx0XHQndG9Mb2NhbGVTdHJpbmcnLFxuXHRcdCd2YWx1ZU9mJyxcblx0XHQnaGFzT3duUHJvcGVydHknLFxuXHRcdCdpc1Byb3RvdHlwZU9mJyxcblx0XHQncHJvcGVydHlJc0VudW1lcmFibGUnLFxuXHRcdCdjb25zdHJ1Y3Rvcidcblx0XTtcblx0dmFyIGVxdWFsc0NvbnN0cnVjdG9yUHJvdG90eXBlID0gZnVuY3Rpb24gKG8pIHtcblx0XHR2YXIgY3RvciA9IG8uY29uc3RydWN0b3I7XG5cdFx0cmV0dXJuIGN0b3IgJiYgY3Rvci5wcm90b3R5cGUgPT09IG87XG5cdH07XG5cdHZhciBleGNsdWRlZEtleXMgPSB7XG5cdFx0JGFwcGxpY2F0aW9uQ2FjaGU6IHRydWUsXG5cdFx0JGNvbnNvbGU6IHRydWUsXG5cdFx0JGV4dGVybmFsOiB0cnVlLFxuXHRcdCRmcmFtZTogdHJ1ZSxcblx0XHQkZnJhbWVFbGVtZW50OiB0cnVlLFxuXHRcdCRmcmFtZXM6IHRydWUsXG5cdFx0JGlubmVySGVpZ2h0OiB0cnVlLFxuXHRcdCRpbm5lcldpZHRoOiB0cnVlLFxuXHRcdCRvdXRlckhlaWdodDogdHJ1ZSxcblx0XHQkb3V0ZXJXaWR0aDogdHJ1ZSxcblx0XHQkcGFnZVhPZmZzZXQ6IHRydWUsXG5cdFx0JHBhZ2VZT2Zmc2V0OiB0cnVlLFxuXHRcdCRwYXJlbnQ6IHRydWUsXG5cdFx0JHNjcm9sbExlZnQ6IHRydWUsXG5cdFx0JHNjcm9sbFRvcDogdHJ1ZSxcblx0XHQkc2Nyb2xsWDogdHJ1ZSxcblx0XHQkc2Nyb2xsWTogdHJ1ZSxcblx0XHQkc2VsZjogdHJ1ZSxcblx0XHQkd2Via2l0SW5kZXhlZERCOiB0cnVlLFxuXHRcdCR3ZWJraXRTdG9yYWdlSW5mbzogdHJ1ZSxcblx0XHQkd2luZG93OiB0cnVlXG5cdH07XG5cdHZhciBoYXNBdXRvbWF0aW9uRXF1YWxpdHlCdWcgPSAoZnVuY3Rpb24gKCkge1xuXHRcdC8qIGdsb2JhbCB3aW5kb3cgKi9cblx0XHRpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHsgcmV0dXJuIGZhbHNlOyB9XG5cdFx0Zm9yICh2YXIgayBpbiB3aW5kb3cpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmICghZXhjbHVkZWRLZXlzWyckJyArIGtdICYmIGhhcy5jYWxsKHdpbmRvdywgaykgJiYgd2luZG93W2tdICE9PSBudWxsICYmIHR5cGVvZiB3aW5kb3dba10gPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGVxdWFsc0NvbnN0cnVjdG9yUHJvdG90eXBlKHdpbmRvd1trXSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH0oKSk7XG5cdHZhciBlcXVhbHNDb25zdHJ1Y3RvclByb3RvdHlwZUlmTm90QnVnZ3kgPSBmdW5jdGlvbiAobykge1xuXHRcdC8qIGdsb2JhbCB3aW5kb3cgKi9cblx0XHRpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgfHwgIWhhc0F1dG9tYXRpb25FcXVhbGl0eUJ1Zykge1xuXHRcdFx0cmV0dXJuIGVxdWFsc0NvbnN0cnVjdG9yUHJvdG90eXBlKG8pO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGVxdWFsc0NvbnN0cnVjdG9yUHJvdG90eXBlKG8pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH07XG5cblx0a2V5c1NoaW0gPSBmdW5jdGlvbiBrZXlzKG9iamVjdCkge1xuXHRcdHZhciBpc09iamVjdCA9IG9iamVjdCAhPT0gbnVsbCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0Jztcblx0XHR2YXIgaXNGdW5jdGlvbiA9IHRvU3RyLmNhbGwob2JqZWN0KSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblx0XHR2YXIgaXNBcmd1bWVudHMgPSBpc0FyZ3Mob2JqZWN0KTtcblx0XHR2YXIgaXNTdHJpbmcgPSBpc09iamVjdCAmJiB0b1N0ci5jYWxsKG9iamVjdCkgPT09ICdbb2JqZWN0IFN0cmluZ10nO1xuXHRcdHZhciB0aGVLZXlzID0gW107XG5cblx0XHRpZiAoIWlzT2JqZWN0ICYmICFpc0Z1bmN0aW9uICYmICFpc0FyZ3VtZW50cykge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignT2JqZWN0LmtleXMgY2FsbGVkIG9uIGEgbm9uLW9iamVjdCcpO1xuXHRcdH1cblxuXHRcdHZhciBza2lwUHJvdG8gPSBoYXNQcm90b0VudW1CdWcgJiYgaXNGdW5jdGlvbjtcblx0XHRpZiAoaXNTdHJpbmcgJiYgb2JqZWN0Lmxlbmd0aCA+IDAgJiYgIWhhcy5jYWxsKG9iamVjdCwgMCkpIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgb2JqZWN0Lmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdHRoZUtleXMucHVzaChTdHJpbmcoaSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpc0FyZ3VtZW50cyAmJiBvYmplY3QubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBvYmplY3QubGVuZ3RoOyArK2opIHtcblx0XHRcdFx0dGhlS2V5cy5wdXNoKFN0cmluZyhqKSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAodmFyIG5hbWUgaW4gb2JqZWN0KSB7XG5cdFx0XHRcdGlmICghKHNraXBQcm90byAmJiBuYW1lID09PSAncHJvdG90eXBlJykgJiYgaGFzLmNhbGwob2JqZWN0LCBuYW1lKSkge1xuXHRcdFx0XHRcdHRoZUtleXMucHVzaChTdHJpbmcobmFtZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGhhc0RvbnRFbnVtQnVnKSB7XG5cdFx0XHR2YXIgc2tpcENvbnN0cnVjdG9yID0gZXF1YWxzQ29uc3RydWN0b3JQcm90b3R5cGVJZk5vdEJ1Z2d5KG9iamVjdCk7XG5cblx0XHRcdGZvciAodmFyIGsgPSAwOyBrIDwgZG9udEVudW1zLmxlbmd0aDsgKytrKSB7XG5cdFx0XHRcdGlmICghKHNraXBDb25zdHJ1Y3RvciAmJiBkb250RW51bXNba10gPT09ICdjb25zdHJ1Y3RvcicpICYmIGhhcy5jYWxsKG9iamVjdCwgZG9udEVudW1zW2tdKSkge1xuXHRcdFx0XHRcdHRoZUtleXMucHVzaChkb250RW51bXNba10pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGVLZXlzO1xuXHR9O1xufVxubW9kdWxlLmV4cG9ydHMgPSBrZXlzU2hpbTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIGlzQXJncyA9IHJlcXVpcmUoJy4vaXNBcmd1bWVudHMnKTtcblxudmFyIG9yaWdLZXlzID0gT2JqZWN0LmtleXM7XG52YXIga2V5c1NoaW0gPSBvcmlnS2V5cyA/IGZ1bmN0aW9uIGtleXMobykgeyByZXR1cm4gb3JpZ0tleXMobyk7IH0gOiByZXF1aXJlKCcuL2ltcGxlbWVudGF0aW9uJyk7XG5cbnZhciBvcmlnaW5hbEtleXMgPSBPYmplY3Qua2V5cztcblxua2V5c1NoaW0uc2hpbSA9IGZ1bmN0aW9uIHNoaW1PYmplY3RLZXlzKCkge1xuXHRpZiAoT2JqZWN0LmtleXMpIHtcblx0XHR2YXIga2V5c1dvcmtzV2l0aEFyZ3VtZW50cyA9IChmdW5jdGlvbiAoKSB7XG5cdFx0XHQvLyBTYWZhcmkgNS4wIGJ1Z1xuXHRcdFx0dmFyIGFyZ3MgPSBPYmplY3Qua2V5cyhhcmd1bWVudHMpO1xuXHRcdFx0cmV0dXJuIGFyZ3MgJiYgYXJncy5sZW5ndGggPT09IGFyZ3VtZW50cy5sZW5ndGg7XG5cdFx0fSgxLCAyKSk7XG5cdFx0aWYgKCFrZXlzV29ya3NXaXRoQXJndW1lbnRzKSB7XG5cdFx0XHRPYmplY3Qua2V5cyA9IGZ1bmN0aW9uIGtleXMob2JqZWN0KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZnVuYy1uYW1lLW1hdGNoaW5nXG5cdFx0XHRcdGlmIChpc0FyZ3Mob2JqZWN0KSkge1xuXHRcdFx0XHRcdHJldHVybiBvcmlnaW5hbEtleXMoc2xpY2UuY2FsbChvYmplY3QpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gb3JpZ2luYWxLZXlzKG9iamVjdCk7XG5cdFx0XHR9O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRPYmplY3Qua2V5cyA9IGtleXNTaGltO1xuXHR9XG5cdHJldHVybiBPYmplY3Qua2V5cyB8fCBrZXlzU2hpbTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ga2V5c1NoaW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0b1N0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWUpIHtcblx0dmFyIHN0ciA9IHRvU3RyLmNhbGwodmFsdWUpO1xuXHR2YXIgaXNBcmdzID0gc3RyID09PSAnW29iamVjdCBBcmd1bWVudHNdJztcblx0aWYgKCFpc0FyZ3MpIHtcblx0XHRpc0FyZ3MgPSBzdHIgIT09ICdbb2JqZWN0IEFycmF5XScgJiZcblx0XHRcdHZhbHVlICE9PSBudWxsICYmXG5cdFx0XHR0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG5cdFx0XHR0eXBlb2YgdmFsdWUubGVuZ3RoID09PSAnbnVtYmVyJyAmJlxuXHRcdFx0dmFsdWUubGVuZ3RoID49IDAgJiZcblx0XHRcdHRvU3RyLmNhbGwodmFsdWUuY2FsbGVlKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblx0fVxuXHRyZXR1cm4gaXNBcmdzO1xufTtcbiIsIi8vIC5kaXJuYW1lLCAuYmFzZW5hbWUsIGFuZCAuZXh0bmFtZSBtZXRob2RzIGFyZSBleHRyYWN0ZWQgZnJvbSBOb2RlLmpzIHY4LjExLjEsXG4vLyBiYWNrcG9ydGVkIGFuZCB0cmFuc3BsaXRlZCB3aXRoIEJhYmVsLCB3aXRoIGJhY2t3YXJkcy1jb21wYXQgZml4ZXNcblxuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIHJlc29sdmVzIC4gYW5kIC4uIGVsZW1lbnRzIGluIGEgcGF0aCBhcnJheSB3aXRoIGRpcmVjdG9yeSBuYW1lcyB0aGVyZVxuLy8gbXVzdCBiZSBubyBzbGFzaGVzLCBlbXB0eSBlbGVtZW50cywgb3IgZGV2aWNlIG5hbWVzIChjOlxcKSBpbiB0aGUgYXJyYXlcbi8vIChzbyBhbHNvIG5vIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoZXMgLSBpdCBkb2VzIG5vdCBkaXN0aW5ndWlzaFxuLy8gcmVsYXRpdmUgYW5kIGFic29sdXRlIHBhdGhzKVxuZnVuY3Rpb24gbm9ybWFsaXplQXJyYXkocGFydHMsIGFsbG93QWJvdmVSb290KSB7XG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBwYXJ0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIHZhciBsYXN0ID0gcGFydHNbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBwYXJ0cy51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cztcbn1cblxuLy8gcGF0aC5yZXNvbHZlKFtmcm9tIC4uLl0sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gIHZhciByZXNvbHZlZFBhdGggPSAnJyxcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgIHZhciBwYXRoID0gKGkgPj0gMCkgPyBhcmd1bWVudHNbaV0gOiBwcm9jZXNzLmN3ZCgpO1xuXG4gICAgLy8gU2tpcCBlbXB0eSBhbmQgaW52YWxpZCBlbnRyaWVzXG4gICAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGgucmVzb2x2ZSBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9IGVsc2UgaWYgKCFwYXRoKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICByZXNvbHZlZFBhdGggPSBwYXRoICsgJy8nICsgcmVzb2x2ZWRQYXRoO1xuICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xuICB9XG5cbiAgLy8gQXQgdGhpcyBwb2ludCB0aGUgcGF0aCBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gYSBmdWxsIGFic29sdXRlIHBhdGgsIGJ1dFxuICAvLyBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKSBmYWlscylcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcmVzb2x2ZWRQYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHJlc29sdmVkUGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFyZXNvbHZlZEFic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgcmV0dXJuICgocmVzb2x2ZWRBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHJlc29sdmVkUGF0aCkgfHwgJy4nO1xufTtcblxuLy8gcGF0aC5ub3JtYWxpemUocGF0aClcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMubm9ybWFsaXplID0gZnVuY3Rpb24ocGF0aCkge1xuICB2YXIgaXNBYnNvbHV0ZSA9IGV4cG9ydHMuaXNBYnNvbHV0ZShwYXRoKSxcbiAgICAgIHRyYWlsaW5nU2xhc2ggPSBzdWJzdHIocGF0aCwgLTEpID09PSAnLyc7XG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFpc0Fic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgaWYgKCFwYXRoICYmICFpc0Fic29sdXRlKSB7XG4gICAgcGF0aCA9ICcuJztcbiAgfVxuICBpZiAocGF0aCAmJiB0cmFpbGluZ1NsYXNoKSB7XG4gICAgcGF0aCArPSAnLyc7XG4gIH1cblxuICByZXR1cm4gKGlzQWJzb2x1dGUgPyAnLycgOiAnJykgKyBwYXRoO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5pc0Fic29sdXRlID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuam9pbiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcGF0aHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICByZXR1cm4gZXhwb3J0cy5ub3JtYWxpemUoZmlsdGVyKHBhdGhzLCBmdW5jdGlvbihwLCBpbmRleCkge1xuICAgIGlmICh0eXBlb2YgcCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLmpvaW4gbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfVxuICAgIHJldHVybiBwO1xuICB9KS5qb2luKCcvJykpO1xufTtcblxuXG4vLyBwYXRoLnJlbGF0aXZlKGZyb20sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZWxhdGl2ZSA9IGZ1bmN0aW9uKGZyb20sIHRvKSB7XG4gIGZyb20gPSBleHBvcnRzLnJlc29sdmUoZnJvbSkuc3Vic3RyKDEpO1xuICB0byA9IGV4cG9ydHMucmVzb2x2ZSh0bykuc3Vic3RyKDEpO1xuXG4gIGZ1bmN0aW9uIHRyaW0oYXJyKSB7XG4gICAgdmFyIHN0YXJ0ID0gMDtcbiAgICBmb3IgKDsgc3RhcnQgPCBhcnIubGVuZ3RoOyBzdGFydCsrKSB7XG4gICAgICBpZiAoYXJyW3N0YXJ0XSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIHZhciBlbmQgPSBhcnIubGVuZ3RoIC0gMTtcbiAgICBmb3IgKDsgZW5kID49IDA7IGVuZC0tKSB7XG4gICAgICBpZiAoYXJyW2VuZF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPiBlbmQpIHJldHVybiBbXTtcbiAgICByZXR1cm4gYXJyLnNsaWNlKHN0YXJ0LCBlbmQgLSBzdGFydCArIDEpO1xuICB9XG5cbiAgdmFyIGZyb21QYXJ0cyA9IHRyaW0oZnJvbS5zcGxpdCgnLycpKTtcbiAgdmFyIHRvUGFydHMgPSB0cmltKHRvLnNwbGl0KCcvJykpO1xuXG4gIHZhciBsZW5ndGggPSBNYXRoLm1pbihmcm9tUGFydHMubGVuZ3RoLCB0b1BhcnRzLmxlbmd0aCk7XG4gIHZhciBzYW1lUGFydHNMZW5ndGggPSBsZW5ndGg7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoZnJvbVBhcnRzW2ldICE9PSB0b1BhcnRzW2ldKSB7XG4gICAgICBzYW1lUGFydHNMZW5ndGggPSBpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdmFyIG91dHB1dFBhcnRzID0gW107XG4gIGZvciAodmFyIGkgPSBzYW1lUGFydHNMZW5ndGg7IGkgPCBmcm9tUGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICBvdXRwdXRQYXJ0cy5wdXNoKCcuLicpO1xuICB9XG5cbiAgb3V0cHV0UGFydHMgPSBvdXRwdXRQYXJ0cy5jb25jYXQodG9QYXJ0cy5zbGljZShzYW1lUGFydHNMZW5ndGgpKTtcblxuICByZXR1cm4gb3V0cHV0UGFydHMuam9pbignLycpO1xufTtcblxuZXhwb3J0cy5zZXAgPSAnLyc7XG5leHBvcnRzLmRlbGltaXRlciA9ICc6JztcblxuZXhwb3J0cy5kaXJuYW1lID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykgcGF0aCA9IHBhdGggKyAnJztcbiAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSByZXR1cm4gJy4nO1xuICB2YXIgY29kZSA9IHBhdGguY2hhckNvZGVBdCgwKTtcbiAgdmFyIGhhc1Jvb3QgPSBjb2RlID09PSA0NyAvKi8qLztcbiAgdmFyIGVuZCA9IC0xO1xuICB2YXIgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgZm9yICh2YXIgaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSAxOyAtLWkpIHtcbiAgICBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgIGlmIChjb2RlID09PSA0NyAvKi8qLykge1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIGVuZCA9IGk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvclxuICAgICAgbWF0Y2hlZFNsYXNoID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaWYgKGVuZCA9PT0gLTEpIHJldHVybiBoYXNSb290ID8gJy8nIDogJy4nO1xuICBpZiAoaGFzUm9vdCAmJiBlbmQgPT09IDEpIHtcbiAgICAvLyByZXR1cm4gJy8vJztcbiAgICAvLyBCYWNrd2FyZHMtY29tcGF0IGZpeDpcbiAgICByZXR1cm4gJy8nO1xuICB9XG4gIHJldHVybiBwYXRoLnNsaWNlKDAsIGVuZCk7XG59O1xuXG5mdW5jdGlvbiBiYXNlbmFtZShwYXRoKSB7XG4gIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHBhdGggPSBwYXRoICsgJyc7XG5cbiAgdmFyIHN0YXJ0ID0gMDtcbiAgdmFyIGVuZCA9IC0xO1xuICB2YXIgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgdmFyIGk7XG5cbiAgZm9yIChpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgIGlmIChwYXRoLmNoYXJDb2RlQXQoaSkgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgIC8vIHNlcGFyYXRvcnMgYXQgdGhlIGVuZCBvZiB0aGUgc3RyaW5nLCBzdG9wIG5vd1xuICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZW5kID09PSAtMSkge1xuICAgICAgLy8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3IsIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91clxuICAgICAgLy8gcGF0aCBjb21wb25lbnRcbiAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgZW5kID0gaSArIDE7XG4gICAgfVxuICB9XG5cbiAgaWYgKGVuZCA9PT0gLTEpIHJldHVybiAnJztcbiAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnQsIGVuZCk7XG59XG5cbi8vIFVzZXMgYSBtaXhlZCBhcHByb2FjaCBmb3IgYmFja3dhcmRzLWNvbXBhdGliaWxpdHksIGFzIGV4dCBiZWhhdmlvciBjaGFuZ2VkXG4vLyBpbiBuZXcgTm9kZS5qcyB2ZXJzaW9ucywgc28gb25seSBiYXNlbmFtZSgpIGFib3ZlIGlzIGJhY2twb3J0ZWQgaGVyZVxuZXhwb3J0cy5iYXNlbmFtZSA9IGZ1bmN0aW9uIChwYXRoLCBleHQpIHtcbiAgdmFyIGYgPSBiYXNlbmFtZShwYXRoKTtcbiAgaWYgKGV4dCAmJiBmLnN1YnN0cigtMSAqIGV4dC5sZW5ndGgpID09PSBleHQpIHtcbiAgICBmID0gZi5zdWJzdHIoMCwgZi5sZW5ndGggLSBleHQubGVuZ3RoKTtcbiAgfVxuICByZXR1cm4gZjtcbn07XG5cbmV4cG9ydHMuZXh0bmFtZSA9IGZ1bmN0aW9uIChwYXRoKSB7XG4gIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHBhdGggPSBwYXRoICsgJyc7XG4gIHZhciBzdGFydERvdCA9IC0xO1xuICB2YXIgc3RhcnRQYXJ0ID0gMDtcbiAgdmFyIGVuZCA9IC0xO1xuICB2YXIgbWF0Y2hlZFNsYXNoID0gdHJ1ZTtcbiAgLy8gVHJhY2sgdGhlIHN0YXRlIG9mIGNoYXJhY3RlcnMgKGlmIGFueSkgd2Ugc2VlIGJlZm9yZSBvdXIgZmlyc3QgZG90IGFuZFxuICAvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuICB2YXIgcHJlRG90U3RhdGUgPSAwO1xuICBmb3IgKHZhciBpID0gcGF0aC5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgIHZhciBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgIGlmIChjb2RlID09PSA0NyAvKi8qLykge1xuICAgICAgICAvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuICAgICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgICAgaWYgKCFtYXRjaGVkU2xhc2gpIHtcbiAgICAgICAgICBzdGFydFBhcnQgPSBpICsgMTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICBpZiAoZW5kID09PSAtMSkge1xuICAgICAgLy8gV2Ugc2F3IHRoZSBmaXJzdCBub24tcGF0aCBzZXBhcmF0b3IsIG1hcmsgdGhpcyBhcyB0aGUgZW5kIG9mIG91clxuICAgICAgLy8gZXh0ZW5zaW9uXG4gICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgIGVuZCA9IGkgKyAxO1xuICAgIH1cbiAgICBpZiAoY29kZSA9PT0gNDYgLyouKi8pIHtcbiAgICAgICAgLy8gSWYgdGhpcyBpcyBvdXIgZmlyc3QgZG90LCBtYXJrIGl0IGFzIHRoZSBzdGFydCBvZiBvdXIgZXh0ZW5zaW9uXG4gICAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpXG4gICAgICAgICAgc3RhcnREb3QgPSBpO1xuICAgICAgICBlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSlcbiAgICAgICAgICBwcmVEb3RTdGF0ZSA9IDE7XG4gICAgfSBlbHNlIGlmIChzdGFydERvdCAhPT0gLTEpIHtcbiAgICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgYW5kIG5vbi1wYXRoIHNlcGFyYXRvciBiZWZvcmUgb3VyIGRvdCwgc28gd2Ugc2hvdWxkXG4gICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgcHJlRG90U3RhdGUgPSAtMTtcbiAgICB9XG4gIH1cblxuICBpZiAoc3RhcnREb3QgPT09IC0xIHx8IGVuZCA9PT0gLTEgfHxcbiAgICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG4gICAgICBwcmVEb3RTdGF0ZSA9PT0gMCB8fFxuICAgICAgLy8gVGhlIChyaWdodC1tb3N0KSB0cmltbWVkIHBhdGggY29tcG9uZW50IGlzIGV4YWN0bHkgJy4uJ1xuICAgICAgcHJlRG90U3RhdGUgPT09IDEgJiYgc3RhcnREb3QgPT09IGVuZCAtIDEgJiYgc3RhcnREb3QgPT09IHN0YXJ0UGFydCArIDEpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG59O1xuXG5mdW5jdGlvbiBmaWx0ZXIgKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZpbHRlcikgcmV0dXJuIHhzLmZpbHRlcihmKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoZih4c1tpXSwgaSwgeHMpKSByZXMucHVzaCh4c1tpXSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbi8vIFN0cmluZy5wcm90b3R5cGUuc3Vic3RyIC0gbmVnYXRpdmUgaW5kZXggZG9uJ3Qgd29yayBpbiBJRThcbnZhciBzdWJzdHIgPSAnYWInLnN1YnN0cigtMSkgPT09ICdiJ1xuICAgID8gZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikgeyByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKSB9XG4gICAgOiBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7XG4gICAgICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gc3RyLmxlbmd0aCArIHN0YXJ0O1xuICAgICAgICByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKTtcbiAgICB9XG47XG4iLCJmdW5jdGlvbiBmaW5kQ2hpbGRzRXhwb3NlZEJveChjaGlsZCl7XG4gICAgdmFyIGNoaWxkV2luZG93ID0gKGNoaWxkLm93bmVyRG9jdW1lbnQgfHwgY2hpbGQpLmRlZmF1bHRWaWV3LFxuICAgICAgICBjaGlsZERvY3VtZW50ID0gY2hpbGQub3duZXJEb2N1bWVudCB8fCBjaGlsZCxcbiAgICAgICAgb3JpZ2luYWxCb3VuZHMgPSBjaGlsZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgcGFyZW50ID0gY2hpbGQucGFyZW50Tm9kZSxcbiAgICAgICAgcGFyZW50T3ZlcmZsb3csXG4gICAgICAgIHBhcmVudEJvdW5kcyxcbiAgICAgICAgYm91bmRzO1xuXG4gICAgLy8gQ29udmVydCBib3VuZHMgb2JqZWN0IHRvIHBvam8uXG4gICAgYm91bmRzID0ge1xuICAgICAgICBvcmlnaW5hbDogb3JpZ2luYWxCb3VuZHMsXG4gICAgICAgIGhlaWdodDogb3JpZ2luYWxCb3VuZHMuaGVpZ2h0LFxuICAgICAgICB3aWR0aDogb3JpZ2luYWxCb3VuZHMud2lkdGgsXG4gICAgICAgIGxlZnQ6IG9yaWdpbmFsQm91bmRzLmxlZnQsXG4gICAgICAgIHRvcDogb3JpZ2luYWxCb3VuZHMudG9wLFxuICAgICAgICByaWdodDogb3JpZ2luYWxCb3VuZHMucmlnaHQsXG4gICAgICAgIGJvdHRvbTogb3JpZ2luYWxCb3VuZHMuYm90dG9tXG4gICAgfTtcblxuICAgIHdoaWxlKHBhcmVudCl7XG4gICAgICAgIGlmKHBhcmVudCA9PT0gY2hpbGREb2N1bWVudCl7XG4gICAgICAgICAgICBwYXJlbnRCb3VuZHMgPSB7XG4gICAgICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgICAgIGxlZnQ6IDAsXG4gICAgICAgICAgICAgICAgYm90dG9tOiBjaGlsZFdpbmRvdy5pbm5lckhlaWdodCxcbiAgICAgICAgICAgICAgICByaWdodDogY2hpbGRXaW5kb3cuaW5uZXJXaWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IGNoaWxkV2luZG93LmlubmVySGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiBjaGlsZFdpbmRvdy5pbm5lcldpZHRoXG4gICAgICAgICAgICB9O1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHZhciBwYXJlbnRPdmVyZmxvdyA9IGNoaWxkV2luZG93LmdldENvbXB1dGVkU3R5bGUocGFyZW50KS5vdmVyZmxvdztcbiAgICAgICAgICAgIGlmKHBhcmVudE92ZXJmbG93ID09PSAnJyB8fCBwYXJlbnRPdmVyZmxvdyA9PT0gJ3Zpc2libGUnKXtcbiAgICAgICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhcmVudEJvdW5kcyA9IHBhcmVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHBhcmVudEJvdW5kcy50b3AgPiBib3VuZHMudG9wKXtcbiAgICAgICAgICAgIGJvdW5kcy5oZWlnaHQgPSBib3VuZHMuaGVpZ2h0IC0gKHBhcmVudEJvdW5kcy50b3AgLSBib3VuZHMudG9wKTtcbiAgICAgICAgICAgIGJvdW5kcy50b3AgPSBwYXJlbnRCb3VuZHMudG9wO1xuICAgICAgICB9XG4gICAgICAgIGlmKHBhcmVudEJvdW5kcy5sZWZ0ID4gYm91bmRzLmxlZnQpe1xuICAgICAgICAgICAgYm91bmRzLndpZHRoID0gYm91bmRzLndpZHRoIC0gKHBhcmVudEJvdW5kcy5sZWZ0IC0gYm91bmRzLmxlZnQpO1xuICAgICAgICAgICAgYm91bmRzLmxlZnQgPSBwYXJlbnRCb3VuZHMubGVmdDtcbiAgICAgICAgfVxuICAgICAgICBpZihwYXJlbnRCb3VuZHMucmlnaHQgPCBib3VuZHMucmlnaHQpe1xuICAgICAgICAgICAgYm91bmRzLndpZHRoID0gYm91bmRzLndpZHRoIC0gKGJvdW5kcy5yaWdodCAtIHBhcmVudEJvdW5kcy5yaWdodCk7XG4gICAgICAgICAgICBib3VuZHMucmlnaHQgPSBwYXJlbnRCb3VuZHMucmlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYocGFyZW50Qm91bmRzLmJvdHRvbSA8IGJvdW5kcy5ib3R0b20pe1xuICAgICAgICAgICAgYm91bmRzLmhlaWdodCA9IGJvdW5kcy5oZWlnaHQgLSAoYm91bmRzLmJvdHRvbSAtIHBhcmVudEJvdW5kcy5ib3R0b20pO1xuICAgICAgICAgICAgYm91bmRzLmJvdHRvbSA9IHBhcmVudEJvdW5kcy5ib3R0b207XG4gICAgICAgIH1cblxuICAgICAgICBpZihib3VuZHMud2lkdGggPD0gMCB8fCBib3VuZHMuaGVpZ2h0IDw9IDApe1xuICAgICAgICAgICAgYm91bmRzLmhpZGRlbiA9IHRydWU7XG4gICAgICAgICAgICBib3VuZHMud2lkdGggPSBNYXRoLm1heChib3VuZHMud2lkdGgsIDApO1xuICAgICAgICAgICAgYm91bmRzLmhlaWdodCA9IE1hdGgubWF4KGJvdW5kcy5oZWlnaHQsIDApO1xuICAgICAgICAgICAgcmV0dXJuIGJvdW5kcztcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuICAgIH1cblxuICAgIHJldHVybiBib3VuZHM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZmluZENoaWxkc0V4cG9zZWRCb3g7IiwiJ3VzZSBzdHJpY3QnO1xuXG5pZiAoIXByb2Nlc3MudmVyc2lvbiB8fFxuICAgIHByb2Nlc3MudmVyc2lvbi5pbmRleE9mKCd2MC4nKSA9PT0gMCB8fFxuICAgIHByb2Nlc3MudmVyc2lvbi5pbmRleE9mKCd2MS4nKSA9PT0gMCAmJiBwcm9jZXNzLnZlcnNpb24uaW5kZXhPZigndjEuOC4nKSAhPT0gMCkge1xuICBtb2R1bGUuZXhwb3J0cyA9IHsgbmV4dFRpY2s6IG5leHRUaWNrIH07XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHByb2Nlc3Ncbn1cblxuZnVuY3Rpb24gbmV4dFRpY2soZm4sIGFyZzEsIGFyZzIsIGFyZzMpIHtcbiAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wiY2FsbGJhY2tcIiBhcmd1bWVudCBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgfVxuICB2YXIgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgdmFyIGFyZ3MsIGk7XG4gIHN3aXRjaCAobGVuKSB7XG4gIGNhc2UgMDpcbiAgY2FzZSAxOlxuICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZuKTtcbiAgY2FzZSAyOlxuICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uIGFmdGVyVGlja09uZSgpIHtcbiAgICAgIGZuLmNhbGwobnVsbCwgYXJnMSk7XG4gICAgfSk7XG4gIGNhc2UgMzpcbiAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiBhZnRlclRpY2tUd28oKSB7XG4gICAgICBmbi5jYWxsKG51bGwsIGFyZzEsIGFyZzIpO1xuICAgIH0pO1xuICBjYXNlIDQ6XG4gICAgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gYWZ0ZXJUaWNrVGhyZWUoKSB7XG4gICAgICBmbi5jYWxsKG51bGwsIGFyZzEsIGFyZzIsIGFyZzMpO1xuICAgIH0pO1xuICBkZWZhdWx0OlxuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgaSA9IDA7XG4gICAgd2hpbGUgKGkgPCBhcmdzLmxlbmd0aCkge1xuICAgICAgYXJnc1tpKytdID0gYXJndW1lbnRzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiBhZnRlclRpY2soKSB7XG4gICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9KTtcbiAgfVxufVxuXG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX2R1cGxleC5qcycpO1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIGEgZHVwbGV4IHN0cmVhbSBpcyBqdXN0IGEgc3RyZWFtIHRoYXQgaXMgYm90aCByZWFkYWJsZSBhbmQgd3JpdGFibGUuXG4vLyBTaW5jZSBKUyBkb2Vzbid0IGhhdmUgbXVsdGlwbGUgcHJvdG90eXBhbCBpbmhlcml0YW5jZSwgdGhpcyBjbGFzc1xuLy8gcHJvdG90eXBhbGx5IGluaGVyaXRzIGZyb20gUmVhZGFibGUsIGFuZCB0aGVuIHBhcmFzaXRpY2FsbHkgZnJvbVxuLy8gV3JpdGFibGUuXG5cbid1c2Ugc3RyaWN0JztcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cblxudmFyIHBuYSA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAga2V5cy5wdXNoKGtleSk7XG4gIH1yZXR1cm4ga2V5cztcbn07XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxubW9kdWxlLmV4cG9ydHMgPSBEdXBsZXg7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFJlYWRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3JlYWRhYmxlJyk7XG52YXIgV3JpdGFibGUgPSByZXF1aXJlKCcuL19zdHJlYW1fd3JpdGFibGUnKTtcblxudXRpbC5pbmhlcml0cyhEdXBsZXgsIFJlYWRhYmxlKTtcblxue1xuICAvLyBhdm9pZCBzY29wZSBjcmVlcCwgdGhlIGtleXMgYXJyYXkgY2FuIHRoZW4gYmUgY29sbGVjdGVkXG4gIHZhciBrZXlzID0gb2JqZWN0S2V5cyhXcml0YWJsZS5wcm90b3R5cGUpO1xuICBmb3IgKHZhciB2ID0gMDsgdiA8IGtleXMubGVuZ3RoOyB2KyspIHtcbiAgICB2YXIgbWV0aG9kID0ga2V5c1t2XTtcbiAgICBpZiAoIUR1cGxleC5wcm90b3R5cGVbbWV0aG9kXSkgRHVwbGV4LnByb3RvdHlwZVttZXRob2RdID0gV3JpdGFibGUucHJvdG90eXBlW21ldGhvZF07XG4gIH1cbn1cblxuZnVuY3Rpb24gRHVwbGV4KG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpIHJldHVybiBuZXcgRHVwbGV4KG9wdGlvbnMpO1xuXG4gIFJlYWRhYmxlLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gIFdyaXRhYmxlLmNhbGwodGhpcywgb3B0aW9ucyk7XG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5yZWFkYWJsZSA9PT0gZmFsc2UpIHRoaXMucmVhZGFibGUgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLndyaXRhYmxlID09PSBmYWxzZSkgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuXG4gIHRoaXMuYWxsb3dIYWxmT3BlbiA9IHRydWU7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuYWxsb3dIYWxmT3BlbiA9PT0gZmFsc2UpIHRoaXMuYWxsb3dIYWxmT3BlbiA9IGZhbHNlO1xuXG4gIHRoaXMub25jZSgnZW5kJywgb25lbmQpO1xufVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGV4LnByb3RvdHlwZSwgJ3dyaXRhYmxlSGlnaFdhdGVyTWFyaycsIHtcbiAgLy8gbWFraW5nIGl0IGV4cGxpY2l0IHRoaXMgcHJvcGVydHkgaXMgbm90IGVudW1lcmFibGVcbiAgLy8gYmVjYXVzZSBvdGhlcndpc2Ugc29tZSBwcm90b3R5cGUgbWFuaXB1bGF0aW9uIGluXG4gIC8vIHVzZXJsYW5kIHdpbGwgZmFpbFxuICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dyaXRhYmxlU3RhdGUuaGlnaFdhdGVyTWFyaztcbiAgfVxufSk7XG5cbi8vIHRoZSBuby1oYWxmLW9wZW4gZW5mb3JjZXJcbmZ1bmN0aW9uIG9uZW5kKCkge1xuICAvLyBpZiB3ZSBhbGxvdyBoYWxmLW9wZW4gc3RhdGUsIG9yIGlmIHRoZSB3cml0YWJsZSBzaWRlIGVuZGVkLFxuICAvLyB0aGVuIHdlJ3JlIG9rLlxuICBpZiAodGhpcy5hbGxvd0hhbGZPcGVuIHx8IHRoaXMuX3dyaXRhYmxlU3RhdGUuZW5kZWQpIHJldHVybjtcblxuICAvLyBubyBtb3JlIGRhdGEgY2FuIGJlIHdyaXR0ZW4uXG4gIC8vIEJ1dCBhbGxvdyBtb3JlIHdyaXRlcyB0byBoYXBwZW4gaW4gdGhpcyB0aWNrLlxuICBwbmEubmV4dFRpY2sob25FbmROVCwgdGhpcyk7XG59XG5cbmZ1bmN0aW9uIG9uRW5kTlQoc2VsZikge1xuICBzZWxmLmVuZCgpO1xufVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRHVwbGV4LnByb3RvdHlwZSwgJ2Rlc3Ryb3llZCcsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX3JlYWRhYmxlU3RhdGUgPT09IHVuZGVmaW5lZCB8fCB0aGlzLl93cml0YWJsZVN0YXRlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX3JlYWRhYmxlU3RhdGUuZGVzdHJveWVkICYmIHRoaXMuX3dyaXRhYmxlU3RhdGUuZGVzdHJveWVkO1xuICB9LFxuICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIC8vIHdlIGlnbm9yZSB0aGUgdmFsdWUgaWYgdGhlIHN0cmVhbVxuICAgIC8vIGhhcyBub3QgYmVlbiBpbml0aWFsaXplZCB5ZXRcbiAgICBpZiAodGhpcy5fcmVhZGFibGVTdGF0ZSA9PT0gdW5kZWZpbmVkIHx8IHRoaXMuX3dyaXRhYmxlU3RhdGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGJhY2t3YXJkIGNvbXBhdGliaWxpdHksIHRoZSB1c2VyIGlzIGV4cGxpY2l0bHlcbiAgICAvLyBtYW5hZ2luZyBkZXN0cm95ZWRcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlc3Ryb3llZCA9IHZhbHVlO1xuICAgIHRoaXMuX3dyaXRhYmxlU3RhdGUuZGVzdHJveWVkID0gdmFsdWU7XG4gIH1cbn0pO1xuXG5EdXBsZXgucHJvdG90eXBlLl9kZXN0cm95ID0gZnVuY3Rpb24gKGVyciwgY2IpIHtcbiAgdGhpcy5wdXNoKG51bGwpO1xuICB0aGlzLmVuZCgpO1xuXG4gIHBuYS5uZXh0VGljayhjYiwgZXJyKTtcbn07IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIGEgcGFzc3Rocm91Z2ggc3RyZWFtLlxuLy8gYmFzaWNhbGx5IGp1c3QgdGhlIG1vc3QgbWluaW1hbCBzb3J0IG9mIFRyYW5zZm9ybSBzdHJlYW0uXG4vLyBFdmVyeSB3cml0dGVuIGNodW5rIGdldHMgb3V0cHV0IGFzLWlzLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUGFzc1Rocm91Z2g7XG5cbnZhciBUcmFuc2Zvcm0gPSByZXF1aXJlKCcuL19zdHJlYW1fdHJhbnNmb3JtJyk7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudXRpbC5pbmhlcml0cyhQYXNzVGhyb3VnaCwgVHJhbnNmb3JtKTtcblxuZnVuY3Rpb24gUGFzc1Rocm91Z2gob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUGFzc1Rocm91Z2gpKSByZXR1cm4gbmV3IFBhc3NUaHJvdWdoKG9wdGlvbnMpO1xuXG4gIFRyYW5zZm9ybS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xufVxuXG5QYXNzVGhyb3VnaC5wcm90b3R5cGUuX3RyYW5zZm9ybSA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNiKG51bGwsIGNodW5rKTtcbn07IiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cblxudmFyIHBuYSA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxubW9kdWxlLmV4cG9ydHMgPSBSZWFkYWJsZTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgRHVwbGV4O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblJlYWRhYmxlLlJlYWRhYmxlU3RhdGUgPSBSZWFkYWJsZVN0YXRlO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIEVFID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG52YXIgRUVsaXN0ZW5lckNvdW50ID0gZnVuY3Rpb24gKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJzKHR5cGUpLmxlbmd0aDtcbn07XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBTdHJlYW0gPSByZXF1aXJlKCcuL2ludGVybmFsL3N0cmVhbXMvc3RyZWFtJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ3NhZmUtYnVmZmVyJykuQnVmZmVyO1xudmFyIE91clVpbnQ4QXJyYXkgPSBnbG9iYWwuVWludDhBcnJheSB8fCBmdW5jdGlvbiAoKSB7fTtcbmZ1bmN0aW9uIF91aW50OEFycmF5VG9CdWZmZXIoY2h1bmspIHtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGNodW5rKTtcbn1cbmZ1bmN0aW9uIF9pc1VpbnQ4QXJyYXkob2JqKSB7XG4gIHJldHVybiBCdWZmZXIuaXNCdWZmZXIob2JqKSB8fCBvYmogaW5zdGFuY2VvZiBPdXJVaW50OEFycmF5O1xufVxuXG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGRlYnVnVXRpbCA9IHJlcXVpcmUoJ3V0aWwnKTtcbnZhciBkZWJ1ZyA9IHZvaWQgMDtcbmlmIChkZWJ1Z1V0aWwgJiYgZGVidWdVdGlsLmRlYnVnbG9nKSB7XG4gIGRlYnVnID0gZGVidWdVdGlsLmRlYnVnbG9nKCdzdHJlYW0nKTtcbn0gZWxzZSB7XG4gIGRlYnVnID0gZnVuY3Rpb24gKCkge307XG59XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlckxpc3QgPSByZXF1aXJlKCcuL2ludGVybmFsL3N0cmVhbXMvQnVmZmVyTGlzdCcpO1xudmFyIGRlc3Ryb3lJbXBsID0gcmVxdWlyZSgnLi9pbnRlcm5hbC9zdHJlYW1zL2Rlc3Ryb3knKTtcbnZhciBTdHJpbmdEZWNvZGVyO1xuXG51dGlsLmluaGVyaXRzKFJlYWRhYmxlLCBTdHJlYW0pO1xuXG52YXIga1Byb3h5RXZlbnRzID0gWydlcnJvcicsICdjbG9zZScsICdkZXN0cm95JywgJ3BhdXNlJywgJ3Jlc3VtZSddO1xuXG5mdW5jdGlvbiBwcmVwZW5kTGlzdGVuZXIoZW1pdHRlciwgZXZlbnQsIGZuKSB7XG4gIC8vIFNhZGx5IHRoaXMgaXMgbm90IGNhY2hlYWJsZSBhcyBzb21lIGxpYnJhcmllcyBidW5kbGUgdGhlaXIgb3duXG4gIC8vIGV2ZW50IGVtaXR0ZXIgaW1wbGVtZW50YXRpb24gd2l0aCB0aGVtLlxuICBpZiAodHlwZW9mIGVtaXR0ZXIucHJlcGVuZExpc3RlbmVyID09PSAnZnVuY3Rpb24nKSByZXR1cm4gZW1pdHRlci5wcmVwZW5kTGlzdGVuZXIoZXZlbnQsIGZuKTtcblxuICAvLyBUaGlzIGlzIGEgaGFjayB0byBtYWtlIHN1cmUgdGhhdCBvdXIgZXJyb3IgaGFuZGxlciBpcyBhdHRhY2hlZCBiZWZvcmUgYW55XG4gIC8vIHVzZXJsYW5kIG9uZXMuICBORVZFUiBETyBUSElTLiBUaGlzIGlzIGhlcmUgb25seSBiZWNhdXNlIHRoaXMgY29kZSBuZWVkc1xuICAvLyB0byBjb250aW51ZSB0byB3b3JrIHdpdGggb2xkZXIgdmVyc2lvbnMgb2YgTm9kZS5qcyB0aGF0IGRvIG5vdCBpbmNsdWRlXG4gIC8vIHRoZSBwcmVwZW5kTGlzdGVuZXIoKSBtZXRob2QuIFRoZSBnb2FsIGlzIHRvIGV2ZW50dWFsbHkgcmVtb3ZlIHRoaXMgaGFjay5cbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1tldmVudF0pIGVtaXR0ZXIub24oZXZlbnQsIGZuKTtlbHNlIGlmIChpc0FycmF5KGVtaXR0ZXIuX2V2ZW50c1tldmVudF0pKSBlbWl0dGVyLl9ldmVudHNbZXZlbnRdLnVuc2hpZnQoZm4pO2Vsc2UgZW1pdHRlci5fZXZlbnRzW2V2ZW50XSA9IFtmbiwgZW1pdHRlci5fZXZlbnRzW2V2ZW50XV07XG59XG5cbmZ1bmN0aW9uIFJlYWRhYmxlU3RhdGUob3B0aW9ucywgc3RyZWFtKSB7XG4gIER1cGxleCA9IER1cGxleCB8fCByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgLy8gRHVwbGV4IHN0cmVhbXMgYXJlIGJvdGggcmVhZGFibGUgYW5kIHdyaXRhYmxlLCBidXQgc2hhcmVcbiAgLy8gdGhlIHNhbWUgb3B0aW9ucyBvYmplY3QuXG4gIC8vIEhvd2V2ZXIsIHNvbWUgY2FzZXMgcmVxdWlyZSBzZXR0aW5nIG9wdGlvbnMgdG8gZGlmZmVyZW50XG4gIC8vIHZhbHVlcyBmb3IgdGhlIHJlYWRhYmxlIGFuZCB0aGUgd3JpdGFibGUgc2lkZXMgb2YgdGhlIGR1cGxleCBzdHJlYW0uXG4gIC8vIFRoZXNlIG9wdGlvbnMgY2FuIGJlIHByb3ZpZGVkIHNlcGFyYXRlbHkgYXMgcmVhZGFibGVYWFggYW5kIHdyaXRhYmxlWFhYLlxuICB2YXIgaXNEdXBsZXggPSBzdHJlYW0gaW5zdGFuY2VvZiBEdXBsZXg7XG5cbiAgLy8gb2JqZWN0IHN0cmVhbSBmbGFnLiBVc2VkIHRvIG1ha2UgcmVhZChuKSBpZ25vcmUgbiBhbmQgdG9cbiAgLy8gbWFrZSBhbGwgdGhlIGJ1ZmZlciBtZXJnaW5nIGFuZCBsZW5ndGggY2hlY2tzIGdvIGF3YXlcbiAgdGhpcy5vYmplY3RNb2RlID0gISFvcHRpb25zLm9iamVjdE1vZGU7XG5cbiAgaWYgKGlzRHVwbGV4KSB0aGlzLm9iamVjdE1vZGUgPSB0aGlzLm9iamVjdE1vZGUgfHwgISFvcHRpb25zLnJlYWRhYmxlT2JqZWN0TW9kZTtcblxuICAvLyB0aGUgcG9pbnQgYXQgd2hpY2ggaXQgc3RvcHMgY2FsbGluZyBfcmVhZCgpIHRvIGZpbGwgdGhlIGJ1ZmZlclxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIFwiZG9uJ3QgY2FsbCBfcmVhZCBwcmVlbXB0aXZlbHkgZXZlclwiXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciByZWFkYWJsZUh3bSA9IG9wdGlvbnMucmVhZGFibGVIaWdoV2F0ZXJNYXJrO1xuICB2YXIgZGVmYXVsdEh3bSA9IHRoaXMub2JqZWN0TW9kZSA/IDE2IDogMTYgKiAxMDI0O1xuXG4gIGlmIChod20gfHwgaHdtID09PSAwKSB0aGlzLmhpZ2hXYXRlck1hcmsgPSBod207ZWxzZSBpZiAoaXNEdXBsZXggJiYgKHJlYWRhYmxlSHdtIHx8IHJlYWRhYmxlSHdtID09PSAwKSkgdGhpcy5oaWdoV2F0ZXJNYXJrID0gcmVhZGFibGVId207ZWxzZSB0aGlzLmhpZ2hXYXRlck1hcmsgPSBkZWZhdWx0SHdtO1xuXG4gIC8vIGNhc3QgdG8gaW50cy5cbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gTWF0aC5mbG9vcih0aGlzLmhpZ2hXYXRlck1hcmspO1xuXG4gIC8vIEEgbGlua2VkIGxpc3QgaXMgdXNlZCB0byBzdG9yZSBkYXRhIGNodW5rcyBpbnN0ZWFkIG9mIGFuIGFycmF5IGJlY2F1c2UgdGhlXG4gIC8vIGxpbmtlZCBsaXN0IGNhbiByZW1vdmUgZWxlbWVudHMgZnJvbSB0aGUgYmVnaW5uaW5nIGZhc3RlciB0aGFuXG4gIC8vIGFycmF5LnNoaWZ0KClcbiAgdGhpcy5idWZmZXIgPSBuZXcgQnVmZmVyTGlzdCgpO1xuICB0aGlzLmxlbmd0aCA9IDA7XG4gIHRoaXMucGlwZXMgPSBudWxsO1xuICB0aGlzLnBpcGVzQ291bnQgPSAwO1xuICB0aGlzLmZsb3dpbmcgPSBudWxsO1xuICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gIHRoaXMuZW5kRW1pdHRlZCA9IGZhbHNlO1xuICB0aGlzLnJlYWRpbmcgPSBmYWxzZTtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBldmVudCAncmVhZGFibGUnLydkYXRhJyBpcyBlbWl0dGVkXG4gIC8vIGltbWVkaWF0ZWx5LCBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlXG4gIC8vIGFueSBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCByZWFkIGNhbGwuXG4gIHRoaXMuc3luYyA9IHRydWU7XG5cbiAgLy8gd2hlbmV2ZXIgd2UgcmV0dXJuIG51bGwsIHRoZW4gd2Ugc2V0IGEgZmxhZyB0byBzYXlcbiAgLy8gdGhhdCB3ZSdyZSBhd2FpdGluZyBhICdyZWFkYWJsZScgZXZlbnQgZW1pc3Npb24uXG4gIHRoaXMubmVlZFJlYWRhYmxlID0gZmFsc2U7XG4gIHRoaXMuZW1pdHRlZFJlYWRhYmxlID0gZmFsc2U7XG4gIHRoaXMucmVhZGFibGVMaXN0ZW5pbmcgPSBmYWxzZTtcbiAgdGhpcy5yZXN1bWVTY2hlZHVsZWQgPSBmYWxzZTtcblxuICAvLyBoYXMgaXQgYmVlbiBkZXN0cm95ZWRcbiAgdGhpcy5kZXN0cm95ZWQgPSBmYWxzZTtcblxuICAvLyBDcnlwdG8gaXMga2luZCBvZiBvbGQgYW5kIGNydXN0eS4gIEhpc3RvcmljYWxseSwgaXRzIGRlZmF1bHQgc3RyaW5nXG4gIC8vIGVuY29kaW5nIGlzICdiaW5hcnknIHNvIHdlIGhhdmUgdG8gbWFrZSB0aGlzIGNvbmZpZ3VyYWJsZS5cbiAgLy8gRXZlcnl0aGluZyBlbHNlIGluIHRoZSB1bml2ZXJzZSB1c2VzICd1dGY4JywgdGhvdWdoLlxuICB0aGlzLmRlZmF1bHRFbmNvZGluZyA9IG9wdGlvbnMuZGVmYXVsdEVuY29kaW5nIHx8ICd1dGY4JztcblxuICAvLyB0aGUgbnVtYmVyIG9mIHdyaXRlcnMgdGhhdCBhcmUgYXdhaXRpbmcgYSBkcmFpbiBldmVudCBpbiAucGlwZSgpc1xuICB0aGlzLmF3YWl0RHJhaW4gPSAwO1xuXG4gIC8vIGlmIHRydWUsIGEgbWF5YmVSZWFkTW9yZSBoYXMgYmVlbiBzY2hlZHVsZWRcbiAgdGhpcy5yZWFkaW5nTW9yZSA9IGZhbHNlO1xuXG4gIHRoaXMuZGVjb2RlciA9IG51bGw7XG4gIHRoaXMuZW5jb2RpbmcgPSBudWxsO1xuICBpZiAob3B0aW9ucy5lbmNvZGluZykge1xuICAgIGlmICghU3RyaW5nRGVjb2RlcikgU3RyaW5nRGVjb2RlciA9IHJlcXVpcmUoJ3N0cmluZ19kZWNvZGVyLycpLlN0cmluZ0RlY29kZXI7XG4gICAgdGhpcy5kZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIob3B0aW9ucy5lbmNvZGluZyk7XG4gICAgdGhpcy5lbmNvZGluZyA9IG9wdGlvbnMuZW5jb2Rpbmc7XG4gIH1cbn1cblxuZnVuY3Rpb24gUmVhZGFibGUob3B0aW9ucykge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSZWFkYWJsZSkpIHJldHVybiBuZXcgUmVhZGFibGUob3B0aW9ucyk7XG5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZSA9IG5ldyBSZWFkYWJsZVN0YXRlKG9wdGlvbnMsIHRoaXMpO1xuXG4gIC8vIGxlZ2FjeVxuICB0aGlzLnJlYWRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5yZWFkID09PSAnZnVuY3Rpb24nKSB0aGlzLl9yZWFkID0gb3B0aW9ucy5yZWFkO1xuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmRlc3Ryb3kgPT09ICdmdW5jdGlvbicpIHRoaXMuX2Rlc3Ryb3kgPSBvcHRpb25zLmRlc3Ryb3k7XG4gIH1cblxuICBTdHJlYW0uY2FsbCh0aGlzKTtcbn1cblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlYWRhYmxlLnByb3RvdHlwZSwgJ2Rlc3Ryb3llZCcsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX3JlYWRhYmxlU3RhdGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fcmVhZGFibGVTdGF0ZS5kZXN0cm95ZWQ7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgLy8gd2UgaWdub3JlIHRoZSB2YWx1ZSBpZiB0aGUgc3RyZWFtXG4gICAgLy8gaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldFxuICAgIGlmICghdGhpcy5fcmVhZGFibGVTdGF0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGJhY2t3YXJkIGNvbXBhdGliaWxpdHksIHRoZSB1c2VyIGlzIGV4cGxpY2l0bHlcbiAgICAvLyBtYW5hZ2luZyBkZXN0cm95ZWRcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlc3Ryb3llZCA9IHZhbHVlO1xuICB9XG59KTtcblxuUmVhZGFibGUucHJvdG90eXBlLmRlc3Ryb3kgPSBkZXN0cm95SW1wbC5kZXN0cm95O1xuUmVhZGFibGUucHJvdG90eXBlLl91bmRlc3Ryb3kgPSBkZXN0cm95SW1wbC51bmRlc3Ryb3k7XG5SZWFkYWJsZS5wcm90b3R5cGUuX2Rlc3Ryb3kgPSBmdW5jdGlvbiAoZXJyLCBjYikge1xuICB0aGlzLnB1c2gobnVsbCk7XG4gIGNiKGVycik7XG59O1xuXG4vLyBNYW51YWxseSBzaG92ZSBzb21ldGhpbmcgaW50byB0aGUgcmVhZCgpIGJ1ZmZlci5cbi8vIFRoaXMgcmV0dXJucyB0cnVlIGlmIHRoZSBoaWdoV2F0ZXJNYXJrIGhhcyBub3QgYmVlbiBoaXQgeWV0LFxuLy8gc2ltaWxhciB0byBob3cgV3JpdGFibGUud3JpdGUoKSByZXR1cm5zIHRydWUgaWYgeW91IHNob3VsZFxuLy8gd3JpdGUoKSBzb21lIG1vcmUuXG5SZWFkYWJsZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgdmFyIHNraXBDaHVua0NoZWNrO1xuXG4gIGlmICghc3RhdGUub2JqZWN0TW9kZSkge1xuICAgIGlmICh0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IGVuY29kaW5nIHx8IHN0YXRlLmRlZmF1bHRFbmNvZGluZztcbiAgICAgIGlmIChlbmNvZGluZyAhPT0gc3RhdGUuZW5jb2RpbmcpIHtcbiAgICAgICAgY2h1bmsgPSBCdWZmZXIuZnJvbShjaHVuaywgZW5jb2RpbmcpO1xuICAgICAgICBlbmNvZGluZyA9ICcnO1xuICAgICAgfVxuICAgICAgc2tpcENodW5rQ2hlY2sgPSB0cnVlO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBza2lwQ2h1bmtDaGVjayA9IHRydWU7XG4gIH1cblxuICByZXR1cm4gcmVhZGFibGVBZGRDaHVuayh0aGlzLCBjaHVuaywgZW5jb2RpbmcsIGZhbHNlLCBza2lwQ2h1bmtDaGVjayk7XG59O1xuXG4vLyBVbnNoaWZ0IHNob3VsZCAqYWx3YXlzKiBiZSBzb21ldGhpbmcgZGlyZWN0bHkgb3V0IG9mIHJlYWQoKVxuUmVhZGFibGUucHJvdG90eXBlLnVuc2hpZnQgPSBmdW5jdGlvbiAoY2h1bmspIHtcbiAgcmV0dXJuIHJlYWRhYmxlQWRkQ2h1bmsodGhpcywgY2h1bmssIG51bGwsIHRydWUsIGZhbHNlKTtcbn07XG5cbmZ1bmN0aW9uIHJlYWRhYmxlQWRkQ2h1bmsoc3RyZWFtLCBjaHVuaywgZW5jb2RpbmcsIGFkZFRvRnJvbnQsIHNraXBDaHVua0NoZWNrKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZTtcbiAgaWYgKGNodW5rID09PSBudWxsKSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICAgIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGVyO1xuICAgIGlmICghc2tpcENodW5rQ2hlY2spIGVyID0gY2h1bmtJbnZhbGlkKHN0YXRlLCBjaHVuayk7XG4gICAgaWYgKGVyKSB7XG4gICAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gICAgfSBlbHNlIGlmIChzdGF0ZS5vYmplY3RNb2RlIHx8IGNodW5rICYmIGNodW5rLmxlbmd0aCA+IDApIHtcbiAgICAgIGlmICh0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnICYmICFzdGF0ZS5vYmplY3RNb2RlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihjaHVuaykgIT09IEJ1ZmZlci5wcm90b3R5cGUpIHtcbiAgICAgICAgY2h1bmsgPSBfdWludDhBcnJheVRvQnVmZmVyKGNodW5rKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGFkZFRvRnJvbnQpIHtcbiAgICAgICAgaWYgKHN0YXRlLmVuZEVtaXR0ZWQpIHN0cmVhbS5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignc3RyZWFtLnVuc2hpZnQoKSBhZnRlciBlbmQgZXZlbnQnKSk7ZWxzZSBhZGRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlLmVuZGVkKSB7XG4gICAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignc3RyZWFtLnB1c2goKSBhZnRlciBFT0YnKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG4gICAgICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFlbmNvZGluZykge1xuICAgICAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG4gICAgICAgICAgaWYgKHN0YXRlLm9iamVjdE1vZGUgfHwgY2h1bmsubGVuZ3RoICE9PSAwKSBhZGRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgZmFsc2UpO2Vsc2UgbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhZGRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghYWRkVG9Gcm9udCkge1xuICAgICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZWVkTW9yZURhdGEoc3RhdGUpO1xufVxuXG5mdW5jdGlvbiBhZGRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgYWRkVG9Gcm9udCkge1xuICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5sZW5ndGggPT09IDAgJiYgIXN0YXRlLnN5bmMpIHtcbiAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGNodW5rKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgfSBlbHNlIHtcbiAgICAvLyB1cGRhdGUgdGhlIGJ1ZmZlciBpbmZvLlxuICAgIHN0YXRlLmxlbmd0aCArPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcbiAgICBpZiAoYWRkVG9Gcm9udCkgc3RhdGUuYnVmZmVyLnVuc2hpZnQoY2h1bmspO2Vsc2Ugc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuXG4gICAgaWYgKHN0YXRlLm5lZWRSZWFkYWJsZSkgZW1pdFJlYWRhYmxlKHN0cmVhbSk7XG4gIH1cbiAgbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKTtcbn1cblxuZnVuY3Rpb24gY2h1bmtJbnZhbGlkKHN0YXRlLCBjaHVuaykge1xuICB2YXIgZXI7XG4gIGlmICghX2lzVWludDhBcnJheShjaHVuaykgJiYgdHlwZW9mIGNodW5rICE9PSAnc3RyaW5nJyAmJiBjaHVuayAhPT0gdW5kZWZpbmVkICYmICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgZXIgPSBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIG5vbi1zdHJpbmcvYnVmZmVyIGNodW5rJyk7XG4gIH1cbiAgcmV0dXJuIGVyO1xufVxuXG4vLyBpZiBpdCdzIHBhc3QgdGhlIGhpZ2ggd2F0ZXIgbWFyaywgd2UgY2FuIHB1c2ggaW4gc29tZSBtb3JlLlxuLy8gQWxzbywgaWYgd2UgaGF2ZSBubyBkYXRhIHlldCwgd2UgY2FuIHN0YW5kIHNvbWVcbi8vIG1vcmUgYnl0ZXMuICBUaGlzIGlzIHRvIHdvcmsgYXJvdW5kIGNhc2VzIHdoZXJlIGh3bT0wLFxuLy8gc3VjaCBhcyB0aGUgcmVwbC4gIEFsc28sIGlmIHRoZSBwdXNoKCkgdHJpZ2dlcmVkIGFcbi8vIHJlYWRhYmxlIGV2ZW50LCBhbmQgdGhlIHVzZXIgY2FsbGVkIHJlYWQobGFyZ2VOdW1iZXIpIHN1Y2ggdGhhdFxuLy8gbmVlZFJlYWRhYmxlIHdhcyBzZXQsIHRoZW4gd2Ugb3VnaHQgdG8gcHVzaCBtb3JlLCBzbyB0aGF0IGFub3RoZXJcbi8vICdyZWFkYWJsZScgZXZlbnQgd2lsbCBiZSB0cmlnZ2VyZWQuXG5mdW5jdGlvbiBuZWVkTW9yZURhdGEoc3RhdGUpIHtcbiAgcmV0dXJuICFzdGF0ZS5lbmRlZCAmJiAoc3RhdGUubmVlZFJlYWRhYmxlIHx8IHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcmsgfHwgc3RhdGUubGVuZ3RoID09PSAwKTtcbn1cblxuUmVhZGFibGUucHJvdG90eXBlLmlzUGF1c2VkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nID09PSBmYWxzZTtcbn07XG5cbi8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuUmVhZGFibGUucHJvdG90eXBlLnNldEVuY29kaW5nID0gZnVuY3Rpb24gKGVuYykge1xuICBpZiAoIVN0cmluZ0RlY29kZXIpIFN0cmluZ0RlY29kZXIgPSByZXF1aXJlKCdzdHJpbmdfZGVjb2Rlci8nKS5TdHJpbmdEZWNvZGVyO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihlbmMpO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmVuY29kaW5nID0gZW5jO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIERvbid0IHJhaXNlIHRoZSBod20gPiA4TUJcbnZhciBNQVhfSFdNID0gMHg4MDAwMDA7XG5mdW5jdGlvbiBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKSB7XG4gIGlmIChuID49IE1BWF9IV00pIHtcbiAgICBuID0gTUFYX0hXTTtcbiAgfSBlbHNlIHtcbiAgICAvLyBHZXQgdGhlIG5leHQgaGlnaGVzdCBwb3dlciBvZiAyIHRvIHByZXZlbnQgaW5jcmVhc2luZyBod20gZXhjZXNzaXZlbHkgaW5cbiAgICAvLyB0aW55IGFtb3VudHNcbiAgICBuLS07XG4gICAgbiB8PSBuID4+PiAxO1xuICAgIG4gfD0gbiA+Pj4gMjtcbiAgICBuIHw9IG4gPj4+IDQ7XG4gICAgbiB8PSBuID4+PiA4O1xuICAgIG4gfD0gbiA+Pj4gMTY7XG4gICAgbisrO1xuICB9XG4gIHJldHVybiBuO1xufVxuXG4vLyBUaGlzIGZ1bmN0aW9uIGlzIGRlc2lnbmVkIHRvIGJlIGlubGluYWJsZSwgc28gcGxlYXNlIHRha2UgY2FyZSB3aGVuIG1ha2luZ1xuLy8gY2hhbmdlcyB0byB0aGUgZnVuY3Rpb24gYm9keS5cbmZ1bmN0aW9uIGhvd011Y2hUb1JlYWQobiwgc3RhdGUpIHtcbiAgaWYgKG4gPD0gMCB8fCBzdGF0ZS5sZW5ndGggPT09IDAgJiYgc3RhdGUuZW5kZWQpIHJldHVybiAwO1xuICBpZiAoc3RhdGUub2JqZWN0TW9kZSkgcmV0dXJuIDE7XG4gIGlmIChuICE9PSBuKSB7XG4gICAgLy8gT25seSBmbG93IG9uZSBidWZmZXIgYXQgYSB0aW1lXG4gICAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgc3RhdGUubGVuZ3RoKSByZXR1cm4gc3RhdGUuYnVmZmVyLmhlYWQuZGF0YS5sZW5ndGg7ZWxzZSByZXR1cm4gc3RhdGUubGVuZ3RoO1xuICB9XG4gIC8vIElmIHdlJ3JlIGFza2luZyBmb3IgbW9yZSB0aGFuIHRoZSBjdXJyZW50IGh3bSwgdGhlbiByYWlzZSB0aGUgaHdtLlxuICBpZiAobiA+IHN0YXRlLmhpZ2hXYXRlck1hcmspIHN0YXRlLmhpZ2hXYXRlck1hcmsgPSBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKTtcbiAgaWYgKG4gPD0gc3RhdGUubGVuZ3RoKSByZXR1cm4gbjtcbiAgLy8gRG9uJ3QgaGF2ZSBlbm91Z2hcbiAgaWYgKCFzdGF0ZS5lbmRlZCkge1xuICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgcmV0dXJuIDA7XG4gIH1cbiAgcmV0dXJuIHN0YXRlLmxlbmd0aDtcbn1cblxuLy8geW91IGNhbiBvdmVycmlkZSBlaXRoZXIgdGhpcyBtZXRob2QsIG9yIHRoZSBhc3luYyBfcmVhZChuKSBiZWxvdy5cblJlYWRhYmxlLnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24gKG4pIHtcbiAgZGVidWcoJ3JlYWQnLCBuKTtcbiAgbiA9IHBhcnNlSW50KG4sIDEwKTtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgdmFyIG5PcmlnID0gbjtcblxuICBpZiAobiAhPT0gMCkgc3RhdGUuZW1pdHRlZFJlYWRhYmxlID0gZmFsc2U7XG5cbiAgLy8gaWYgd2UncmUgZG9pbmcgcmVhZCgwKSB0byB0cmlnZ2VyIGEgcmVhZGFibGUgZXZlbnQsIGJ1dCB3ZVxuICAvLyBhbHJlYWR5IGhhdmUgYSBidW5jaCBvZiBkYXRhIGluIHRoZSBidWZmZXIsIHRoZW4ganVzdCB0cmlnZ2VyXG4gIC8vIHRoZSAncmVhZGFibGUnIGV2ZW50IGFuZCBtb3ZlIG9uLlxuICBpZiAobiA9PT0gMCAmJiBzdGF0ZS5uZWVkUmVhZGFibGUgJiYgKHN0YXRlLmxlbmd0aCA+PSBzdGF0ZS5oaWdoV2F0ZXJNYXJrIHx8IHN0YXRlLmVuZGVkKSkge1xuICAgIGRlYnVnKCdyZWFkOiBlbWl0UmVhZGFibGUnLCBzdGF0ZS5sZW5ndGgsIHN0YXRlLmVuZGVkKTtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLmVuZGVkKSBlbmRSZWFkYWJsZSh0aGlzKTtlbHNlIGVtaXRSZWFkYWJsZSh0aGlzKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIG4gPSBob3dNdWNoVG9SZWFkKG4sIHN0YXRlKTtcblxuICAvLyBpZiB3ZSd2ZSBlbmRlZCwgYW5kIHdlJ3JlIG5vdyBjbGVhciwgdGhlbiBmaW5pc2ggaXQgdXAuXG4gIGlmIChuID09PSAwICYmIHN0YXRlLmVuZGVkKSB7XG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCkgZW5kUmVhZGFibGUodGhpcyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBBbGwgdGhlIGFjdHVhbCBjaHVuayBnZW5lcmF0aW9uIGxvZ2ljIG5lZWRzIHRvIGJlXG4gIC8vICpiZWxvdyogdGhlIGNhbGwgdG8gX3JlYWQuICBUaGUgcmVhc29uIGlzIHRoYXQgaW4gY2VydGFpblxuICAvLyBzeW50aGV0aWMgc3RyZWFtIGNhc2VzLCBzdWNoIGFzIHBhc3N0aHJvdWdoIHN0cmVhbXMsIF9yZWFkXG4gIC8vIG1heSBiZSBhIGNvbXBsZXRlbHkgc3luY2hyb25vdXMgb3BlcmF0aW9uIHdoaWNoIG1heSBjaGFuZ2VcbiAgLy8gdGhlIHN0YXRlIG9mIHRoZSByZWFkIGJ1ZmZlciwgcHJvdmlkaW5nIGVub3VnaCBkYXRhIHdoZW5cbiAgLy8gYmVmb3JlIHRoZXJlIHdhcyAqbm90KiBlbm91Z2guXG4gIC8vXG4gIC8vIFNvLCB0aGUgc3RlcHMgYXJlOlxuICAvLyAxLiBGaWd1cmUgb3V0IHdoYXQgdGhlIHN0YXRlIG9mIHRoaW5ncyB3aWxsIGJlIGFmdGVyIHdlIGRvXG4gIC8vIGEgcmVhZCBmcm9tIHRoZSBidWZmZXIuXG4gIC8vXG4gIC8vIDIuIElmIHRoYXQgcmVzdWx0aW5nIHN0YXRlIHdpbGwgdHJpZ2dlciBhIF9yZWFkLCB0aGVuIGNhbGwgX3JlYWQuXG4gIC8vIE5vdGUgdGhhdCB0aGlzIG1heSBiZSBhc3luY2hyb25vdXMsIG9yIHN5bmNocm9ub3VzLiAgWWVzLCBpdCBpc1xuICAvLyBkZWVwbHkgdWdseSB0byB3cml0ZSBBUElzIHRoaXMgd2F5LCBidXQgdGhhdCBzdGlsbCBkb2Vzbid0IG1lYW5cbiAgLy8gdGhhdCB0aGUgUmVhZGFibGUgY2xhc3Mgc2hvdWxkIGJlaGF2ZSBpbXByb3Blcmx5LCBhcyBzdHJlYW1zIGFyZVxuICAvLyBkZXNpZ25lZCB0byBiZSBzeW5jL2FzeW5jIGFnbm9zdGljLlxuICAvLyBUYWtlIG5vdGUgaWYgdGhlIF9yZWFkIGNhbGwgaXMgc3luYyBvciBhc3luYyAoaWUsIGlmIHRoZSByZWFkIGNhbGxcbiAgLy8gaGFzIHJldHVybmVkIHlldCksIHNvIHRoYXQgd2Uga25vdyB3aGV0aGVyIG9yIG5vdCBpdCdzIHNhZmUgdG8gZW1pdFxuICAvLyAncmVhZGFibGUnIGV0Yy5cbiAgLy9cbiAgLy8gMy4gQWN0dWFsbHkgcHVsbCB0aGUgcmVxdWVzdGVkIGNodW5rcyBvdXQgb2YgdGhlIGJ1ZmZlciBhbmQgcmV0dXJuLlxuXG4gIC8vIGlmIHdlIG5lZWQgYSByZWFkYWJsZSBldmVudCwgdGhlbiB3ZSBuZWVkIHRvIGRvIHNvbWUgcmVhZGluZy5cbiAgdmFyIGRvUmVhZCA9IHN0YXRlLm5lZWRSZWFkYWJsZTtcbiAgZGVidWcoJ25lZWQgcmVhZGFibGUnLCBkb1JlYWQpO1xuXG4gIC8vIGlmIHdlIGN1cnJlbnRseSBoYXZlIGxlc3MgdGhhbiB0aGUgaGlnaFdhdGVyTWFyaywgdGhlbiBhbHNvIHJlYWQgc29tZVxuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwIHx8IHN0YXRlLmxlbmd0aCAtIG4gPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgZG9SZWFkID0gdHJ1ZTtcbiAgICBkZWJ1ZygnbGVuZ3RoIGxlc3MgdGhhbiB3YXRlcm1hcmsnLCBkb1JlYWQpO1xuICB9XG5cbiAgLy8gaG93ZXZlciwgaWYgd2UndmUgZW5kZWQsIHRoZW4gdGhlcmUncyBubyBwb2ludCwgYW5kIGlmIHdlJ3JlIGFscmVhZHlcbiAgLy8gcmVhZGluZywgdGhlbiBpdCdzIHVubmVjZXNzYXJ5LlxuICBpZiAoc3RhdGUuZW5kZWQgfHwgc3RhdGUucmVhZGluZykge1xuICAgIGRvUmVhZCA9IGZhbHNlO1xuICAgIGRlYnVnKCdyZWFkaW5nIG9yIGVuZGVkJywgZG9SZWFkKTtcbiAgfSBlbHNlIGlmIChkb1JlYWQpIHtcbiAgICBkZWJ1ZygnZG8gcmVhZCcpO1xuICAgIHN0YXRlLnJlYWRpbmcgPSB0cnVlO1xuICAgIHN0YXRlLnN5bmMgPSB0cnVlO1xuICAgIC8vIGlmIHRoZSBsZW5ndGggaXMgY3VycmVudGx5IHplcm8sIHRoZW4gd2UgKm5lZWQqIGEgcmVhZGFibGUgZXZlbnQuXG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCkgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAvLyBjYWxsIGludGVybmFsIHJlYWQgbWV0aG9kXG4gICAgdGhpcy5fcmVhZChzdGF0ZS5oaWdoV2F0ZXJNYXJrKTtcbiAgICBzdGF0ZS5zeW5jID0gZmFsc2U7XG4gICAgLy8gSWYgX3JlYWQgcHVzaGVkIGRhdGEgc3luY2hyb25vdXNseSwgdGhlbiBgcmVhZGluZ2Agd2lsbCBiZSBmYWxzZSxcbiAgICAvLyBhbmQgd2UgbmVlZCB0byByZS1ldmFsdWF0ZSBob3cgbXVjaCBkYXRhIHdlIGNhbiByZXR1cm4gdG8gdGhlIHVzZXIuXG4gICAgaWYgKCFzdGF0ZS5yZWFkaW5nKSBuID0gaG93TXVjaFRvUmVhZChuT3JpZywgc3RhdGUpO1xuICB9XG5cbiAgdmFyIHJldDtcbiAgaWYgKG4gPiAwKSByZXQgPSBmcm9tTGlzdChuLCBzdGF0ZSk7ZWxzZSByZXQgPSBudWxsO1xuXG4gIGlmIChyZXQgPT09IG51bGwpIHtcbiAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIG4gPSAwO1xuICB9IGVsc2Uge1xuICAgIHN0YXRlLmxlbmd0aCAtPSBuO1xuICB9XG5cbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIElmIHdlIGhhdmUgbm90aGluZyBpbiB0aGUgYnVmZmVyLCB0aGVuIHdlIHdhbnQgdG8ga25vd1xuICAgIC8vIGFzIHNvb24gYXMgd2UgKmRvKiBnZXQgc29tZXRoaW5nIGludG8gdGhlIGJ1ZmZlci5cbiAgICBpZiAoIXN0YXRlLmVuZGVkKSBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuXG4gICAgLy8gSWYgd2UgdHJpZWQgdG8gcmVhZCgpIHBhc3QgdGhlIEVPRiwgdGhlbiBlbWl0IGVuZCBvbiB0aGUgbmV4dCB0aWNrLlxuICAgIGlmIChuT3JpZyAhPT0gbiAmJiBzdGF0ZS5lbmRlZCkgZW5kUmVhZGFibGUodGhpcyk7XG4gIH1cblxuICBpZiAocmV0ICE9PSBudWxsKSB0aGlzLmVtaXQoJ2RhdGEnLCByZXQpO1xuXG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBvbkVvZkNodW5rKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmVuZGVkKSByZXR1cm47XG4gIGlmIChzdGF0ZS5kZWNvZGVyKSB7XG4gICAgdmFyIGNodW5rID0gc3RhdGUuZGVjb2Rlci5lbmQoKTtcbiAgICBpZiAoY2h1bmsgJiYgY2h1bmsubGVuZ3RoKSB7XG4gICAgICBzdGF0ZS5idWZmZXIucHVzaChjaHVuayk7XG4gICAgICBzdGF0ZS5sZW5ndGggKz0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG4gICAgfVxuICB9XG4gIHN0YXRlLmVuZGVkID0gdHJ1ZTtcblxuICAvLyBlbWl0ICdyZWFkYWJsZScgbm93IHRvIG1ha2Ugc3VyZSBpdCBnZXRzIHBpY2tlZCB1cC5cbiAgZW1pdFJlYWRhYmxlKHN0cmVhbSk7XG59XG5cbi8vIERvbid0IGVtaXQgcmVhZGFibGUgcmlnaHQgYXdheSBpbiBzeW5jIG1vZGUsIGJlY2F1c2UgdGhpcyBjYW4gdHJpZ2dlclxuLy8gYW5vdGhlciByZWFkKCkgY2FsbCA9PiBzdGFjayBvdmVyZmxvdy4gIFRoaXMgd2F5LCBpdCBtaWdodCB0cmlnZ2VyXG4vLyBhIG5leHRUaWNrIHJlY3Vyc2lvbiB3YXJuaW5nLCBidXQgdGhhdCdzIG5vdCBzbyBiYWQuXG5mdW5jdGlvbiBlbWl0UmVhZGFibGUoc3RyZWFtKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZTtcbiAgc3RhdGUubmVlZFJlYWRhYmxlID0gZmFsc2U7XG4gIGlmICghc3RhdGUuZW1pdHRlZFJlYWRhYmxlKSB7XG4gICAgZGVidWcoJ2VtaXRSZWFkYWJsZScsIHN0YXRlLmZsb3dpbmcpO1xuICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgaWYgKHN0YXRlLnN5bmMpIHBuYS5uZXh0VGljayhlbWl0UmVhZGFibGVfLCBzdHJlYW0pO2Vsc2UgZW1pdFJlYWRhYmxlXyhzdHJlYW0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXRSZWFkYWJsZV8oc3RyZWFtKSB7XG4gIGRlYnVnKCdlbWl0IHJlYWRhYmxlJyk7XG4gIHN0cmVhbS5lbWl0KCdyZWFkYWJsZScpO1xuICBmbG93KHN0cmVhbSk7XG59XG5cbi8vIGF0IHRoaXMgcG9pbnQsIHRoZSB1c2VyIGhhcyBwcmVzdW1hYmx5IHNlZW4gdGhlICdyZWFkYWJsZScgZXZlbnQsXG4vLyBhbmQgY2FsbGVkIHJlYWQoKSB0byBjb25zdW1lIHNvbWUgZGF0YS4gIHRoYXQgbWF5IGhhdmUgdHJpZ2dlcmVkXG4vLyBpbiB0dXJuIGFub3RoZXIgX3JlYWQobikgY2FsbCwgaW4gd2hpY2ggY2FzZSByZWFkaW5nID0gdHJ1ZSBpZlxuLy8gaXQncyBpbiBwcm9ncmVzcy5cbi8vIEhvd2V2ZXIsIGlmIHdlJ3JlIG5vdCBlbmRlZCwgb3IgcmVhZGluZywgYW5kIHRoZSBsZW5ndGggPCBod20sXG4vLyB0aGVuIGdvIGFoZWFkIGFuZCB0cnkgdG8gcmVhZCBzb21lIG1vcmUgcHJlZW1wdGl2ZWx5LlxuZnVuY3Rpb24gbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucmVhZGluZ01vcmUpIHtcbiAgICBzdGF0ZS5yZWFkaW5nTW9yZSA9IHRydWU7XG4gICAgcG5hLm5leHRUaWNrKG1heWJlUmVhZE1vcmVfLCBzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXliZVJlYWRNb3JlXyhzdHJlYW0sIHN0YXRlKSB7XG4gIHZhciBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIHdoaWxlICghc3RhdGUucmVhZGluZyAmJiAhc3RhdGUuZmxvd2luZyAmJiAhc3RhdGUuZW5kZWQgJiYgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRlYnVnKCdtYXliZVJlYWRNb3JlIHJlYWQgMCcpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICAgIGlmIChsZW4gPT09IHN0YXRlLmxlbmd0aClcbiAgICAgIC8vIGRpZG4ndCBnZXQgYW55IGRhdGEsIHN0b3Agc3Bpbm5pbmcuXG4gICAgICBicmVhaztlbHNlIGxlbiA9IHN0YXRlLmxlbmd0aDtcbiAgfVxuICBzdGF0ZS5yZWFkaW5nTW9yZSA9IGZhbHNlO1xufVxuXG4vLyBhYnN0cmFjdCBtZXRob2QuICB0byBiZSBvdmVycmlkZGVuIGluIHNwZWNpZmljIGltcGxlbWVudGF0aW9uIGNsYXNzZXMuXG4vLyBjYWxsIGNiKGVyLCBkYXRhKSB3aGVyZSBkYXRhIGlzIDw9IG4gaW4gbGVuZ3RoLlxuLy8gZm9yIHZpcnR1YWwgKG5vbi1zdHJpbmcsIG5vbi1idWZmZXIpIHN0cmVhbXMsIFwibGVuZ3RoXCIgaXMgc29tZXdoYXRcbi8vIGFyYml0cmFyeSwgYW5kIHBlcmhhcHMgbm90IHZlcnkgbWVhbmluZ2Z1bC5cblJlYWRhYmxlLnByb3RvdHlwZS5fcmVhZCA9IGZ1bmN0aW9uIChuKSB7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ19yZWFkKCkgaXMgbm90IGltcGxlbWVudGVkJykpO1xufTtcblxuUmVhZGFibGUucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbiAoZGVzdCwgcGlwZU9wdHMpIHtcbiAgdmFyIHNyYyA9IHRoaXM7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgc3dpdGNoIChzdGF0ZS5waXBlc0NvdW50KSB7XG4gICAgY2FzZSAwOlxuICAgICAgc3RhdGUucGlwZXMgPSBkZXN0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgc3RhdGUucGlwZXMgPSBbc3RhdGUucGlwZXMsIGRlc3RdO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHN0YXRlLnBpcGVzLnB1c2goZGVzdCk7XG4gICAgICBicmVhaztcbiAgfVxuICBzdGF0ZS5waXBlc0NvdW50ICs9IDE7XG4gIGRlYnVnKCdwaXBlIGNvdW50PSVkIG9wdHM9JWonLCBzdGF0ZS5waXBlc0NvdW50LCBwaXBlT3B0cyk7XG5cbiAgdmFyIGRvRW5kID0gKCFwaXBlT3B0cyB8fCBwaXBlT3B0cy5lbmQgIT09IGZhbHNlKSAmJiBkZXN0ICE9PSBwcm9jZXNzLnN0ZG91dCAmJiBkZXN0ICE9PSBwcm9jZXNzLnN0ZGVycjtcblxuICB2YXIgZW5kRm4gPSBkb0VuZCA/IG9uZW5kIDogdW5waXBlO1xuICBpZiAoc3RhdGUuZW5kRW1pdHRlZCkgcG5hLm5leHRUaWNrKGVuZEZuKTtlbHNlIHNyYy5vbmNlKCdlbmQnLCBlbmRGbik7XG5cbiAgZGVzdC5vbigndW5waXBlJywgb251bnBpcGUpO1xuICBmdW5jdGlvbiBvbnVucGlwZShyZWFkYWJsZSwgdW5waXBlSW5mbykge1xuICAgIGRlYnVnKCdvbnVucGlwZScpO1xuICAgIGlmIChyZWFkYWJsZSA9PT0gc3JjKSB7XG4gICAgICBpZiAodW5waXBlSW5mbyAmJiB1bnBpcGVJbmZvLmhhc1VucGlwZWQgPT09IGZhbHNlKSB7XG4gICAgICAgIHVucGlwZUluZm8uaGFzVW5waXBlZCA9IHRydWU7XG4gICAgICAgIGNsZWFudXAoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvbmVuZCgpIHtcbiAgICBkZWJ1Zygnb25lbmQnKTtcbiAgICBkZXN0LmVuZCgpO1xuICB9XG5cbiAgLy8gd2hlbiB0aGUgZGVzdCBkcmFpbnMsIGl0IHJlZHVjZXMgdGhlIGF3YWl0RHJhaW4gY291bnRlclxuICAvLyBvbiB0aGUgc291cmNlLiAgVGhpcyB3b3VsZCBiZSBtb3JlIGVsZWdhbnQgd2l0aCBhIC5vbmNlKClcbiAgLy8gaGFuZGxlciBpbiBmbG93KCksIGJ1dCBhZGRpbmcgYW5kIHJlbW92aW5nIHJlcGVhdGVkbHkgaXNcbiAgLy8gdG9vIHNsb3cuXG4gIHZhciBvbmRyYWluID0gcGlwZU9uRHJhaW4oc3JjKTtcbiAgZGVzdC5vbignZHJhaW4nLCBvbmRyYWluKTtcblxuICB2YXIgY2xlYW5lZFVwID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgZGVidWcoJ2NsZWFudXAnKTtcbiAgICAvLyBjbGVhbnVwIGV2ZW50IGhhbmRsZXJzIG9uY2UgdGhlIHBpcGUgaXMgYnJva2VuXG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZHJhaW4nLCBvbmRyYWluKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ3VucGlwZScsIG9udW5waXBlKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIG9uZW5kKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIHVucGlwZSk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdkYXRhJywgb25kYXRhKTtcblxuICAgIGNsZWFuZWRVcCA9IHRydWU7XG5cbiAgICAvLyBpZiB0aGUgcmVhZGVyIGlzIHdhaXRpbmcgZm9yIGEgZHJhaW4gZXZlbnQgZnJvbSB0aGlzXG4gICAgLy8gc3BlY2lmaWMgd3JpdGVyLCB0aGVuIGl0IHdvdWxkIGNhdXNlIGl0IHRvIG5ldmVyIHN0YXJ0XG4gICAgLy8gZmxvd2luZyBhZ2Fpbi5cbiAgICAvLyBTbywgaWYgdGhpcyBpcyBhd2FpdGluZyBhIGRyYWluLCB0aGVuIHdlIGp1c3QgY2FsbCBpdCBub3cuXG4gICAgLy8gSWYgd2UgZG9uJ3Qga25vdywgdGhlbiBhc3N1bWUgdGhhdCB3ZSBhcmUgd2FpdGluZyBmb3Igb25lLlxuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluICYmICghZGVzdC5fd3JpdGFibGVTdGF0ZSB8fCBkZXN0Ll93cml0YWJsZVN0YXRlLm5lZWREcmFpbikpIG9uZHJhaW4oKTtcbiAgfVxuXG4gIC8vIElmIHRoZSB1c2VyIHB1c2hlcyBtb3JlIGRhdGEgd2hpbGUgd2UncmUgd3JpdGluZyB0byBkZXN0IHRoZW4gd2UnbGwgZW5kIHVwXG4gIC8vIGluIG9uZGF0YSBhZ2Fpbi4gSG93ZXZlciwgd2Ugb25seSB3YW50IHRvIGluY3JlYXNlIGF3YWl0RHJhaW4gb25jZSBiZWNhdXNlXG4gIC8vIGRlc3Qgd2lsbCBvbmx5IGVtaXQgb25lICdkcmFpbicgZXZlbnQgZm9yIHRoZSBtdWx0aXBsZSB3cml0ZXMuXG4gIC8vID0+IEludHJvZHVjZSBhIGd1YXJkIG9uIGluY3JlYXNpbmcgYXdhaXREcmFpbi5cbiAgdmFyIGluY3JlYXNlZEF3YWl0RHJhaW4gPSBmYWxzZTtcbiAgc3JjLm9uKCdkYXRhJywgb25kYXRhKTtcbiAgZnVuY3Rpb24gb25kYXRhKGNodW5rKSB7XG4gICAgZGVidWcoJ29uZGF0YScpO1xuICAgIGluY3JlYXNlZEF3YWl0RHJhaW4gPSBmYWxzZTtcbiAgICB2YXIgcmV0ID0gZGVzdC53cml0ZShjaHVuayk7XG4gICAgaWYgKGZhbHNlID09PSByZXQgJiYgIWluY3JlYXNlZEF3YWl0RHJhaW4pIHtcbiAgICAgIC8vIElmIHRoZSB1c2VyIHVucGlwZWQgZHVyaW5nIGBkZXN0LndyaXRlKClgLCBpdCBpcyBwb3NzaWJsZVxuICAgICAgLy8gdG8gZ2V0IHN0dWNrIGluIGEgcGVybWFuZW50bHkgcGF1c2VkIHN0YXRlIGlmIHRoYXQgd3JpdGVcbiAgICAgIC8vIGFsc28gcmV0dXJuZWQgZmFsc2UuXG4gICAgICAvLyA9PiBDaGVjayB3aGV0aGVyIGBkZXN0YCBpcyBzdGlsbCBhIHBpcGluZyBkZXN0aW5hdGlvbi5cbiAgICAgIGlmICgoc3RhdGUucGlwZXNDb3VudCA9PT0gMSAmJiBzdGF0ZS5waXBlcyA9PT0gZGVzdCB8fCBzdGF0ZS5waXBlc0NvdW50ID4gMSAmJiBpbmRleE9mKHN0YXRlLnBpcGVzLCBkZXN0KSAhPT0gLTEpICYmICFjbGVhbmVkVXApIHtcbiAgICAgICAgZGVidWcoJ2ZhbHNlIHdyaXRlIHJlc3BvbnNlLCBwYXVzZScsIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKTtcbiAgICAgICAgc3JjLl9yZWFkYWJsZVN0YXRlLmF3YWl0RHJhaW4rKztcbiAgICAgICAgaW5jcmVhc2VkQXdhaXREcmFpbiA9IHRydWU7XG4gICAgICB9XG4gICAgICBzcmMucGF1c2UoKTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgZGVzdCBoYXMgYW4gZXJyb3IsIHRoZW4gc3RvcCBwaXBpbmcgaW50byBpdC5cbiAgLy8gaG93ZXZlciwgZG9uJ3Qgc3VwcHJlc3MgdGhlIHRocm93aW5nIGJlaGF2aW9yIGZvciB0aGlzLlxuICBmdW5jdGlvbiBvbmVycm9yKGVyKSB7XG4gICAgZGVidWcoJ29uZXJyb3InLCBlcik7XG4gICAgdW5waXBlKCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBpZiAoRUVsaXN0ZW5lckNvdW50KGRlc3QsICdlcnJvcicpID09PSAwKSBkZXN0LmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9XG5cbiAgLy8gTWFrZSBzdXJlIG91ciBlcnJvciBoYW5kbGVyIGlzIGF0dGFjaGVkIGJlZm9yZSB1c2VybGFuZCBvbmVzLlxuICBwcmVwZW5kTGlzdGVuZXIoZGVzdCwgJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgLy8gQm90aCBjbG9zZSBhbmQgZmluaXNoIHNob3VsZCB0cmlnZ2VyIHVucGlwZSwgYnV0IG9ubHkgb25jZS5cbiAgZnVuY3Rpb24gb25jbG9zZSgpIHtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG4gICAgdW5waXBlKCk7XG4gIH1cbiAgZGVzdC5vbmNlKCdjbG9zZScsIG9uY2xvc2UpO1xuICBmdW5jdGlvbiBvbmZpbmlzaCgpIHtcbiAgICBkZWJ1Zygnb25maW5pc2gnKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuICAgIHVucGlwZSgpO1xuICB9XG4gIGRlc3Qub25jZSgnZmluaXNoJywgb25maW5pc2gpO1xuXG4gIGZ1bmN0aW9uIHVucGlwZSgpIHtcbiAgICBkZWJ1ZygndW5waXBlJyk7XG4gICAgc3JjLnVucGlwZShkZXN0KTtcbiAgfVxuXG4gIC8vIHRlbGwgdGhlIGRlc3QgdGhhdCBpdCdzIGJlaW5nIHBpcGVkIHRvXG4gIGRlc3QuZW1pdCgncGlwZScsIHNyYyk7XG5cbiAgLy8gc3RhcnQgdGhlIGZsb3cgaWYgaXQgaGFzbid0IGJlZW4gc3RhcnRlZCBhbHJlYWR5LlxuICBpZiAoIXN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGlwZSByZXN1bWUnKTtcbiAgICBzcmMucmVzdW1lKCk7XG4gIH1cblxuICByZXR1cm4gZGVzdDtcbn07XG5cbmZ1bmN0aW9uIHBpcGVPbkRyYWluKHNyYykge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdGF0ZSA9IHNyYy5fcmVhZGFibGVTdGF0ZTtcbiAgICBkZWJ1ZygncGlwZU9uRHJhaW4nLCBzdGF0ZS5hd2FpdERyYWluKTtcbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbikgc3RhdGUuYXdhaXREcmFpbi0tO1xuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluID09PSAwICYmIEVFbGlzdGVuZXJDb3VudChzcmMsICdkYXRhJykpIHtcbiAgICAgIHN0YXRlLmZsb3dpbmcgPSB0cnVlO1xuICAgICAgZmxvdyhzcmMpO1xuICAgIH1cbiAgfTtcbn1cblxuUmVhZGFibGUucHJvdG90eXBlLnVucGlwZSA9IGZ1bmN0aW9uIChkZXN0KSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciB1bnBpcGVJbmZvID0geyBoYXNVbnBpcGVkOiBmYWxzZSB9O1xuXG4gIC8vIGlmIHdlJ3JlIG5vdCBwaXBpbmcgYW55d2hlcmUsIHRoZW4gZG8gbm90aGluZy5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDApIHJldHVybiB0aGlzO1xuXG4gIC8vIGp1c3Qgb25lIGRlc3RpbmF0aW9uLiAgbW9zdCBjb21tb24gY2FzZS5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpIHtcbiAgICAvLyBwYXNzZWQgaW4gb25lLCBidXQgaXQncyBub3QgdGhlIHJpZ2h0IG9uZS5cbiAgICBpZiAoZGVzdCAmJiBkZXN0ICE9PSBzdGF0ZS5waXBlcykgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAoIWRlc3QpIGRlc3QgPSBzdGF0ZS5waXBlcztcblxuICAgIC8vIGdvdCBhIG1hdGNoLlxuICAgIHN0YXRlLnBpcGVzID0gbnVsbDtcbiAgICBzdGF0ZS5waXBlc0NvdW50ID0gMDtcbiAgICBzdGF0ZS5mbG93aW5nID0gZmFsc2U7XG4gICAgaWYgKGRlc3QpIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcywgdW5waXBlSW5mbyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBzbG93IGNhc2UuIG11bHRpcGxlIHBpcGUgZGVzdGluYXRpb25zLlxuXG4gIGlmICghZGVzdCkge1xuICAgIC8vIHJlbW92ZSBhbGwuXG4gICAgdmFyIGRlc3RzID0gc3RhdGUucGlwZXM7XG4gICAgdmFyIGxlbiA9IHN0YXRlLnBpcGVzQ291bnQ7XG4gICAgc3RhdGUucGlwZXMgPSBudWxsO1xuICAgIHN0YXRlLnBpcGVzQ291bnQgPSAwO1xuICAgIHN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGRlc3RzW2ldLmVtaXQoJ3VucGlwZScsIHRoaXMsIHVucGlwZUluZm8pO1xuICAgIH1yZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHRyeSB0byBmaW5kIHRoZSByaWdodCBvbmUuXG4gIHZhciBpbmRleCA9IGluZGV4T2Yoc3RhdGUucGlwZXMsIGRlc3QpO1xuICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm4gdGhpcztcblxuICBzdGF0ZS5waXBlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICBzdGF0ZS5waXBlc0NvdW50IC09IDE7XG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAxKSBzdGF0ZS5waXBlcyA9IHN0YXRlLnBpcGVzWzBdO1xuXG4gIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcywgdW5waXBlSW5mbyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBzZXQgdXAgZGF0YSBldmVudHMgaWYgdGhleSBhcmUgYXNrZWQgZm9yXG4vLyBFbnN1cmUgcmVhZGFibGUgbGlzdGVuZXJzIGV2ZW50dWFsbHkgZ2V0IHNvbWV0aGluZ1xuUmVhZGFibGUucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGV2LCBmbikge1xuICB2YXIgcmVzID0gU3RyZWFtLnByb3RvdHlwZS5vbi5jYWxsKHRoaXMsIGV2LCBmbik7XG5cbiAgaWYgKGV2ID09PSAnZGF0YScpIHtcbiAgICAvLyBTdGFydCBmbG93aW5nIG9uIG5leHQgdGljayBpZiBzdHJlYW0gaXNuJ3QgZXhwbGljaXRseSBwYXVzZWRcbiAgICBpZiAodGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nICE9PSBmYWxzZSkgdGhpcy5yZXN1bWUoKTtcbiAgfSBlbHNlIGlmIChldiA9PT0gJ3JlYWRhYmxlJykge1xuICAgIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gICAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkICYmICFzdGF0ZS5yZWFkYWJsZUxpc3RlbmluZykge1xuICAgICAgc3RhdGUucmVhZGFibGVMaXN0ZW5pbmcgPSBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgICAgc3RhdGUuZW1pdHRlZFJlYWRhYmxlID0gZmFsc2U7XG4gICAgICBpZiAoIXN0YXRlLnJlYWRpbmcpIHtcbiAgICAgICAgcG5hLm5leHRUaWNrKG5SZWFkaW5nTmV4dFRpY2ssIHRoaXMpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgZW1pdFJlYWRhYmxlKHRoaXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXM7XG59O1xuUmVhZGFibGUucHJvdG90eXBlLmFkZExpc3RlbmVyID0gUmVhZGFibGUucHJvdG90eXBlLm9uO1xuXG5mdW5jdGlvbiBuUmVhZGluZ05leHRUaWNrKHNlbGYpIHtcbiAgZGVidWcoJ3JlYWRhYmxlIG5leHR0aWNrIHJlYWQgMCcpO1xuICBzZWxmLnJlYWQoMCk7XG59XG5cbi8vIHBhdXNlKCkgYW5kIHJlc3VtZSgpIGFyZSByZW1uYW50cyBvZiB0aGUgbGVnYWN5IHJlYWRhYmxlIHN0cmVhbSBBUElcbi8vIElmIHRoZSB1c2VyIHVzZXMgdGhlbSwgdGhlbiBzd2l0Y2ggaW50byBvbGQgbW9kZS5cblJlYWRhYmxlLnByb3RvdHlwZS5yZXN1bWUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdyZXN1bWUnKTtcbiAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICByZXN1bWUodGhpcywgc3RhdGUpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gcmVzdW1lKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZXN1bWVTY2hlZHVsZWQpIHtcbiAgICBzdGF0ZS5yZXN1bWVTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHBuYS5uZXh0VGljayhyZXN1bWVfLCBzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZXN1bWVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nKSB7XG4gICAgZGVidWcoJ3Jlc3VtZSByZWFkIDAnKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgfVxuXG4gIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IGZhbHNlO1xuICBzdGF0ZS5hd2FpdERyYWluID0gMDtcbiAgc3RyZWFtLmVtaXQoJ3Jlc3VtZScpO1xuICBmbG93KHN0cmVhbSk7XG4gIGlmIChzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5yZWFkaW5nKSBzdHJlYW0ucmVhZCgwKTtcbn1cblxuUmVhZGFibGUucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24gKCkge1xuICBkZWJ1ZygnY2FsbCBwYXVzZSBmbG93aW5nPSVqJywgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKTtcbiAgaWYgKGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGF1c2UnKTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ3BhdXNlJyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBmbG93KHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIGRlYnVnKCdmbG93Jywgc3RhdGUuZmxvd2luZyk7XG4gIHdoaWxlIChzdGF0ZS5mbG93aW5nICYmIHN0cmVhbS5yZWFkKCkgIT09IG51bGwpIHt9XG59XG5cbi8vIHdyYXAgYW4gb2xkLXN0eWxlIHN0cmVhbSBhcyB0aGUgYXN5bmMgZGF0YSBzb3VyY2UuXG4vLyBUaGlzIGlzICpub3QqIHBhcnQgb2YgdGhlIHJlYWRhYmxlIHN0cmVhbSBpbnRlcmZhY2UuXG4vLyBJdCBpcyBhbiB1Z2x5IHVuZm9ydHVuYXRlIG1lc3Mgb2YgaGlzdG9yeS5cblJlYWRhYmxlLnByb3RvdHlwZS53cmFwID0gZnVuY3Rpb24gKHN0cmVhbSkge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciBwYXVzZWQgPSBmYWxzZTtcblxuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICBkZWJ1Zygnd3JhcHBlZCBlbmQnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhc3RhdGUuZW5kZWQpIHtcbiAgICAgIHZhciBjaHVuayA9IHN0YXRlLmRlY29kZXIuZW5kKCk7XG4gICAgICBpZiAoY2h1bmsgJiYgY2h1bmsubGVuZ3RoKSBfdGhpcy5wdXNoKGNodW5rKTtcbiAgICB9XG5cbiAgICBfdGhpcy5wdXNoKG51bGwpO1xuICB9KTtcblxuICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbiAoY2h1bmspIHtcbiAgICBkZWJ1Zygnd3JhcHBlZCBkYXRhJyk7XG4gICAgaWYgKHN0YXRlLmRlY29kZXIpIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG5cbiAgICAvLyBkb24ndCBza2lwIG92ZXIgZmFsc3kgdmFsdWVzIGluIG9iamVjdE1vZGVcbiAgICBpZiAoc3RhdGUub2JqZWN0TW9kZSAmJiAoY2h1bmsgPT09IG51bGwgfHwgY2h1bmsgPT09IHVuZGVmaW5lZCkpIHJldHVybjtlbHNlIGlmICghc3RhdGUub2JqZWN0TW9kZSAmJiAoIWNodW5rIHx8ICFjaHVuay5sZW5ndGgpKSByZXR1cm47XG5cbiAgICB2YXIgcmV0ID0gX3RoaXMucHVzaChjaHVuayk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICBzdHJlYW0ucGF1c2UoKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHByb3h5IGFsbCB0aGUgb3RoZXIgbWV0aG9kcy5cbiAgLy8gaW1wb3J0YW50IHdoZW4gd3JhcHBpbmcgZmlsdGVycyBhbmQgZHVwbGV4ZXMuXG4gIGZvciAodmFyIGkgaW4gc3RyZWFtKSB7XG4gICAgaWYgKHRoaXNbaV0gPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygc3RyZWFtW2ldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzW2ldID0gZnVuY3Rpb24gKG1ldGhvZCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBzdHJlYW1bbWV0aG9kXS5hcHBseShzdHJlYW0sIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG4gICAgICB9KGkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIHByb3h5IGNlcnRhaW4gaW1wb3J0YW50IGV2ZW50cy5cbiAgZm9yICh2YXIgbiA9IDA7IG4gPCBrUHJveHlFdmVudHMubGVuZ3RoOyBuKyspIHtcbiAgICBzdHJlYW0ub24oa1Byb3h5RXZlbnRzW25dLCB0aGlzLmVtaXQuYmluZCh0aGlzLCBrUHJveHlFdmVudHNbbl0pKTtcbiAgfVxuXG4gIC8vIHdoZW4gd2UgdHJ5IHRvIGNvbnN1bWUgc29tZSBtb3JlIGJ5dGVzLCBzaW1wbHkgdW5wYXVzZSB0aGVcbiAgLy8gdW5kZXJseWluZyBzdHJlYW0uXG4gIHRoaXMuX3JlYWQgPSBmdW5jdGlvbiAobikge1xuICAgIGRlYnVnKCd3cmFwcGVkIF9yZWFkJywgbik7XG4gICAgaWYgKHBhdXNlZCkge1xuICAgICAgcGF1c2VkID0gZmFsc2U7XG4gICAgICBzdHJlYW0ucmVzdW1lKCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlYWRhYmxlLnByb3RvdHlwZSwgJ3JlYWRhYmxlSGlnaFdhdGVyTWFyaycsIHtcbiAgLy8gbWFraW5nIGl0IGV4cGxpY2l0IHRoaXMgcHJvcGVydHkgaXMgbm90IGVudW1lcmFibGVcbiAgLy8gYmVjYXVzZSBvdGhlcndpc2Ugc29tZSBwcm90b3R5cGUgbWFuaXB1bGF0aW9uIGluXG4gIC8vIHVzZXJsYW5kIHdpbGwgZmFpbFxuICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlYWRhYmxlU3RhdGUuaGlnaFdhdGVyTWFyaztcbiAgfVxufSk7XG5cbi8vIGV4cG9zZWQgZm9yIHRlc3RpbmcgcHVycG9zZXMgb25seS5cblJlYWRhYmxlLl9mcm9tTGlzdCA9IGZyb21MaXN0O1xuXG4vLyBQbHVjayBvZmYgbiBieXRlcyBmcm9tIGFuIGFycmF5IG9mIGJ1ZmZlcnMuXG4vLyBMZW5ndGggaXMgdGhlIGNvbWJpbmVkIGxlbmd0aHMgb2YgYWxsIHRoZSBidWZmZXJzIGluIHRoZSBsaXN0LlxuLy8gVGhpcyBmdW5jdGlvbiBpcyBkZXNpZ25lZCB0byBiZSBpbmxpbmFibGUsIHNvIHBsZWFzZSB0YWtlIGNhcmUgd2hlbiBtYWtpbmdcbi8vIGNoYW5nZXMgdG8gdGhlIGZ1bmN0aW9uIGJvZHkuXG5mdW5jdGlvbiBmcm9tTGlzdChuLCBzdGF0ZSkge1xuICAvLyBub3RoaW5nIGJ1ZmZlcmVkXG4gIGlmIChzdGF0ZS5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIHZhciByZXQ7XG4gIGlmIChzdGF0ZS5vYmplY3RNb2RlKSByZXQgPSBzdGF0ZS5idWZmZXIuc2hpZnQoKTtlbHNlIGlmICghbiB8fCBuID49IHN0YXRlLmxlbmd0aCkge1xuICAgIC8vIHJlYWQgaXQgYWxsLCB0cnVuY2F0ZSB0aGUgbGlzdFxuICAgIGlmIChzdGF0ZS5kZWNvZGVyKSByZXQgPSBzdGF0ZS5idWZmZXIuam9pbignJyk7ZWxzZSBpZiAoc3RhdGUuYnVmZmVyLmxlbmd0aCA9PT0gMSkgcmV0ID0gc3RhdGUuYnVmZmVyLmhlYWQuZGF0YTtlbHNlIHJldCA9IHN0YXRlLmJ1ZmZlci5jb25jYXQoc3RhdGUubGVuZ3RoKTtcbiAgICBzdGF0ZS5idWZmZXIuY2xlYXIoKTtcbiAgfSBlbHNlIHtcbiAgICAvLyByZWFkIHBhcnQgb2YgbGlzdFxuICAgIHJldCA9IGZyb21MaXN0UGFydGlhbChuLCBzdGF0ZS5idWZmZXIsIHN0YXRlLmRlY29kZXIpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuLy8gRXh0cmFjdHMgb25seSBlbm91Z2ggYnVmZmVyZWQgZGF0YSB0byBzYXRpc2Z5IHRoZSBhbW91bnQgcmVxdWVzdGVkLlxuLy8gVGhpcyBmdW5jdGlvbiBpcyBkZXNpZ25lZCB0byBiZSBpbmxpbmFibGUsIHNvIHBsZWFzZSB0YWtlIGNhcmUgd2hlbiBtYWtpbmdcbi8vIGNoYW5nZXMgdG8gdGhlIGZ1bmN0aW9uIGJvZHkuXG5mdW5jdGlvbiBmcm9tTGlzdFBhcnRpYWwobiwgbGlzdCwgaGFzU3RyaW5ncykge1xuICB2YXIgcmV0O1xuICBpZiAobiA8IGxpc3QuaGVhZC5kYXRhLmxlbmd0aCkge1xuICAgIC8vIHNsaWNlIGlzIHRoZSBzYW1lIGZvciBidWZmZXJzIGFuZCBzdHJpbmdzXG4gICAgcmV0ID0gbGlzdC5oZWFkLmRhdGEuc2xpY2UoMCwgbik7XG4gICAgbGlzdC5oZWFkLmRhdGEgPSBsaXN0LmhlYWQuZGF0YS5zbGljZShuKTtcbiAgfSBlbHNlIGlmIChuID09PSBsaXN0LmhlYWQuZGF0YS5sZW5ndGgpIHtcbiAgICAvLyBmaXJzdCBjaHVuayBpcyBhIHBlcmZlY3QgbWF0Y2hcbiAgICByZXQgPSBsaXN0LnNoaWZ0KCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gcmVzdWx0IHNwYW5zIG1vcmUgdGhhbiBvbmUgYnVmZmVyXG4gICAgcmV0ID0gaGFzU3RyaW5ncyA/IGNvcHlGcm9tQnVmZmVyU3RyaW5nKG4sIGxpc3QpIDogY29weUZyb21CdWZmZXIobiwgbGlzdCk7XG4gIH1cbiAgcmV0dXJuIHJldDtcbn1cblxuLy8gQ29waWVzIGEgc3BlY2lmaWVkIGFtb3VudCBvZiBjaGFyYWN0ZXJzIGZyb20gdGhlIGxpc3Qgb2YgYnVmZmVyZWQgZGF0YVxuLy8gY2h1bmtzLlxuLy8gVGhpcyBmdW5jdGlvbiBpcyBkZXNpZ25lZCB0byBiZSBpbmxpbmFibGUsIHNvIHBsZWFzZSB0YWtlIGNhcmUgd2hlbiBtYWtpbmdcbi8vIGNoYW5nZXMgdG8gdGhlIGZ1bmN0aW9uIGJvZHkuXG5mdW5jdGlvbiBjb3B5RnJvbUJ1ZmZlclN0cmluZyhuLCBsaXN0KSB7XG4gIHZhciBwID0gbGlzdC5oZWFkO1xuICB2YXIgYyA9IDE7XG4gIHZhciByZXQgPSBwLmRhdGE7XG4gIG4gLT0gcmV0Lmxlbmd0aDtcbiAgd2hpbGUgKHAgPSBwLm5leHQpIHtcbiAgICB2YXIgc3RyID0gcC5kYXRhO1xuICAgIHZhciBuYiA9IG4gPiBzdHIubGVuZ3RoID8gc3RyLmxlbmd0aCA6IG47XG4gICAgaWYgKG5iID09PSBzdHIubGVuZ3RoKSByZXQgKz0gc3RyO2Vsc2UgcmV0ICs9IHN0ci5zbGljZSgwLCBuKTtcbiAgICBuIC09IG5iO1xuICAgIGlmIChuID09PSAwKSB7XG4gICAgICBpZiAobmIgPT09IHN0ci5sZW5ndGgpIHtcbiAgICAgICAgKytjO1xuICAgICAgICBpZiAocC5uZXh0KSBsaXN0LmhlYWQgPSBwLm5leHQ7ZWxzZSBsaXN0LmhlYWQgPSBsaXN0LnRhaWwgPSBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdC5oZWFkID0gcDtcbiAgICAgICAgcC5kYXRhID0gc3RyLnNsaWNlKG5iKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICArK2M7XG4gIH1cbiAgbGlzdC5sZW5ndGggLT0gYztcbiAgcmV0dXJuIHJldDtcbn1cblxuLy8gQ29waWVzIGEgc3BlY2lmaWVkIGFtb3VudCBvZiBieXRlcyBmcm9tIHRoZSBsaXN0IG9mIGJ1ZmZlcmVkIGRhdGEgY2h1bmtzLlxuLy8gVGhpcyBmdW5jdGlvbiBpcyBkZXNpZ25lZCB0byBiZSBpbmxpbmFibGUsIHNvIHBsZWFzZSB0YWtlIGNhcmUgd2hlbiBtYWtpbmdcbi8vIGNoYW5nZXMgdG8gdGhlIGZ1bmN0aW9uIGJvZHkuXG5mdW5jdGlvbiBjb3B5RnJvbUJ1ZmZlcihuLCBsaXN0KSB7XG4gIHZhciByZXQgPSBCdWZmZXIuYWxsb2NVbnNhZmUobik7XG4gIHZhciBwID0gbGlzdC5oZWFkO1xuICB2YXIgYyA9IDE7XG4gIHAuZGF0YS5jb3B5KHJldCk7XG4gIG4gLT0gcC5kYXRhLmxlbmd0aDtcbiAgd2hpbGUgKHAgPSBwLm5leHQpIHtcbiAgICB2YXIgYnVmID0gcC5kYXRhO1xuICAgIHZhciBuYiA9IG4gPiBidWYubGVuZ3RoID8gYnVmLmxlbmd0aCA6IG47XG4gICAgYnVmLmNvcHkocmV0LCByZXQubGVuZ3RoIC0gbiwgMCwgbmIpO1xuICAgIG4gLT0gbmI7XG4gICAgaWYgKG4gPT09IDApIHtcbiAgICAgIGlmIChuYiA9PT0gYnVmLmxlbmd0aCkge1xuICAgICAgICArK2M7XG4gICAgICAgIGlmIChwLm5leHQpIGxpc3QuaGVhZCA9IHAubmV4dDtlbHNlIGxpc3QuaGVhZCA9IGxpc3QudGFpbCA9IG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaXN0LmhlYWQgPSBwO1xuICAgICAgICBwLmRhdGEgPSBidWYuc2xpY2UobmIpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgICsrYztcbiAgfVxuICBsaXN0Lmxlbmd0aCAtPSBjO1xuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIElmIHdlIGdldCBoZXJlIGJlZm9yZSBjb25zdW1pbmcgYWxsIHRoZSBieXRlcywgdGhlbiB0aGF0IGlzIGFcbiAgLy8gYnVnIGluIG5vZGUuICBTaG91bGQgbmV2ZXIgaGFwcGVuLlxuICBpZiAoc3RhdGUubGVuZ3RoID4gMCkgdGhyb3cgbmV3IEVycm9yKCdcImVuZFJlYWRhYmxlKClcIiBjYWxsZWQgb24gbm9uLWVtcHR5IHN0cmVhbScpO1xuXG4gIGlmICghc3RhdGUuZW5kRW1pdHRlZCkge1xuICAgIHN0YXRlLmVuZGVkID0gdHJ1ZTtcbiAgICBwbmEubmV4dFRpY2soZW5kUmVhZGFibGVOVCwgc3RhdGUsIHN0cmVhbSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW5kUmVhZGFibGVOVChzdGF0ZSwgc3RyZWFtKSB7XG4gIC8vIENoZWNrIHRoYXQgd2UgZGlkbid0IGdldCBvbmUgbGFzdCB1bnNoaWZ0LlxuICBpZiAoIXN0YXRlLmVuZEVtaXR0ZWQgJiYgc3RhdGUubGVuZ3RoID09PSAwKSB7XG4gICAgc3RhdGUuZW5kRW1pdHRlZCA9IHRydWU7XG4gICAgc3RyZWFtLnJlYWRhYmxlID0gZmFsc2U7XG4gICAgc3RyZWFtLmVtaXQoJ2VuZCcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGluZGV4T2YoeHMsIHgpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBpZiAoeHNbaV0gPT09IHgpIHJldHVybiBpO1xuICB9XG4gIHJldHVybiAtMTtcbn0iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gYSB0cmFuc2Zvcm0gc3RyZWFtIGlzIGEgcmVhZGFibGUvd3JpdGFibGUgc3RyZWFtIHdoZXJlIHlvdSBkb1xuLy8gc29tZXRoaW5nIHdpdGggdGhlIGRhdGEuICBTb21ldGltZXMgaXQncyBjYWxsZWQgYSBcImZpbHRlclwiLFxuLy8gYnV0IHRoYXQncyBub3QgYSBncmVhdCBuYW1lIGZvciBpdCwgc2luY2UgdGhhdCBpbXBsaWVzIGEgdGhpbmcgd2hlcmVcbi8vIHNvbWUgYml0cyBwYXNzIHRocm91Z2gsIGFuZCBvdGhlcnMgYXJlIHNpbXBseSBpZ25vcmVkLiAgKFRoYXQgd291bGRcbi8vIGJlIGEgdmFsaWQgZXhhbXBsZSBvZiBhIHRyYW5zZm9ybSwgb2YgY291cnNlLilcbi8vXG4vLyBXaGlsZSB0aGUgb3V0cHV0IGlzIGNhdXNhbGx5IHJlbGF0ZWQgdG8gdGhlIGlucHV0LCBpdCdzIG5vdCBhXG4vLyBuZWNlc3NhcmlseSBzeW1tZXRyaWMgb3Igc3luY2hyb25vdXMgdHJhbnNmb3JtYXRpb24uICBGb3IgZXhhbXBsZSxcbi8vIGEgemxpYiBzdHJlYW0gbWlnaHQgdGFrZSBtdWx0aXBsZSBwbGFpbi10ZXh0IHdyaXRlcygpLCBhbmQgdGhlblxuLy8gZW1pdCBhIHNpbmdsZSBjb21wcmVzc2VkIGNodW5rIHNvbWUgdGltZSBpbiB0aGUgZnV0dXJlLlxuLy9cbi8vIEhlcmUncyBob3cgdGhpcyB3b3Jrczpcbi8vXG4vLyBUaGUgVHJhbnNmb3JtIHN0cmVhbSBoYXMgYWxsIHRoZSBhc3BlY3RzIG9mIHRoZSByZWFkYWJsZSBhbmQgd3JpdGFibGVcbi8vIHN0cmVhbSBjbGFzc2VzLiAgV2hlbiB5b3Ugd3JpdGUoY2h1bmspLCB0aGF0IGNhbGxzIF93cml0ZShjaHVuayxjYilcbi8vIGludGVybmFsbHksIGFuZCByZXR1cm5zIGZhbHNlIGlmIHRoZXJlJ3MgYSBsb3Qgb2YgcGVuZGluZyB3cml0ZXNcbi8vIGJ1ZmZlcmVkIHVwLiAgV2hlbiB5b3UgY2FsbCByZWFkKCksIHRoYXQgY2FsbHMgX3JlYWQobikgdW50aWxcbi8vIHRoZXJlJ3MgZW5vdWdoIHBlbmRpbmcgcmVhZGFibGUgZGF0YSBidWZmZXJlZCB1cC5cbi8vXG4vLyBJbiBhIHRyYW5zZm9ybSBzdHJlYW0sIHRoZSB3cml0dGVuIGRhdGEgaXMgcGxhY2VkIGluIGEgYnVmZmVyLiAgV2hlblxuLy8gX3JlYWQobikgaXMgY2FsbGVkLCBpdCB0cmFuc2Zvcm1zIHRoZSBxdWV1ZWQgdXAgZGF0YSwgY2FsbGluZyB0aGVcbi8vIGJ1ZmZlcmVkIF93cml0ZSBjYidzIGFzIGl0IGNvbnN1bWVzIGNodW5rcy4gIElmIGNvbnN1bWluZyBhIHNpbmdsZVxuLy8gd3JpdHRlbiBjaHVuayB3b3VsZCByZXN1bHQgaW4gbXVsdGlwbGUgb3V0cHV0IGNodW5rcywgdGhlbiB0aGUgZmlyc3Rcbi8vIG91dHB1dHRlZCBiaXQgY2FsbHMgdGhlIHJlYWRjYiwgYW5kIHN1YnNlcXVlbnQgY2h1bmtzIGp1c3QgZ28gaW50b1xuLy8gdGhlIHJlYWQgYnVmZmVyLCBhbmQgd2lsbCBjYXVzZSBpdCB0byBlbWl0ICdyZWFkYWJsZScgaWYgbmVjZXNzYXJ5LlxuLy9cbi8vIFRoaXMgd2F5LCBiYWNrLXByZXNzdXJlIGlzIGFjdHVhbGx5IGRldGVybWluZWQgYnkgdGhlIHJlYWRpbmcgc2lkZSxcbi8vIHNpbmNlIF9yZWFkIGhhcyB0byBiZSBjYWxsZWQgdG8gc3RhcnQgcHJvY2Vzc2luZyBhIG5ldyBjaHVuay4gIEhvd2V2ZXIsXG4vLyBhIHBhdGhvbG9naWNhbCBpbmZsYXRlIHR5cGUgb2YgdHJhbnNmb3JtIGNhbiBjYXVzZSBleGNlc3NpdmUgYnVmZmVyaW5nXG4vLyBoZXJlLiAgRm9yIGV4YW1wbGUsIGltYWdpbmUgYSBzdHJlYW0gd2hlcmUgZXZlcnkgYnl0ZSBvZiBpbnB1dCBpc1xuLy8gaW50ZXJwcmV0ZWQgYXMgYW4gaW50ZWdlciBmcm9tIDAtMjU1LCBhbmQgdGhlbiByZXN1bHRzIGluIHRoYXQgbWFueVxuLy8gYnl0ZXMgb2Ygb3V0cHV0LiAgV3JpdGluZyB0aGUgNCBieXRlcyB7ZmYsZmYsZmYsZmZ9IHdvdWxkIHJlc3VsdCBpblxuLy8gMWtiIG9mIGRhdGEgYmVpbmcgb3V0cHV0LiAgSW4gdGhpcyBjYXNlLCB5b3UgY291bGQgd3JpdGUgYSB2ZXJ5IHNtYWxsXG4vLyBhbW91bnQgb2YgaW5wdXQsIGFuZCBlbmQgdXAgd2l0aCBhIHZlcnkgbGFyZ2UgYW1vdW50IG9mIG91dHB1dC4gIEluXG4vLyBzdWNoIGEgcGF0aG9sb2dpY2FsIGluZmxhdGluZyBtZWNoYW5pc20sIHRoZXJlJ2QgYmUgbm8gd2F5IHRvIHRlbGxcbi8vIHRoZSBzeXN0ZW0gdG8gc3RvcCBkb2luZyB0aGUgdHJhbnNmb3JtLiAgQSBzaW5nbGUgNE1CIHdyaXRlIGNvdWxkXG4vLyBjYXVzZSB0aGUgc3lzdGVtIHRvIHJ1biBvdXQgb2YgbWVtb3J5LlxuLy9cbi8vIEhvd2V2ZXIsIGV2ZW4gaW4gc3VjaCBhIHBhdGhvbG9naWNhbCBjYXNlLCBvbmx5IGEgc2luZ2xlIHdyaXR0ZW4gY2h1bmtcbi8vIHdvdWxkIGJlIGNvbnN1bWVkLCBhbmQgdGhlbiB0aGUgcmVzdCB3b3VsZCB3YWl0ICh1bi10cmFuc2Zvcm1lZCkgdW50aWxcbi8vIHRoZSByZXN1bHRzIG9mIHRoZSBwcmV2aW91cyB0cmFuc2Zvcm1lZCBjaHVuayB3ZXJlIGNvbnN1bWVkLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gVHJhbnNmb3JtO1xuXG52YXIgRHVwbGV4ID0gcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnV0aWwuaW5oZXJpdHMoVHJhbnNmb3JtLCBEdXBsZXgpO1xuXG5mdW5jdGlvbiBhZnRlclRyYW5zZm9ybShlciwgZGF0YSkge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcbiAgdHMudHJhbnNmb3JtaW5nID0gZmFsc2U7XG5cbiAgdmFyIGNiID0gdHMud3JpdGVjYjtcblxuICBpZiAoIWNiKSB7XG4gICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ3dyaXRlIGNhbGxiYWNrIGNhbGxlZCBtdWx0aXBsZSB0aW1lcycpKTtcbiAgfVxuXG4gIHRzLndyaXRlY2h1bmsgPSBudWxsO1xuICB0cy53cml0ZWNiID0gbnVsbDtcblxuICBpZiAoZGF0YSAhPSBudWxsKSAvLyBzaW5nbGUgZXF1YWxzIGNoZWNrIGZvciBib3RoIGBudWxsYCBhbmQgYHVuZGVmaW5lZGBcbiAgICB0aGlzLnB1c2goZGF0YSk7XG5cbiAgY2IoZXIpO1xuXG4gIHZhciBycyA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHJzLnJlYWRpbmcgPSBmYWxzZTtcbiAgaWYgKHJzLm5lZWRSZWFkYWJsZSB8fCBycy5sZW5ndGggPCBycy5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgdGhpcy5fcmVhZChycy5oaWdoV2F0ZXJNYXJrKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBUcmFuc2Zvcm0ob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgVHJhbnNmb3JtKSkgcmV0dXJuIG5ldyBUcmFuc2Zvcm0ob3B0aW9ucyk7XG5cbiAgRHVwbGV4LmNhbGwodGhpcywgb3B0aW9ucyk7XG5cbiAgdGhpcy5fdHJhbnNmb3JtU3RhdGUgPSB7XG4gICAgYWZ0ZXJUcmFuc2Zvcm06IGFmdGVyVHJhbnNmb3JtLmJpbmQodGhpcyksXG4gICAgbmVlZFRyYW5zZm9ybTogZmFsc2UsXG4gICAgdHJhbnNmb3JtaW5nOiBmYWxzZSxcbiAgICB3cml0ZWNiOiBudWxsLFxuICAgIHdyaXRlY2h1bms6IG51bGwsXG4gICAgd3JpdGVlbmNvZGluZzogbnVsbFxuICB9O1xuXG4gIC8vIHN0YXJ0IG91dCBhc2tpbmcgZm9yIGEgcmVhZGFibGUgZXZlbnQgb25jZSBkYXRhIGlzIHRyYW5zZm9ybWVkLlxuICB0aGlzLl9yZWFkYWJsZVN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG5cbiAgLy8gd2UgaGF2ZSBpbXBsZW1lbnRlZCB0aGUgX3JlYWQgbWV0aG9kLCBhbmQgZG9uZSB0aGUgb3RoZXIgdGhpbmdzXG4gIC8vIHRoYXQgUmVhZGFibGUgd2FudHMgYmVmb3JlIHRoZSBmaXJzdCBfcmVhZCBjYWxsLCBzbyB1bnNldCB0aGVcbiAgLy8gc3luYyBndWFyZCBmbGFnLlxuICB0aGlzLl9yZWFkYWJsZVN0YXRlLnN5bmMgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy50cmFuc2Zvcm0gPT09ICdmdW5jdGlvbicpIHRoaXMuX3RyYW5zZm9ybSA9IG9wdGlvbnMudHJhbnNmb3JtO1xuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmZsdXNoID09PSAnZnVuY3Rpb24nKSB0aGlzLl9mbHVzaCA9IG9wdGlvbnMuZmx1c2g7XG4gIH1cblxuICAvLyBXaGVuIHRoZSB3cml0YWJsZSBzaWRlIGZpbmlzaGVzLCB0aGVuIGZsdXNoIG91dCBhbnl0aGluZyByZW1haW5pbmcuXG4gIHRoaXMub24oJ3ByZWZpbmlzaCcsIHByZWZpbmlzaCk7XG59XG5cbmZ1bmN0aW9uIHByZWZpbmlzaCgpIHtcbiAgdmFyIF90aGlzID0gdGhpcztcblxuICBpZiAodHlwZW9mIHRoaXMuX2ZsdXNoID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5fZmx1c2goZnVuY3Rpb24gKGVyLCBkYXRhKSB7XG4gICAgICBkb25lKF90aGlzLCBlciwgZGF0YSk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgZG9uZSh0aGlzLCBudWxsLCBudWxsKTtcbiAgfVxufVxuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLnB1c2ggPSBmdW5jdGlvbiAoY2h1bmssIGVuY29kaW5nKSB7XG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlLm5lZWRUcmFuc2Zvcm0gPSBmYWxzZTtcbiAgcmV0dXJuIER1cGxleC5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBlbmNvZGluZyk7XG59O1xuXG4vLyBUaGlzIGlzIHRoZSBwYXJ0IHdoZXJlIHlvdSBkbyBzdHVmZiFcbi8vIG92ZXJyaWRlIHRoaXMgZnVuY3Rpb24gaW4gaW1wbGVtZW50YXRpb24gY2xhc3Nlcy5cbi8vICdjaHVuaycgaXMgYW4gaW5wdXQgY2h1bmsuXG4vL1xuLy8gQ2FsbCBgcHVzaChuZXdDaHVuaylgIHRvIHBhc3MgYWxvbmcgdHJhbnNmb3JtZWQgb3V0cHV0XG4vLyB0byB0aGUgcmVhZGFibGUgc2lkZS4gIFlvdSBtYXkgY2FsbCAncHVzaCcgemVybyBvciBtb3JlIHRpbWVzLlxuLy9cbi8vIENhbGwgYGNiKGVycilgIHdoZW4geW91IGFyZSBkb25lIHdpdGggdGhpcyBjaHVuay4gIElmIHlvdSBwYXNzXG4vLyBhbiBlcnJvciwgdGhlbiB0aGF0J2xsIHB1dCB0aGUgaHVydCBvbiB0aGUgd2hvbGUgb3BlcmF0aW9uLiAgSWYgeW91XG4vLyBuZXZlciBjYWxsIGNiKCksIHRoZW4geW91J2xsIG5ldmVyIGdldCBhbm90aGVyIGNodW5rLlxuVHJhbnNmb3JtLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24gKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdfdHJhbnNmb3JtKCkgaXMgbm90IGltcGxlbWVudGVkJyk7XG59O1xuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciB0cyA9IHRoaXMuX3RyYW5zZm9ybVN0YXRlO1xuICB0cy53cml0ZWNiID0gY2I7XG4gIHRzLndyaXRlY2h1bmsgPSBjaHVuaztcbiAgdHMud3JpdGVlbmNvZGluZyA9IGVuY29kaW5nO1xuICBpZiAoIXRzLnRyYW5zZm9ybWluZykge1xuICAgIHZhciBycyA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gICAgaWYgKHRzLm5lZWRUcmFuc2Zvcm0gfHwgcnMubmVlZFJlYWRhYmxlIHx8IHJzLmxlbmd0aCA8IHJzLmhpZ2hXYXRlck1hcmspIHRoaXMuX3JlYWQocnMuaGlnaFdhdGVyTWFyayk7XG4gIH1cbn07XG5cbi8vIERvZXNuJ3QgbWF0dGVyIHdoYXQgdGhlIGFyZ3MgYXJlIGhlcmUuXG4vLyBfdHJhbnNmb3JtIGRvZXMgYWxsIHRoZSB3b3JrLlxuLy8gVGhhdCB3ZSBnb3QgaGVyZSBtZWFucyB0aGF0IHRoZSByZWFkYWJsZSBzaWRlIHdhbnRzIG1vcmUgZGF0YS5cblRyYW5zZm9ybS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbiAobikge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcblxuICBpZiAodHMud3JpdGVjaHVuayAhPT0gbnVsbCAmJiB0cy53cml0ZWNiICYmICF0cy50cmFuc2Zvcm1pbmcpIHtcbiAgICB0cy50cmFuc2Zvcm1pbmcgPSB0cnVlO1xuICAgIHRoaXMuX3RyYW5zZm9ybSh0cy53cml0ZWNodW5rLCB0cy53cml0ZWVuY29kaW5nLCB0cy5hZnRlclRyYW5zZm9ybSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gbWFyayB0aGF0IHdlIG5lZWQgYSB0cmFuc2Zvcm0sIHNvIHRoYXQgYW55IGRhdGEgdGhhdCBjb21lcyBpblxuICAgIC8vIHdpbGwgZ2V0IHByb2Nlc3NlZCwgbm93IHRoYXQgd2UndmUgYXNrZWQgZm9yIGl0LlxuICAgIHRzLm5lZWRUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG59O1xuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl9kZXN0cm95ID0gZnVuY3Rpb24gKGVyciwgY2IpIHtcbiAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgRHVwbGV4LnByb3RvdHlwZS5fZGVzdHJveS5jYWxsKHRoaXMsIGVyciwgZnVuY3Rpb24gKGVycjIpIHtcbiAgICBjYihlcnIyKTtcbiAgICBfdGhpczIuZW1pdCgnY2xvc2UnKTtcbiAgfSk7XG59O1xuXG5mdW5jdGlvbiBkb25lKHN0cmVhbSwgZXIsIGRhdGEpIHtcbiAgaWYgKGVyKSByZXR1cm4gc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuXG4gIGlmIChkYXRhICE9IG51bGwpIC8vIHNpbmdsZSBlcXVhbHMgY2hlY2sgZm9yIGJvdGggYG51bGxgIGFuZCBgdW5kZWZpbmVkYFxuICAgIHN0cmVhbS5wdXNoKGRhdGEpO1xuXG4gIC8vIGlmIHRoZXJlJ3Mgbm90aGluZyBpbiB0aGUgd3JpdGUgYnVmZmVyLCB0aGVuIHRoYXQgbWVhbnNcbiAgLy8gdGhhdCBub3RoaW5nIG1vcmUgd2lsbCBldmVyIGJlIHByb3ZpZGVkXG4gIGlmIChzdHJlYW0uX3dyaXRhYmxlU3RhdGUubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoJ0NhbGxpbmcgdHJhbnNmb3JtIGRvbmUgd2hlbiB3cy5sZW5ndGggIT0gMCcpO1xuXG4gIGlmIChzdHJlYW0uX3RyYW5zZm9ybVN0YXRlLnRyYW5zZm9ybWluZykgdGhyb3cgbmV3IEVycm9yKCdDYWxsaW5nIHRyYW5zZm9ybSBkb25lIHdoZW4gc3RpbGwgdHJhbnNmb3JtaW5nJyk7XG5cbiAgcmV0dXJuIHN0cmVhbS5wdXNoKG51bGwpO1xufSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyBBIGJpdCBzaW1wbGVyIHRoYW4gcmVhZGFibGUgc3RyZWFtcy5cbi8vIEltcGxlbWVudCBhbiBhc3luYyAuX3dyaXRlKGNodW5rLCBlbmNvZGluZywgY2IpLCBhbmQgaXQnbGwgaGFuZGxlIGFsbFxuLy8gdGhlIGRyYWluIGV2ZW50IGVtaXNzaW9uIGFuZCBidWZmZXJpbmcuXG5cbid1c2Ugc3RyaWN0JztcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cblxudmFyIHBuYSA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxubW9kdWxlLmV4cG9ydHMgPSBXcml0YWJsZTtcblxuLyogPHJlcGxhY2VtZW50PiAqL1xuZnVuY3Rpb24gV3JpdGVSZXEoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aGlzLmNodW5rID0gY2h1bms7XG4gIHRoaXMuZW5jb2RpbmcgPSBlbmNvZGluZztcbiAgdGhpcy5jYWxsYmFjayA9IGNiO1xuICB0aGlzLm5leHQgPSBudWxsO1xufVxuXG4vLyBJdCBzZWVtcyBhIGxpbmtlZCBsaXN0IGJ1dCBpdCBpcyBub3Rcbi8vIHRoZXJlIHdpbGwgYmUgb25seSAyIG9mIHRoZXNlIGZvciBlYWNoIHN0cmVhbVxuZnVuY3Rpb24gQ29ya2VkUmVxdWVzdChzdGF0ZSkge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIHRoaXMubmV4dCA9IG51bGw7XG4gIHRoaXMuZW50cnkgPSBudWxsO1xuICB0aGlzLmZpbmlzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICBvbkNvcmtlZEZpbmlzaChfdGhpcywgc3RhdGUpO1xuICB9O1xufVxuLyogPC9yZXBsYWNlbWVudD4gKi9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBhc3luY1dyaXRlID0gIXByb2Nlc3MuYnJvd3NlciAmJiBbJ3YwLjEwJywgJ3YwLjkuJ10uaW5kZXhPZihwcm9jZXNzLnZlcnNpb24uc2xpY2UoMCwgNSkpID4gLTEgPyBzZXRJbW1lZGlhdGUgOiBwbmEubmV4dFRpY2s7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBEdXBsZXg7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuV3JpdGFibGUuV3JpdGFibGVTdGF0ZSA9IFdyaXRhYmxlU3RhdGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBpbnRlcm5hbFV0aWwgPSB7XG4gIGRlcHJlY2F0ZTogcmVxdWlyZSgndXRpbC1kZXByZWNhdGUnKVxufTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbSA9IHJlcXVpcmUoJy4vaW50ZXJuYWwvc3RyZWFtcy9zdHJlYW0nKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG4vKjxyZXBsYWNlbWVudD4qL1xuXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnc2FmZS1idWZmZXInKS5CdWZmZXI7XG52YXIgT3VyVWludDhBcnJheSA9IGdsb2JhbC5VaW50OEFycmF5IHx8IGZ1bmN0aW9uICgpIHt9O1xuZnVuY3Rpb24gX3VpbnQ4QXJyYXlUb0J1ZmZlcihjaHVuaykge1xuICByZXR1cm4gQnVmZmVyLmZyb20oY2h1bmspO1xufVxuZnVuY3Rpb24gX2lzVWludDhBcnJheShvYmopIHtcbiAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihvYmopIHx8IG9iaiBpbnN0YW5jZW9mIE91clVpbnQ4QXJyYXk7XG59XG5cbi8qPC9yZXBsYWNlbWVudD4qL1xuXG52YXIgZGVzdHJveUltcGwgPSByZXF1aXJlKCcuL2ludGVybmFsL3N0cmVhbXMvZGVzdHJveScpO1xuXG51dGlsLmluaGVyaXRzKFdyaXRhYmxlLCBTdHJlYW0pO1xuXG5mdW5jdGlvbiBub3AoKSB7fVxuXG5mdW5jdGlvbiBXcml0YWJsZVN0YXRlKG9wdGlvbnMsIHN0cmVhbSkge1xuICBEdXBsZXggPSBEdXBsZXggfHwgcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIC8vIER1cGxleCBzdHJlYW1zIGFyZSBib3RoIHJlYWRhYmxlIGFuZCB3cml0YWJsZSwgYnV0IHNoYXJlXG4gIC8vIHRoZSBzYW1lIG9wdGlvbnMgb2JqZWN0LlxuICAvLyBIb3dldmVyLCBzb21lIGNhc2VzIHJlcXVpcmUgc2V0dGluZyBvcHRpb25zIHRvIGRpZmZlcmVudFxuICAvLyB2YWx1ZXMgZm9yIHRoZSByZWFkYWJsZSBhbmQgdGhlIHdyaXRhYmxlIHNpZGVzIG9mIHRoZSBkdXBsZXggc3RyZWFtLlxuICAvLyBUaGVzZSBvcHRpb25zIGNhbiBiZSBwcm92aWRlZCBzZXBhcmF0ZWx5IGFzIHJlYWRhYmxlWFhYIGFuZCB3cml0YWJsZVhYWC5cbiAgdmFyIGlzRHVwbGV4ID0gc3RyZWFtIGluc3RhbmNlb2YgRHVwbGV4O1xuXG4gIC8vIG9iamVjdCBzdHJlYW0gZmxhZyB0byBpbmRpY2F0ZSB3aGV0aGVyIG9yIG5vdCB0aGlzIHN0cmVhbVxuICAvLyBjb250YWlucyBidWZmZXJzIG9yIG9iamVjdHMuXG4gIHRoaXMub2JqZWN0TW9kZSA9ICEhb3B0aW9ucy5vYmplY3RNb2RlO1xuXG4gIGlmIChpc0R1cGxleCkgdGhpcy5vYmplY3RNb2RlID0gdGhpcy5vYmplY3RNb2RlIHx8ICEhb3B0aW9ucy53cml0YWJsZU9iamVjdE1vZGU7XG5cbiAgLy8gdGhlIHBvaW50IGF0IHdoaWNoIHdyaXRlKCkgc3RhcnRzIHJldHVybmluZyBmYWxzZVxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIHRoYXQgd2UgYWx3YXlzIHJldHVybiBmYWxzZSBpZlxuICAvLyB0aGUgZW50aXJlIGJ1ZmZlciBpcyBub3QgZmx1c2hlZCBpbW1lZGlhdGVseSBvbiB3cml0ZSgpXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciB3cml0YWJsZUh3bSA9IG9wdGlvbnMud3JpdGFibGVIaWdoV2F0ZXJNYXJrO1xuICB2YXIgZGVmYXVsdEh3bSA9IHRoaXMub2JqZWN0TW9kZSA/IDE2IDogMTYgKiAxMDI0O1xuXG4gIGlmIChod20gfHwgaHdtID09PSAwKSB0aGlzLmhpZ2hXYXRlck1hcmsgPSBod207ZWxzZSBpZiAoaXNEdXBsZXggJiYgKHdyaXRhYmxlSHdtIHx8IHdyaXRhYmxlSHdtID09PSAwKSkgdGhpcy5oaWdoV2F0ZXJNYXJrID0gd3JpdGFibGVId207ZWxzZSB0aGlzLmhpZ2hXYXRlck1hcmsgPSBkZWZhdWx0SHdtO1xuXG4gIC8vIGNhc3QgdG8gaW50cy5cbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gTWF0aC5mbG9vcih0aGlzLmhpZ2hXYXRlck1hcmspO1xuXG4gIC8vIGlmIF9maW5hbCBoYXMgYmVlbiBjYWxsZWRcbiAgdGhpcy5maW5hbENhbGxlZCA9IGZhbHNlO1xuXG4gIC8vIGRyYWluIGV2ZW50IGZsYWcuXG4gIHRoaXMubmVlZERyYWluID0gZmFsc2U7XG4gIC8vIGF0IHRoZSBzdGFydCBvZiBjYWxsaW5nIGVuZCgpXG4gIHRoaXMuZW5kaW5nID0gZmFsc2U7XG4gIC8vIHdoZW4gZW5kKCkgaGFzIGJlZW4gY2FsbGVkLCBhbmQgcmV0dXJuZWRcbiAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICAvLyB3aGVuICdmaW5pc2gnIGlzIGVtaXR0ZWRcbiAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gIC8vIGhhcyBpdCBiZWVuIGRlc3Ryb3llZFxuICB0aGlzLmRlc3Ryb3llZCA9IGZhbHNlO1xuXG4gIC8vIHNob3VsZCB3ZSBkZWNvZGUgc3RyaW5ncyBpbnRvIGJ1ZmZlcnMgYmVmb3JlIHBhc3NpbmcgdG8gX3dyaXRlP1xuICAvLyB0aGlzIGlzIGhlcmUgc28gdGhhdCBzb21lIG5vZGUtY29yZSBzdHJlYW1zIGNhbiBvcHRpbWl6ZSBzdHJpbmdcbiAgLy8gaGFuZGxpbmcgYXQgYSBsb3dlciBsZXZlbC5cbiAgdmFyIG5vRGVjb2RlID0gb3B0aW9ucy5kZWNvZGVTdHJpbmdzID09PSBmYWxzZTtcbiAgdGhpcy5kZWNvZGVTdHJpbmdzID0gIW5vRGVjb2RlO1xuXG4gIC8vIENyeXB0byBpcyBraW5kIG9mIG9sZCBhbmQgY3J1c3R5LiAgSGlzdG9yaWNhbGx5LCBpdHMgZGVmYXVsdCBzdHJpbmdcbiAgLy8gZW5jb2RpbmcgaXMgJ2JpbmFyeScgc28gd2UgaGF2ZSB0byBtYWtlIHRoaXMgY29uZmlndXJhYmxlLlxuICAvLyBFdmVyeXRoaW5nIGVsc2UgaW4gdGhlIHVuaXZlcnNlIHVzZXMgJ3V0ZjgnLCB0aG91Z2guXG4gIHRoaXMuZGVmYXVsdEVuY29kaW5nID0gb3B0aW9ucy5kZWZhdWx0RW5jb2RpbmcgfHwgJ3V0ZjgnO1xuXG4gIC8vIG5vdCBhbiBhY3R1YWwgYnVmZmVyIHdlIGtlZXAgdHJhY2sgb2YsIGJ1dCBhIG1lYXN1cmVtZW50XG4gIC8vIG9mIGhvdyBtdWNoIHdlJ3JlIHdhaXRpbmcgdG8gZ2V0IHB1c2hlZCB0byBzb21lIHVuZGVybHlpbmdcbiAgLy8gc29ja2V0IG9yIGZpbGUuXG4gIHRoaXMubGVuZ3RoID0gMDtcblxuICAvLyBhIGZsYWcgdG8gc2VlIHdoZW4gd2UncmUgaW4gdGhlIG1pZGRsZSBvZiBhIHdyaXRlLlxuICB0aGlzLndyaXRpbmcgPSBmYWxzZTtcblxuICAvLyB3aGVuIHRydWUgYWxsIHdyaXRlcyB3aWxsIGJlIGJ1ZmZlcmVkIHVudGlsIC51bmNvcmsoKSBjYWxsXG4gIHRoaXMuY29ya2VkID0gMDtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBvbndyaXRlIGNiIGlzIGNhbGxlZCBpbW1lZGlhdGVseSxcbiAgLy8gb3Igb24gYSBsYXRlciB0aWNrLiAgV2Ugc2V0IHRoaXMgdG8gdHJ1ZSBhdCBmaXJzdCwgYmVjYXVzZSBhbnlcbiAgLy8gYWN0aW9ucyB0aGF0IHNob3VsZG4ndCBoYXBwZW4gdW50aWwgXCJsYXRlclwiIHNob3VsZCBnZW5lcmFsbHkgYWxzb1xuICAvLyBub3QgaGFwcGVuIGJlZm9yZSB0aGUgZmlyc3Qgd3JpdGUgY2FsbC5cbiAgdGhpcy5zeW5jID0gdHJ1ZTtcblxuICAvLyBhIGZsYWcgdG8ga25vdyBpZiB3ZSdyZSBwcm9jZXNzaW5nIHByZXZpb3VzbHkgYnVmZmVyZWQgaXRlbXMsIHdoaWNoXG4gIC8vIG1heSBjYWxsIHRoZSBfd3JpdGUoKSBjYWxsYmFjayBpbiB0aGUgc2FtZSB0aWNrLCBzbyB0aGF0IHdlIGRvbid0XG4gIC8vIGVuZCB1cCBpbiBhbiBvdmVybGFwcGVkIG9ud3JpdGUgc2l0dWF0aW9uLlxuICB0aGlzLmJ1ZmZlclByb2Nlc3NpbmcgPSBmYWxzZTtcblxuICAvLyB0aGUgY2FsbGJhY2sgdGhhdCdzIHBhc3NlZCB0byBfd3JpdGUoY2h1bmssY2IpXG4gIHRoaXMub253cml0ZSA9IGZ1bmN0aW9uIChlcikge1xuICAgIG9ud3JpdGUoc3RyZWFtLCBlcik7XG4gIH07XG5cbiAgLy8gdGhlIGNhbGxiYWNrIHRoYXQgdGhlIHVzZXIgc3VwcGxpZXMgdG8gd3JpdGUoY2h1bmssZW5jb2RpbmcsY2IpXG4gIHRoaXMud3JpdGVjYiA9IG51bGw7XG5cbiAgLy8gdGhlIGFtb3VudCB0aGF0IGlzIGJlaW5nIHdyaXR0ZW4gd2hlbiBfd3JpdGUgaXMgY2FsbGVkLlxuICB0aGlzLndyaXRlbGVuID0gMDtcblxuICB0aGlzLmJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG4gIHRoaXMubGFzdEJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG5cbiAgLy8gbnVtYmVyIG9mIHBlbmRpbmcgdXNlci1zdXBwbGllZCB3cml0ZSBjYWxsYmFja3NcbiAgLy8gdGhpcyBtdXN0IGJlIDAgYmVmb3JlICdmaW5pc2gnIGNhbiBiZSBlbWl0dGVkXG4gIHRoaXMucGVuZGluZ2NiID0gMDtcblxuICAvLyBlbWl0IHByZWZpbmlzaCBpZiB0aGUgb25seSB0aGluZyB3ZSdyZSB3YWl0aW5nIGZvciBpcyBfd3JpdGUgY2JzXG4gIC8vIFRoaXMgaXMgcmVsZXZhbnQgZm9yIHN5bmNocm9ub3VzIFRyYW5zZm9ybSBzdHJlYW1zXG4gIHRoaXMucHJlZmluaXNoZWQgPSBmYWxzZTtcblxuICAvLyBUcnVlIGlmIHRoZSBlcnJvciB3YXMgYWxyZWFkeSBlbWl0dGVkIGFuZCBzaG91bGQgbm90IGJlIHRocm93biBhZ2FpblxuICB0aGlzLmVycm9yRW1pdHRlZCA9IGZhbHNlO1xuXG4gIC8vIGNvdW50IGJ1ZmZlcmVkIHJlcXVlc3RzXG4gIHRoaXMuYnVmZmVyZWRSZXF1ZXN0Q291bnQgPSAwO1xuXG4gIC8vIGFsbG9jYXRlIHRoZSBmaXJzdCBDb3JrZWRSZXF1ZXN0LCB0aGVyZSBpcyBhbHdheXNcbiAgLy8gb25lIGFsbG9jYXRlZCBhbmQgZnJlZSB0byB1c2UsIGFuZCB3ZSBtYWludGFpbiBhdCBtb3N0IHR3b1xuICB0aGlzLmNvcmtlZFJlcXVlc3RzRnJlZSA9IG5ldyBDb3JrZWRSZXF1ZXN0KHRoaXMpO1xufVxuXG5Xcml0YWJsZVN0YXRlLnByb3RvdHlwZS5nZXRCdWZmZXIgPSBmdW5jdGlvbiBnZXRCdWZmZXIoKSB7XG4gIHZhciBjdXJyZW50ID0gdGhpcy5idWZmZXJlZFJlcXVlc3Q7XG4gIHZhciBvdXQgPSBbXTtcbiAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICBvdXQucHVzaChjdXJyZW50KTtcbiAgICBjdXJyZW50ID0gY3VycmVudC5uZXh0O1xuICB9XG4gIHJldHVybiBvdXQ7XG59O1xuXG4oZnVuY3Rpb24gKCkge1xuICB0cnkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShXcml0YWJsZVN0YXRlLnByb3RvdHlwZSwgJ2J1ZmZlcicsIHtcbiAgICAgIGdldDogaW50ZXJuYWxVdGlsLmRlcHJlY2F0ZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlcigpO1xuICAgICAgfSwgJ193cml0YWJsZVN0YXRlLmJ1ZmZlciBpcyBkZXByZWNhdGVkLiBVc2UgX3dyaXRhYmxlU3RhdGUuZ2V0QnVmZmVyICcgKyAnaW5zdGVhZC4nLCAnREVQMDAwMycpXG4gICAgfSk7XG4gIH0gY2F0Y2ggKF8pIHt9XG59KSgpO1xuXG4vLyBUZXN0IF93cml0YWJsZVN0YXRlIGZvciBpbmhlcml0YW5jZSB0byBhY2NvdW50IGZvciBEdXBsZXggc3RyZWFtcyxcbi8vIHdob3NlIHByb3RvdHlwZSBjaGFpbiBvbmx5IHBvaW50cyB0byBSZWFkYWJsZS5cbnZhciByZWFsSGFzSW5zdGFuY2U7XG5pZiAodHlwZW9mIFN5bWJvbCA9PT0gJ2Z1bmN0aW9uJyAmJiBTeW1ib2wuaGFzSW5zdGFuY2UgJiYgdHlwZW9mIEZ1bmN0aW9uLnByb3RvdHlwZVtTeW1ib2wuaGFzSW5zdGFuY2VdID09PSAnZnVuY3Rpb24nKSB7XG4gIHJlYWxIYXNJbnN0YW5jZSA9IEZ1bmN0aW9uLnByb3RvdHlwZVtTeW1ib2wuaGFzSW5zdGFuY2VdO1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoV3JpdGFibGUsIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICAgIHZhbHVlOiBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICBpZiAocmVhbEhhc0luc3RhbmNlLmNhbGwodGhpcywgb2JqZWN0KSkgcmV0dXJuIHRydWU7XG4gICAgICBpZiAodGhpcyAhPT0gV3JpdGFibGUpIHJldHVybiBmYWxzZTtcblxuICAgICAgcmV0dXJuIG9iamVjdCAmJiBvYmplY3QuX3dyaXRhYmxlU3RhdGUgaW5zdGFuY2VvZiBXcml0YWJsZVN0YXRlO1xuICAgIH1cbiAgfSk7XG59IGVsc2Uge1xuICByZWFsSGFzSW5zdGFuY2UgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdCBpbnN0YW5jZW9mIHRoaXM7XG4gIH07XG59XG5cbmZ1bmN0aW9uIFdyaXRhYmxlKG9wdGlvbnMpIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICAvLyBXcml0YWJsZSBjdG9yIGlzIGFwcGxpZWQgdG8gRHVwbGV4ZXMsIHRvby5cbiAgLy8gYHJlYWxIYXNJbnN0YW5jZWAgaXMgbmVjZXNzYXJ5IGJlY2F1c2UgdXNpbmcgcGxhaW4gYGluc3RhbmNlb2ZgXG4gIC8vIHdvdWxkIHJldHVybiBmYWxzZSwgYXMgbm8gYF93cml0YWJsZVN0YXRlYCBwcm9wZXJ0eSBpcyBhdHRhY2hlZC5cblxuICAvLyBUcnlpbmcgdG8gdXNlIHRoZSBjdXN0b20gYGluc3RhbmNlb2ZgIGZvciBXcml0YWJsZSBoZXJlIHdpbGwgYWxzbyBicmVhayB0aGVcbiAgLy8gTm9kZS5qcyBMYXp5VHJhbnNmb3JtIGltcGxlbWVudGF0aW9uLCB3aGljaCBoYXMgYSBub24tdHJpdmlhbCBnZXR0ZXIgZm9yXG4gIC8vIGBfd3JpdGFibGVTdGF0ZWAgdGhhdCB3b3VsZCBsZWFkIHRvIGluZmluaXRlIHJlY3Vyc2lvbi5cbiAgaWYgKCFyZWFsSGFzSW5zdGFuY2UuY2FsbChXcml0YWJsZSwgdGhpcykgJiYgISh0aGlzIGluc3RhbmNlb2YgRHVwbGV4KSkge1xuICAgIHJldHVybiBuZXcgV3JpdGFibGUob3B0aW9ucyk7XG4gIH1cblxuICB0aGlzLl93cml0YWJsZVN0YXRlID0gbmV3IFdyaXRhYmxlU3RhdGUob3B0aW9ucywgdGhpcyk7XG5cbiAgLy8gbGVnYWN5LlxuICB0aGlzLndyaXRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy53cml0ZSA9PT0gJ2Z1bmN0aW9uJykgdGhpcy5fd3JpdGUgPSBvcHRpb25zLndyaXRlO1xuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLndyaXRldiA9PT0gJ2Z1bmN0aW9uJykgdGhpcy5fd3JpdGV2ID0gb3B0aW9ucy53cml0ZXY7XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykgdGhpcy5fZGVzdHJveSA9IG9wdGlvbnMuZGVzdHJveTtcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5maW5hbCA9PT0gJ2Z1bmN0aW9uJykgdGhpcy5fZmluYWwgPSBvcHRpb25zLmZpbmFsO1xuICB9XG5cbiAgU3RyZWFtLmNhbGwodGhpcyk7XG59XG5cbi8vIE90aGVyd2lzZSBwZW9wbGUgY2FuIHBpcGUgV3JpdGFibGUgc3RyZWFtcywgd2hpY2ggaXMganVzdCB3cm9uZy5cbldyaXRhYmxlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDYW5ub3QgcGlwZSwgbm90IHJlYWRhYmxlJykpO1xufTtcblxuZnVuY3Rpb24gd3JpdGVBZnRlckVuZChzdHJlYW0sIGNiKSB7XG4gIHZhciBlciA9IG5ldyBFcnJvcignd3JpdGUgYWZ0ZXIgZW5kJyk7XG4gIC8vIFRPRE86IGRlZmVyIGVycm9yIGV2ZW50cyBjb25zaXN0ZW50bHkgZXZlcnl3aGVyZSwgbm90IGp1c3QgdGhlIGNiXG4gIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgcG5hLm5leHRUaWNrKGNiLCBlcik7XG59XG5cbi8vIENoZWNrcyB0aGF0IGEgdXNlci1zdXBwbGllZCBjaHVuayBpcyB2YWxpZCwgZXNwZWNpYWxseSBmb3IgdGhlIHBhcnRpY3VsYXJcbi8vIG1vZGUgdGhlIHN0cmVhbSBpcyBpbi4gQ3VycmVudGx5IHRoaXMgbWVhbnMgdGhhdCBgbnVsbGAgaXMgbmV2ZXIgYWNjZXB0ZWRcbi8vIGFuZCB1bmRlZmluZWQvbm9uLXN0cmluZyB2YWx1ZXMgYXJlIG9ubHkgYWxsb3dlZCBpbiBvYmplY3QgbW9kZS5cbmZ1bmN0aW9uIHZhbGlkQ2h1bmsoc3RyZWFtLCBzdGF0ZSwgY2h1bmssIGNiKSB7XG4gIHZhciB2YWxpZCA9IHRydWU7XG4gIHZhciBlciA9IGZhbHNlO1xuXG4gIGlmIChjaHVuayA9PT0gbnVsbCkge1xuICAgIGVyID0gbmV3IFR5cGVFcnJvcignTWF5IG5vdCB3cml0ZSBudWxsIHZhbHVlcyB0byBzdHJlYW0nKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnICYmIGNodW5rICE9PSB1bmRlZmluZWQgJiYgIXN0YXRlLm9iamVjdE1vZGUpIHtcbiAgICBlciA9IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgbm9uLXN0cmluZy9idWZmZXIgY2h1bmsnKTtcbiAgfVxuICBpZiAoZXIpIHtcbiAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gICAgcG5hLm5leHRUaWNrKGNiLCBlcik7XG4gICAgdmFsaWQgPSBmYWxzZTtcbiAgfVxuICByZXR1cm4gdmFsaWQ7XG59XG5cbldyaXRhYmxlLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG4gIHZhciByZXQgPSBmYWxzZTtcbiAgdmFyIGlzQnVmID0gIXN0YXRlLm9iamVjdE1vZGUgJiYgX2lzVWludDhBcnJheShjaHVuayk7XG5cbiAgaWYgKGlzQnVmICYmICFCdWZmZXIuaXNCdWZmZXIoY2h1bmspKSB7XG4gICAgY2h1bmsgPSBfdWludDhBcnJheVRvQnVmZmVyKGNodW5rKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmIChpc0J1ZikgZW5jb2RpbmcgPSAnYnVmZmVyJztlbHNlIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gc3RhdGUuZGVmYXVsdEVuY29kaW5nO1xuXG4gIGlmICh0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpIGNiID0gbm9wO1xuXG4gIGlmIChzdGF0ZS5lbmRlZCkgd3JpdGVBZnRlckVuZCh0aGlzLCBjYik7ZWxzZSBpZiAoaXNCdWYgfHwgdmFsaWRDaHVuayh0aGlzLCBzdGF0ZSwgY2h1bmssIGNiKSkge1xuICAgIHN0YXRlLnBlbmRpbmdjYisrO1xuICAgIHJldCA9IHdyaXRlT3JCdWZmZXIodGhpcywgc3RhdGUsIGlzQnVmLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuY29yayA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBzdGF0ZS5jb3JrZWQrKztcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS51bmNvcmsgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG5cbiAgaWYgKHN0YXRlLmNvcmtlZCkge1xuICAgIHN0YXRlLmNvcmtlZC0tO1xuXG4gICAgaWYgKCFzdGF0ZS53cml0aW5nICYmICFzdGF0ZS5jb3JrZWQgJiYgIXN0YXRlLmZpbmlzaGVkICYmICFzdGF0ZS5idWZmZXJQcm9jZXNzaW5nICYmIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCkgY2xlYXJCdWZmZXIodGhpcywgc3RhdGUpO1xuICB9XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuc2V0RGVmYXVsdEVuY29kaW5nID0gZnVuY3Rpb24gc2V0RGVmYXVsdEVuY29kaW5nKGVuY29kaW5nKSB7XG4gIC8vIG5vZGU6OlBhcnNlRW5jb2RpbmcoKSByZXF1aXJlcyBsb3dlciBjYXNlLlxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJykgZW5jb2RpbmcgPSBlbmNvZGluZy50b0xvd2VyQ2FzZSgpO1xuICBpZiAoIShbJ2hleCcsICd1dGY4JywgJ3V0Zi04JywgJ2FzY2lpJywgJ2JpbmFyeScsICdiYXNlNjQnLCAndWNzMicsICd1Y3MtMicsICd1dGYxNmxlJywgJ3V0Zi0xNmxlJywgJ3JhdyddLmluZGV4T2YoKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKCkpID4gLTEpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpO1xuICB0aGlzLl93cml0YWJsZVN0YXRlLmRlZmF1bHRFbmNvZGluZyA9IGVuY29kaW5nO1xuICByZXR1cm4gdGhpcztcbn07XG5cbmZ1bmN0aW9uIGRlY29kZUNodW5rKHN0YXRlLCBjaHVuaywgZW5jb2RpbmcpIHtcbiAgaWYgKCFzdGF0ZS5vYmplY3RNb2RlICYmIHN0YXRlLmRlY29kZVN0cmluZ3MgIT09IGZhbHNlICYmIHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycpIHtcbiAgICBjaHVuayA9IEJ1ZmZlci5mcm9tKGNodW5rLCBlbmNvZGluZyk7XG4gIH1cbiAgcmV0dXJuIGNodW5rO1xufVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoV3JpdGFibGUucHJvdG90eXBlLCAnd3JpdGFibGVIaWdoV2F0ZXJNYXJrJywge1xuICAvLyBtYWtpbmcgaXQgZXhwbGljaXQgdGhpcyBwcm9wZXJ0eSBpcyBub3QgZW51bWVyYWJsZVxuICAvLyBiZWNhdXNlIG90aGVyd2lzZSBzb21lIHByb3RvdHlwZSBtYW5pcHVsYXRpb24gaW5cbiAgLy8gdXNlcmxhbmQgd2lsbCBmYWlsXG4gIGVudW1lcmFibGU6IGZhbHNlLFxuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fd3JpdGFibGVTdGF0ZS5oaWdoV2F0ZXJNYXJrO1xuICB9XG59KTtcblxuLy8gaWYgd2UncmUgYWxyZWFkeSB3cml0aW5nIHNvbWV0aGluZywgdGhlbiBqdXN0IHB1dCB0aGlzXG4vLyBpbiB0aGUgcXVldWUsIGFuZCB3YWl0IG91ciB0dXJuLiAgT3RoZXJ3aXNlLCBjYWxsIF93cml0ZVxuLy8gSWYgd2UgcmV0dXJuIGZhbHNlLCB0aGVuIHdlIG5lZWQgYSBkcmFpbiBldmVudCwgc28gc2V0IHRoYXQgZmxhZy5cbmZ1bmN0aW9uIHdyaXRlT3JCdWZmZXIoc3RyZWFtLCBzdGF0ZSwgaXNCdWYsIGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgaWYgKCFpc0J1Zikge1xuICAgIHZhciBuZXdDaHVuayA9IGRlY29kZUNodW5rKHN0YXRlLCBjaHVuaywgZW5jb2RpbmcpO1xuICAgIGlmIChjaHVuayAhPT0gbmV3Q2h1bmspIHtcbiAgICAgIGlzQnVmID0gdHJ1ZTtcbiAgICAgIGVuY29kaW5nID0gJ2J1ZmZlcic7XG4gICAgICBjaHVuayA9IG5ld0NodW5rO1xuICAgIH1cbiAgfVxuICB2YXIgbGVuID0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG5cbiAgc3RhdGUubGVuZ3RoICs9IGxlbjtcblxuICB2YXIgcmV0ID0gc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaztcbiAgLy8gd2UgbXVzdCBlbnN1cmUgdGhhdCBwcmV2aW91cyBuZWVkRHJhaW4gd2lsbCBub3QgYmUgcmVzZXQgdG8gZmFsc2UuXG4gIGlmICghcmV0KSBzdGF0ZS5uZWVkRHJhaW4gPSB0cnVlO1xuXG4gIGlmIChzdGF0ZS53cml0aW5nIHx8IHN0YXRlLmNvcmtlZCkge1xuICAgIHZhciBsYXN0ID0gc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdDtcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0ge1xuICAgICAgY2h1bms6IGNodW5rLFxuICAgICAgZW5jb2Rpbmc6IGVuY29kaW5nLFxuICAgICAgaXNCdWY6IGlzQnVmLFxuICAgICAgY2FsbGJhY2s6IGNiLFxuICAgICAgbmV4dDogbnVsbFxuICAgIH07XG4gICAgaWYgKGxhc3QpIHtcbiAgICAgIGxhc3QubmV4dCA9IHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9IHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3Q7XG4gICAgfVxuICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdENvdW50ICs9IDE7XG4gIH0gZWxzZSB7XG4gICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgd3JpdGV2LCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgc3RhdGUud3JpdGVsZW4gPSBsZW47XG4gIHN0YXRlLndyaXRlY2IgPSBjYjtcbiAgc3RhdGUud3JpdGluZyA9IHRydWU7XG4gIHN0YXRlLnN5bmMgPSB0cnVlO1xuICBpZiAod3JpdGV2KSBzdHJlYW0uX3dyaXRldihjaHVuaywgc3RhdGUub253cml0ZSk7ZWxzZSBzdHJlYW0uX3dyaXRlKGNodW5rLCBlbmNvZGluZywgc3RhdGUub253cml0ZSk7XG4gIHN0YXRlLnN5bmMgPSBmYWxzZTtcbn1cblxuZnVuY3Rpb24gb253cml0ZUVycm9yKHN0cmVhbSwgc3RhdGUsIHN5bmMsIGVyLCBjYikge1xuICAtLXN0YXRlLnBlbmRpbmdjYjtcblxuICBpZiAoc3luYykge1xuICAgIC8vIGRlZmVyIHRoZSBjYWxsYmFjayBpZiB3ZSBhcmUgYmVpbmcgY2FsbGVkIHN5bmNocm9ub3VzbHlcbiAgICAvLyB0byBhdm9pZCBwaWxpbmcgdXAgdGhpbmdzIG9uIHRoZSBzdGFja1xuICAgIHBuYS5uZXh0VGljayhjYiwgZXIpO1xuICAgIC8vIHRoaXMgY2FuIGVtaXQgZmluaXNoLCBhbmQgaXQgd2lsbCBhbHdheXMgaGFwcGVuXG4gICAgLy8gYWZ0ZXIgZXJyb3JcbiAgICBwbmEubmV4dFRpY2soZmluaXNoTWF5YmUsIHN0cmVhbSwgc3RhdGUpO1xuICAgIHN0cmVhbS5fd3JpdGFibGVTdGF0ZS5lcnJvckVtaXR0ZWQgPSB0cnVlO1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgfSBlbHNlIHtcbiAgICAvLyB0aGUgY2FsbGVyIGV4cGVjdCB0aGlzIHRvIGhhcHBlbiBiZWZvcmUgaWZcbiAgICAvLyBpdCBpcyBhc3luY1xuICAgIGNiKGVyKTtcbiAgICBzdHJlYW0uX3dyaXRhYmxlU3RhdGUuZXJyb3JFbWl0dGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG4gICAgLy8gdGhpcyBjYW4gZW1pdCBmaW5pc2gsIGJ1dCBmaW5pc2ggbXVzdFxuICAgIC8vIGFsd2F5cyBmb2xsb3cgZXJyb3JcbiAgICBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvbndyaXRlU3RhdGVVcGRhdGUoc3RhdGUpIHtcbiAgc3RhdGUud3JpdGluZyA9IGZhbHNlO1xuICBzdGF0ZS53cml0ZWNiID0gbnVsbDtcbiAgc3RhdGUubGVuZ3RoIC09IHN0YXRlLndyaXRlbGVuO1xuICBzdGF0ZS53cml0ZWxlbiA9IDA7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGUoc3RyZWFtLCBlcikge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3dyaXRhYmxlU3RhdGU7XG4gIHZhciBzeW5jID0gc3RhdGUuc3luYztcbiAgdmFyIGNiID0gc3RhdGUud3JpdGVjYjtcblxuICBvbndyaXRlU3RhdGVVcGRhdGUoc3RhdGUpO1xuXG4gIGlmIChlcikgb253cml0ZUVycm9yKHN0cmVhbSwgc3RhdGUsIHN5bmMsIGVyLCBjYik7ZWxzZSB7XG4gICAgLy8gQ2hlY2sgaWYgd2UncmUgYWN0dWFsbHkgcmVhZHkgdG8gZmluaXNoLCBidXQgZG9uJ3QgZW1pdCB5ZXRcbiAgICB2YXIgZmluaXNoZWQgPSBuZWVkRmluaXNoKHN0YXRlKTtcblxuICAgIGlmICghZmluaXNoZWQgJiYgIXN0YXRlLmNvcmtlZCAmJiAhc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyAmJiBzdGF0ZS5idWZmZXJlZFJlcXVlc3QpIHtcbiAgICAgIGNsZWFyQnVmZmVyKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cblxuICAgIGlmIChzeW5jKSB7XG4gICAgICAvKjxyZXBsYWNlbWVudD4qL1xuICAgICAgYXN5bmNXcml0ZShhZnRlcldyaXRlLCBzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpO1xuICAgICAgLyo8L3JlcGxhY2VtZW50PiovXG4gICAgfSBlbHNlIHtcbiAgICAgIGFmdGVyV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpIHtcbiAgaWYgKCFmaW5pc2hlZCkgb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpO1xuICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgY2IoKTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG59XG5cbi8vIE11c3QgZm9yY2UgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIG9uIG5leHRUaWNrLCBzbyB0aGF0IHdlIGRvbid0XG4vLyBlbWl0ICdkcmFpbicgYmVmb3JlIHRoZSB3cml0ZSgpIGNvbnN1bWVyIGdldHMgdGhlICdmYWxzZScgcmV0dXJuXG4vLyB2YWx1ZSwgYW5kIGhhcyBhIGNoYW5jZSB0byBhdHRhY2ggYSAnZHJhaW4nIGxpc3RlbmVyLlxuZnVuY3Rpb24gb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5uZWVkRHJhaW4pIHtcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZHJhaW4nKTtcbiAgfVxufVxuXG4vLyBpZiB0aGVyZSdzIHNvbWV0aGluZyBpbiB0aGUgYnVmZmVyIHdhaXRpbmcsIHRoZW4gcHJvY2VzcyBpdFxuZnVuY3Rpb24gY2xlYXJCdWZmZXIoc3RyZWFtLCBzdGF0ZSkge1xuICBzdGF0ZS5idWZmZXJQcm9jZXNzaW5nID0gdHJ1ZTtcbiAgdmFyIGVudHJ5ID0gc3RhdGUuYnVmZmVyZWRSZXF1ZXN0O1xuXG4gIGlmIChzdHJlYW0uX3dyaXRldiAmJiBlbnRyeSAmJiBlbnRyeS5uZXh0KSB7XG4gICAgLy8gRmFzdCBjYXNlLCB3cml0ZSBldmVyeXRoaW5nIHVzaW5nIF93cml0ZXYoKVxuICAgIHZhciBsID0gc3RhdGUuYnVmZmVyZWRSZXF1ZXN0Q291bnQ7XG4gICAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheShsKTtcbiAgICB2YXIgaG9sZGVyID0gc3RhdGUuY29ya2VkUmVxdWVzdHNGcmVlO1xuICAgIGhvbGRlci5lbnRyeSA9IGVudHJ5O1xuXG4gICAgdmFyIGNvdW50ID0gMDtcbiAgICB2YXIgYWxsQnVmZmVycyA9IHRydWU7XG4gICAgd2hpbGUgKGVudHJ5KSB7XG4gICAgICBidWZmZXJbY291bnRdID0gZW50cnk7XG4gICAgICBpZiAoIWVudHJ5LmlzQnVmKSBhbGxCdWZmZXJzID0gZmFsc2U7XG4gICAgICBlbnRyeSA9IGVudHJ5Lm5leHQ7XG4gICAgICBjb3VudCArPSAxO1xuICAgIH1cbiAgICBidWZmZXIuYWxsQnVmZmVycyA9IGFsbEJ1ZmZlcnM7XG5cbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIHRydWUsIHN0YXRlLmxlbmd0aCwgYnVmZmVyLCAnJywgaG9sZGVyLmZpbmlzaCk7XG5cbiAgICAvLyBkb1dyaXRlIGlzIGFsbW9zdCBhbHdheXMgYXN5bmMsIGRlZmVyIHRoZXNlIHRvIHNhdmUgYSBiaXQgb2YgdGltZVxuICAgIC8vIGFzIHRoZSBob3QgcGF0aCBlbmRzIHdpdGggZG9Xcml0ZVxuICAgIHN0YXRlLnBlbmRpbmdjYisrO1xuICAgIHN0YXRlLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICAgIGlmIChob2xkZXIubmV4dCkge1xuICAgICAgc3RhdGUuY29ya2VkUmVxdWVzdHNGcmVlID0gaG9sZGVyLm5leHQ7XG4gICAgICBob2xkZXIubmV4dCA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLmNvcmtlZFJlcXVlc3RzRnJlZSA9IG5ldyBDb3JrZWRSZXF1ZXN0KHN0YXRlKTtcbiAgICB9XG4gICAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0Q291bnQgPSAwO1xuICB9IGVsc2Uge1xuICAgIC8vIFNsb3cgY2FzZSwgd3JpdGUgY2h1bmtzIG9uZS1ieS1vbmVcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIHZhciBjaHVuayA9IGVudHJ5LmNodW5rO1xuICAgICAgdmFyIGVuY29kaW5nID0gZW50cnkuZW5jb2Rpbmc7XG4gICAgICB2YXIgY2IgPSBlbnRyeS5jYWxsYmFjaztcbiAgICAgIHZhciBsZW4gPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcblxuICAgICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdENvdW50LS07XG4gICAgICAvLyBpZiB3ZSBkaWRuJ3QgY2FsbCB0aGUgb253cml0ZSBpbW1lZGlhdGVseSwgdGhlblxuICAgICAgLy8gaXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHdhaXQgdW50aWwgaXQgZG9lcy5cbiAgICAgIC8vIGFsc28sIHRoYXQgbWVhbnMgdGhhdCB0aGUgY2h1bmsgYW5kIGNiIGFyZSBjdXJyZW50bHlcbiAgICAgIC8vIGJlaW5nIHByb2Nlc3NlZCwgc28gbW92ZSB0aGUgYnVmZmVyIGNvdW50ZXIgcGFzdCB0aGVtLlxuICAgICAgaWYgKHN0YXRlLndyaXRpbmcpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVudHJ5ID09PSBudWxsKSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcbiAgfVxuXG4gIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9IGVudHJ5O1xuICBzdGF0ZS5idWZmZXJQcm9jZXNzaW5nID0gZmFsc2U7XG59XG5cbldyaXRhYmxlLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbiAoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBjYihuZXcgRXJyb3IoJ193cml0ZSgpIGlzIG5vdCBpbXBsZW1lbnRlZCcpKTtcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS5fd3JpdGV2ID0gbnVsbDtcblxuV3JpdGFibGUucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG5cbiAgaWYgKHR5cGVvZiBjaHVuayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gY2h1bms7XG4gICAgY2h1bmsgPSBudWxsO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmIChjaHVuayAhPT0gbnVsbCAmJiBjaHVuayAhPT0gdW5kZWZpbmVkKSB0aGlzLndyaXRlKGNodW5rLCBlbmNvZGluZyk7XG5cbiAgLy8gLmVuZCgpIGZ1bGx5IHVuY29ya3NcbiAgaWYgKHN0YXRlLmNvcmtlZCkge1xuICAgIHN0YXRlLmNvcmtlZCA9IDE7XG4gICAgdGhpcy51bmNvcmsoKTtcbiAgfVxuXG4gIC8vIGlnbm9yZSB1bm5lY2Vzc2FyeSBlbmQoKSBjYWxscy5cbiAgaWYgKCFzdGF0ZS5lbmRpbmcgJiYgIXN0YXRlLmZpbmlzaGVkKSBlbmRXcml0YWJsZSh0aGlzLCBzdGF0ZSwgY2IpO1xufTtcblxuZnVuY3Rpb24gbmVlZEZpbmlzaChzdGF0ZSkge1xuICByZXR1cm4gc3RhdGUuZW5kaW5nICYmIHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5idWZmZXJlZFJlcXVlc3QgPT09IG51bGwgJiYgIXN0YXRlLmZpbmlzaGVkICYmICFzdGF0ZS53cml0aW5nO1xufVxuZnVuY3Rpb24gY2FsbEZpbmFsKHN0cmVhbSwgc3RhdGUpIHtcbiAgc3RyZWFtLl9maW5hbChmdW5jdGlvbiAoZXJyKSB7XG4gICAgc3RhdGUucGVuZGluZ2NiLS07XG4gICAgaWYgKGVycikge1xuICAgICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICB9XG4gICAgc3RhdGUucHJlZmluaXNoZWQgPSB0cnVlO1xuICAgIHN0cmVhbS5lbWl0KCdwcmVmaW5pc2gnKTtcbiAgICBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKTtcbiAgfSk7XG59XG5mdW5jdGlvbiBwcmVmaW5pc2goc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnByZWZpbmlzaGVkICYmICFzdGF0ZS5maW5hbENhbGxlZCkge1xuICAgIGlmICh0eXBlb2Ygc3RyZWFtLl9maW5hbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgc3RhdGUucGVuZGluZ2NiKys7XG4gICAgICBzdGF0ZS5maW5hbENhbGxlZCA9IHRydWU7XG4gICAgICBwbmEubmV4dFRpY2soY2FsbEZpbmFsLCBzdHJlYW0sIHN0YXRlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUucHJlZmluaXNoZWQgPSB0cnVlO1xuICAgICAgc3RyZWFtLmVtaXQoJ3ByZWZpbmlzaCcpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKSB7XG4gIHZhciBuZWVkID0gbmVlZEZpbmlzaChzdGF0ZSk7XG4gIGlmIChuZWVkKSB7XG4gICAgcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICAgIGlmIChzdGF0ZS5wZW5kaW5nY2IgPT09IDApIHtcbiAgICAgIHN0YXRlLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5lbWl0KCdmaW5pc2gnKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5lZWQ7XG59XG5cbmZ1bmN0aW9uIGVuZFdyaXRhYmxlKHN0cmVhbSwgc3RhdGUsIGNiKSB7XG4gIHN0YXRlLmVuZGluZyA9IHRydWU7XG4gIGZpbmlzaE1heWJlKHN0cmVhbSwgc3RhdGUpO1xuICBpZiAoY2IpIHtcbiAgICBpZiAoc3RhdGUuZmluaXNoZWQpIHBuYS5uZXh0VGljayhjYik7ZWxzZSBzdHJlYW0ub25jZSgnZmluaXNoJywgY2IpO1xuICB9XG4gIHN0YXRlLmVuZGVkID0gdHJ1ZTtcbiAgc3RyZWFtLndyaXRhYmxlID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG9uQ29ya2VkRmluaXNoKGNvcmtSZXEsIHN0YXRlLCBlcnIpIHtcbiAgdmFyIGVudHJ5ID0gY29ya1JlcS5lbnRyeTtcbiAgY29ya1JlcS5lbnRyeSA9IG51bGw7XG4gIHdoaWxlIChlbnRyeSkge1xuICAgIHZhciBjYiA9IGVudHJ5LmNhbGxiYWNrO1xuICAgIHN0YXRlLnBlbmRpbmdjYi0tO1xuICAgIGNiKGVycik7XG4gICAgZW50cnkgPSBlbnRyeS5uZXh0O1xuICB9XG4gIGlmIChzdGF0ZS5jb3JrZWRSZXF1ZXN0c0ZyZWUpIHtcbiAgICBzdGF0ZS5jb3JrZWRSZXF1ZXN0c0ZyZWUubmV4dCA9IGNvcmtSZXE7XG4gIH0gZWxzZSB7XG4gICAgc3RhdGUuY29ya2VkUmVxdWVzdHNGcmVlID0gY29ya1JlcTtcbiAgfVxufVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoV3JpdGFibGUucHJvdG90eXBlLCAnZGVzdHJveWVkJywge1xuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fd3JpdGFibGVTdGF0ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl93cml0YWJsZVN0YXRlLmRlc3Ryb3llZDtcbiAgfSxcbiAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAvLyB3ZSBpZ25vcmUgdGhlIHZhbHVlIGlmIHRoZSBzdHJlYW1cbiAgICAvLyBoYXMgbm90IGJlZW4gaW5pdGlhbGl6ZWQgeWV0XG4gICAgaWYgKCF0aGlzLl93cml0YWJsZVN0YXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gYmFja3dhcmQgY29tcGF0aWJpbGl0eSwgdGhlIHVzZXIgaXMgZXhwbGljaXRseVxuICAgIC8vIG1hbmFnaW5nIGRlc3Ryb3llZFxuICAgIHRoaXMuX3dyaXRhYmxlU3RhdGUuZGVzdHJveWVkID0gdmFsdWU7XG4gIH1cbn0pO1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuZGVzdHJveSA9IGRlc3Ryb3lJbXBsLmRlc3Ryb3k7XG5Xcml0YWJsZS5wcm90b3R5cGUuX3VuZGVzdHJveSA9IGRlc3Ryb3lJbXBsLnVuZGVzdHJveTtcbldyaXRhYmxlLnByb3RvdHlwZS5fZGVzdHJveSA9IGZ1bmN0aW9uIChlcnIsIGNiKSB7XG4gIHRoaXMuZW5kKCk7XG4gIGNiKGVycik7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ3NhZmUtYnVmZmVyJykuQnVmZmVyO1xudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cbmZ1bmN0aW9uIGNvcHlCdWZmZXIoc3JjLCB0YXJnZXQsIG9mZnNldCkge1xuICBzcmMuY29weSh0YXJnZXQsIG9mZnNldCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBCdWZmZXJMaXN0KCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBCdWZmZXJMaXN0KTtcblxuICAgIHRoaXMuaGVhZCA9IG51bGw7XG4gICAgdGhpcy50YWlsID0gbnVsbDtcbiAgICB0aGlzLmxlbmd0aCA9IDA7XG4gIH1cblxuICBCdWZmZXJMaXN0LnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gcHVzaCh2KSB7XG4gICAgdmFyIGVudHJ5ID0geyBkYXRhOiB2LCBuZXh0OiBudWxsIH07XG4gICAgaWYgKHRoaXMubGVuZ3RoID4gMCkgdGhpcy50YWlsLm5leHQgPSBlbnRyeTtlbHNlIHRoaXMuaGVhZCA9IGVudHJ5O1xuICAgIHRoaXMudGFpbCA9IGVudHJ5O1xuICAgICsrdGhpcy5sZW5ndGg7XG4gIH07XG5cbiAgQnVmZmVyTGlzdC5wcm90b3R5cGUudW5zaGlmdCA9IGZ1bmN0aW9uIHVuc2hpZnQodikge1xuICAgIHZhciBlbnRyeSA9IHsgZGF0YTogdiwgbmV4dDogdGhpcy5oZWFkIH07XG4gICAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSB0aGlzLnRhaWwgPSBlbnRyeTtcbiAgICB0aGlzLmhlYWQgPSBlbnRyeTtcbiAgICArK3RoaXMubGVuZ3RoO1xuICB9O1xuXG4gIEJ1ZmZlckxpc3QucHJvdG90eXBlLnNoaWZ0ID0gZnVuY3Rpb24gc2hpZnQoKSB7XG4gICAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgdmFyIHJldCA9IHRoaXMuaGVhZC5kYXRhO1xuICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gMSkgdGhpcy5oZWFkID0gdGhpcy50YWlsID0gbnVsbDtlbHNlIHRoaXMuaGVhZCA9IHRoaXMuaGVhZC5uZXh0O1xuICAgIC0tdGhpcy5sZW5ndGg7XG4gICAgcmV0dXJuIHJldDtcbiAgfTtcblxuICBCdWZmZXJMaXN0LnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uIGNsZWFyKCkge1xuICAgIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IG51bGw7XG4gICAgdGhpcy5sZW5ndGggPSAwO1xuICB9O1xuXG4gIEJ1ZmZlckxpc3QucHJvdG90eXBlLmpvaW4gPSBmdW5jdGlvbiBqb2luKHMpIHtcbiAgICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAnJztcbiAgICB2YXIgcCA9IHRoaXMuaGVhZDtcbiAgICB2YXIgcmV0ID0gJycgKyBwLmRhdGE7XG4gICAgd2hpbGUgKHAgPSBwLm5leHQpIHtcbiAgICAgIHJldCArPSBzICsgcC5kYXRhO1xuICAgIH1yZXR1cm4gcmV0O1xuICB9O1xuXG4gIEJ1ZmZlckxpc3QucHJvdG90eXBlLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdChuKSB7XG4gICAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gQnVmZmVyLmFsbG9jKDApO1xuICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gMSkgcmV0dXJuIHRoaXMuaGVhZC5kYXRhO1xuICAgIHZhciByZXQgPSBCdWZmZXIuYWxsb2NVbnNhZmUobiA+Pj4gMCk7XG4gICAgdmFyIHAgPSB0aGlzLmhlYWQ7XG4gICAgdmFyIGkgPSAwO1xuICAgIHdoaWxlIChwKSB7XG4gICAgICBjb3B5QnVmZmVyKHAuZGF0YSwgcmV0LCBpKTtcbiAgICAgIGkgKz0gcC5kYXRhLmxlbmd0aDtcbiAgICAgIHAgPSBwLm5leHQ7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH07XG5cbiAgcmV0dXJuIEJ1ZmZlckxpc3Q7XG59KCk7XG5cbmlmICh1dGlsICYmIHV0aWwuaW5zcGVjdCAmJiB1dGlsLmluc3BlY3QuY3VzdG9tKSB7XG4gIG1vZHVsZS5leHBvcnRzLnByb3RvdHlwZVt1dGlsLmluc3BlY3QuY3VzdG9tXSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb2JqID0gdXRpbC5pbnNwZWN0KHsgbGVuZ3RoOiB0aGlzLmxlbmd0aCB9KTtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgJyAnICsgb2JqO1xuICB9O1xufSIsIid1c2Ugc3RyaWN0JztcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cblxudmFyIHBuYSA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuLy8gdW5kb2N1bWVudGVkIGNiKCkgQVBJLCBuZWVkZWQgZm9yIGNvcmUsIG5vdCBmb3IgcHVibGljIEFQSVxuZnVuY3Rpb24gZGVzdHJveShlcnIsIGNiKSB7XG4gIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgdmFyIHJlYWRhYmxlRGVzdHJveWVkID0gdGhpcy5fcmVhZGFibGVTdGF0ZSAmJiB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlc3Ryb3llZDtcbiAgdmFyIHdyaXRhYmxlRGVzdHJveWVkID0gdGhpcy5fd3JpdGFibGVTdGF0ZSAmJiB0aGlzLl93cml0YWJsZVN0YXRlLmRlc3Ryb3llZDtcblxuICBpZiAocmVhZGFibGVEZXN0cm95ZWQgfHwgd3JpdGFibGVEZXN0cm95ZWQpIHtcbiAgICBpZiAoY2IpIHtcbiAgICAgIGNiKGVycik7XG4gICAgfSBlbHNlIGlmIChlcnIgJiYgKCF0aGlzLl93cml0YWJsZVN0YXRlIHx8ICF0aGlzLl93cml0YWJsZVN0YXRlLmVycm9yRW1pdHRlZCkpIHtcbiAgICAgIHBuYS5uZXh0VGljayhlbWl0RXJyb3JOVCwgdGhpcywgZXJyKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyB3ZSBzZXQgZGVzdHJveWVkIHRvIHRydWUgYmVmb3JlIGZpcmluZyBlcnJvciBjYWxsYmFja3MgaW4gb3JkZXJcbiAgLy8gdG8gbWFrZSBpdCByZS1lbnRyYW5jZSBzYWZlIGluIGNhc2UgZGVzdHJveSgpIGlzIGNhbGxlZCB3aXRoaW4gY2FsbGJhY2tzXG5cbiAgaWYgKHRoaXMuX3JlYWRhYmxlU3RhdGUpIHtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlc3Ryb3llZCA9IHRydWU7XG4gIH1cblxuICAvLyBpZiB0aGlzIGlzIGEgZHVwbGV4IHN0cmVhbSBtYXJrIHRoZSB3cml0YWJsZSBwYXJ0IGFzIGRlc3Ryb3llZCBhcyB3ZWxsXG4gIGlmICh0aGlzLl93cml0YWJsZVN0YXRlKSB7XG4gICAgdGhpcy5fd3JpdGFibGVTdGF0ZS5kZXN0cm95ZWQgPSB0cnVlO1xuICB9XG5cbiAgdGhpcy5fZGVzdHJveShlcnIgfHwgbnVsbCwgZnVuY3Rpb24gKGVycikge1xuICAgIGlmICghY2IgJiYgZXJyKSB7XG4gICAgICBwbmEubmV4dFRpY2soZW1pdEVycm9yTlQsIF90aGlzLCBlcnIpO1xuICAgICAgaWYgKF90aGlzLl93cml0YWJsZVN0YXRlKSB7XG4gICAgICAgIF90aGlzLl93cml0YWJsZVN0YXRlLmVycm9yRW1pdHRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjYikge1xuICAgICAgY2IoZXJyKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzO1xufVxuXG5mdW5jdGlvbiB1bmRlc3Ryb3koKSB7XG4gIGlmICh0aGlzLl9yZWFkYWJsZVN0YXRlKSB7XG4gICAgdGhpcy5fcmVhZGFibGVTdGF0ZS5kZXN0cm95ZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLnJlYWRpbmcgPSBmYWxzZTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmVuZGVkID0gZmFsc2U7XG4gICAgdGhpcy5fcmVhZGFibGVTdGF0ZS5lbmRFbWl0dGVkID0gZmFsc2U7XG4gIH1cblxuICBpZiAodGhpcy5fd3JpdGFibGVTdGF0ZSkge1xuICAgIHRoaXMuX3dyaXRhYmxlU3RhdGUuZGVzdHJveWVkID0gZmFsc2U7XG4gICAgdGhpcy5fd3JpdGFibGVTdGF0ZS5lbmRlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3dyaXRhYmxlU3RhdGUuZW5kaW5nID0gZmFsc2U7XG4gICAgdGhpcy5fd3JpdGFibGVTdGF0ZS5maW5pc2hlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3dyaXRhYmxlU3RhdGUuZXJyb3JFbWl0dGVkID0gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gZW1pdEVycm9yTlQoc2VsZiwgZXJyKSB7XG4gIHNlbGYuZW1pdCgnZXJyb3InLCBlcnIpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZGVzdHJveTogZGVzdHJveSxcbiAgdW5kZXN0cm95OiB1bmRlc3Ryb3lcbn07IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG4iLCJ2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbi8qPHJlcGxhY2VtZW50PiovXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdzYWZlLWJ1ZmZlcicpLkJ1ZmZlcjtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG52YXIgaXNFbmNvZGluZyA9IEJ1ZmZlci5pc0VuY29kaW5nIHx8IGZ1bmN0aW9uIChlbmNvZGluZykge1xuICBlbmNvZGluZyA9ICcnICsgZW5jb2Rpbmc7XG4gIHN3aXRjaCAoZW5jb2RpbmcgJiYgZW5jb2RpbmcudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6Y2FzZSAndXRmOCc6Y2FzZSAndXRmLTgnOmNhc2UgJ2FzY2lpJzpjYXNlICdiaW5hcnknOmNhc2UgJ2Jhc2U2NCc6Y2FzZSAndWNzMic6Y2FzZSAndWNzLTInOmNhc2UgJ3V0ZjE2bGUnOmNhc2UgJ3V0Zi0xNmxlJzpjYXNlICdyYXcnOlxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxufTtcblxuZnVuY3Rpb24gX25vcm1hbGl6ZUVuY29kaW5nKGVuYykge1xuICBpZiAoIWVuYykgcmV0dXJuICd1dGY4JztcbiAgdmFyIHJldHJpZWQ7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmMpIHtcbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gJ3V0ZjgnO1xuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuICd1dGYxNmxlJztcbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gJ2xhdGluMSc7XG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGVuYztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChyZXRyaWVkKSByZXR1cm47IC8vIHVuZGVmaW5lZFxuICAgICAgICBlbmMgPSAoJycgKyBlbmMpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHJldHJpZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxufTtcblxuLy8gRG8gbm90IGNhY2hlIGBCdWZmZXIuaXNFbmNvZGluZ2Agd2hlbiBjaGVja2luZyBlbmNvZGluZyBuYW1lcyBhcyBzb21lXG4vLyBtb2R1bGVzIG1vbmtleS1wYXRjaCBpdCB0byBzdXBwb3J0IGFkZGl0aW9uYWwgZW5jb2RpbmdzXG5mdW5jdGlvbiBub3JtYWxpemVFbmNvZGluZyhlbmMpIHtcbiAgdmFyIG5lbmMgPSBfbm9ybWFsaXplRW5jb2RpbmcoZW5jKTtcbiAgaWYgKHR5cGVvZiBuZW5jICE9PSAnc3RyaW5nJyAmJiAoQnVmZmVyLmlzRW5jb2RpbmcgPT09IGlzRW5jb2RpbmcgfHwgIWlzRW5jb2RpbmcoZW5jKSkpIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuYyk7XG4gIHJldHVybiBuZW5jIHx8IGVuYztcbn1cblxuLy8gU3RyaW5nRGVjb2RlciBwcm92aWRlcyBhbiBpbnRlcmZhY2UgZm9yIGVmZmljaWVudGx5IHNwbGl0dGluZyBhIHNlcmllcyBvZlxuLy8gYnVmZmVycyBpbnRvIGEgc2VyaWVzIG9mIEpTIHN0cmluZ3Mgd2l0aG91dCBicmVha2luZyBhcGFydCBtdWx0aS1ieXRlXG4vLyBjaGFyYWN0ZXJzLlxuZXhwb3J0cy5TdHJpbmdEZWNvZGVyID0gU3RyaW5nRGVjb2RlcjtcbmZ1bmN0aW9uIFN0cmluZ0RlY29kZXIoZW5jb2RpbmcpIHtcbiAgdGhpcy5lbmNvZGluZyA9IG5vcm1hbGl6ZUVuY29kaW5nKGVuY29kaW5nKTtcbiAgdmFyIG5iO1xuICBzd2l0Y2ggKHRoaXMuZW5jb2RpbmcpIHtcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIHRoaXMudGV4dCA9IHV0ZjE2VGV4dDtcbiAgICAgIHRoaXMuZW5kID0gdXRmMTZFbmQ7XG4gICAgICBuYiA9IDQ7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1dGY4JzpcbiAgICAgIHRoaXMuZmlsbExhc3QgPSB1dGY4RmlsbExhc3Q7XG4gICAgICBuYiA9IDQ7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgdGhpcy50ZXh0ID0gYmFzZTY0VGV4dDtcbiAgICAgIHRoaXMuZW5kID0gYmFzZTY0RW5kO1xuICAgICAgbmIgPSAzO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRoaXMud3JpdGUgPSBzaW1wbGVXcml0ZTtcbiAgICAgIHRoaXMuZW5kID0gc2ltcGxlRW5kO1xuICAgICAgcmV0dXJuO1xuICB9XG4gIHRoaXMubGFzdE5lZWQgPSAwO1xuICB0aGlzLmxhc3RUb3RhbCA9IDA7XG4gIHRoaXMubGFzdENoYXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobmIpO1xufVxuXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChidWYpIHtcbiAgaWYgKGJ1Zi5sZW5ndGggPT09IDApIHJldHVybiAnJztcbiAgdmFyIHI7XG4gIHZhciBpO1xuICBpZiAodGhpcy5sYXN0TmVlZCkge1xuICAgIHIgPSB0aGlzLmZpbGxMYXN0KGJ1Zik7XG4gICAgaWYgKHIgPT09IHVuZGVmaW5lZCkgcmV0dXJuICcnO1xuICAgIGkgPSB0aGlzLmxhc3ROZWVkO1xuICAgIHRoaXMubGFzdE5lZWQgPSAwO1xuICB9IGVsc2Uge1xuICAgIGkgPSAwO1xuICB9XG4gIGlmIChpIDwgYnVmLmxlbmd0aCkgcmV0dXJuIHIgPyByICsgdGhpcy50ZXh0KGJ1ZiwgaSkgOiB0aGlzLnRleHQoYnVmLCBpKTtcbiAgcmV0dXJuIHIgfHwgJyc7XG59O1xuXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS5lbmQgPSB1dGY4RW5kO1xuXG4vLyBSZXR1cm5zIG9ubHkgY29tcGxldGUgY2hhcmFjdGVycyBpbiBhIEJ1ZmZlclxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUudGV4dCA9IHV0ZjhUZXh0O1xuXG4vLyBBdHRlbXB0cyB0byBjb21wbGV0ZSBhIHBhcnRpYWwgbm9uLVVURi04IGNoYXJhY3RlciB1c2luZyBieXRlcyBmcm9tIGEgQnVmZmVyXG5TdHJpbmdEZWNvZGVyLnByb3RvdHlwZS5maWxsTGFzdCA9IGZ1bmN0aW9uIChidWYpIHtcbiAgaWYgKHRoaXMubGFzdE5lZWQgPD0gYnVmLmxlbmd0aCkge1xuICAgIGJ1Zi5jb3B5KHRoaXMubGFzdENoYXIsIHRoaXMubGFzdFRvdGFsIC0gdGhpcy5sYXN0TmVlZCwgMCwgdGhpcy5sYXN0TmVlZCk7XG4gICAgcmV0dXJuIHRoaXMubGFzdENoYXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgdGhpcy5sYXN0VG90YWwpO1xuICB9XG4gIGJ1Zi5jb3B5KHRoaXMubGFzdENoYXIsIHRoaXMubGFzdFRvdGFsIC0gdGhpcy5sYXN0TmVlZCwgMCwgYnVmLmxlbmd0aCk7XG4gIHRoaXMubGFzdE5lZWQgLT0gYnVmLmxlbmd0aDtcbn07XG5cbi8vIENoZWNrcyB0aGUgdHlwZSBvZiBhIFVURi04IGJ5dGUsIHdoZXRoZXIgaXQncyBBU0NJSSwgYSBsZWFkaW5nIGJ5dGUsIG9yIGFcbi8vIGNvbnRpbnVhdGlvbiBieXRlLiBJZiBhbiBpbnZhbGlkIGJ5dGUgaXMgZGV0ZWN0ZWQsIC0yIGlzIHJldHVybmVkLlxuZnVuY3Rpb24gdXRmOENoZWNrQnl0ZShieXRlKSB7XG4gIGlmIChieXRlIDw9IDB4N0YpIHJldHVybiAwO2Vsc2UgaWYgKGJ5dGUgPj4gNSA9PT0gMHgwNikgcmV0dXJuIDI7ZWxzZSBpZiAoYnl0ZSA+PiA0ID09PSAweDBFKSByZXR1cm4gMztlbHNlIGlmIChieXRlID4+IDMgPT09IDB4MUUpIHJldHVybiA0O1xuICByZXR1cm4gYnl0ZSA+PiA2ID09PSAweDAyID8gLTEgOiAtMjtcbn1cblxuLy8gQ2hlY2tzIGF0IG1vc3QgMyBieXRlcyBhdCB0aGUgZW5kIG9mIGEgQnVmZmVyIGluIG9yZGVyIHRvIGRldGVjdCBhblxuLy8gaW5jb21wbGV0ZSBtdWx0aS1ieXRlIFVURi04IGNoYXJhY3Rlci4gVGhlIHRvdGFsIG51bWJlciBvZiBieXRlcyAoMiwgMywgb3IgNClcbi8vIG5lZWRlZCB0byBjb21wbGV0ZSB0aGUgVVRGLTggY2hhcmFjdGVyIChpZiBhcHBsaWNhYmxlKSBhcmUgcmV0dXJuZWQuXG5mdW5jdGlvbiB1dGY4Q2hlY2tJbmNvbXBsZXRlKHNlbGYsIGJ1ZiwgaSkge1xuICB2YXIgaiA9IGJ1Zi5sZW5ndGggLSAxO1xuICBpZiAoaiA8IGkpIHJldHVybiAwO1xuICB2YXIgbmIgPSB1dGY4Q2hlY2tCeXRlKGJ1ZltqXSk7XG4gIGlmIChuYiA+PSAwKSB7XG4gICAgaWYgKG5iID4gMCkgc2VsZi5sYXN0TmVlZCA9IG5iIC0gMTtcbiAgICByZXR1cm4gbmI7XG4gIH1cbiAgaWYgKC0taiA8IGkgfHwgbmIgPT09IC0yKSByZXR1cm4gMDtcbiAgbmIgPSB1dGY4Q2hlY2tCeXRlKGJ1ZltqXSk7XG4gIGlmIChuYiA+PSAwKSB7XG4gICAgaWYgKG5iID4gMCkgc2VsZi5sYXN0TmVlZCA9IG5iIC0gMjtcbiAgICByZXR1cm4gbmI7XG4gIH1cbiAgaWYgKC0taiA8IGkgfHwgbmIgPT09IC0yKSByZXR1cm4gMDtcbiAgbmIgPSB1dGY4Q2hlY2tCeXRlKGJ1ZltqXSk7XG4gIGlmIChuYiA+PSAwKSB7XG4gICAgaWYgKG5iID4gMCkge1xuICAgICAgaWYgKG5iID09PSAyKSBuYiA9IDA7ZWxzZSBzZWxmLmxhc3ROZWVkID0gbmIgLSAzO1xuICAgIH1cbiAgICByZXR1cm4gbmI7XG4gIH1cbiAgcmV0dXJuIDA7XG59XG5cbi8vIFZhbGlkYXRlcyBhcyBtYW55IGNvbnRpbnVhdGlvbiBieXRlcyBmb3IgYSBtdWx0aS1ieXRlIFVURi04IGNoYXJhY3RlciBhc1xuLy8gbmVlZGVkIG9yIGFyZSBhdmFpbGFibGUuIElmIHdlIHNlZSBhIG5vbi1jb250aW51YXRpb24gYnl0ZSB3aGVyZSB3ZSBleHBlY3Rcbi8vIG9uZSwgd2UgXCJyZXBsYWNlXCIgdGhlIHZhbGlkYXRlZCBjb250aW51YXRpb24gYnl0ZXMgd2UndmUgc2VlbiBzbyBmYXIgd2l0aFxuLy8gYSBzaW5nbGUgVVRGLTggcmVwbGFjZW1lbnQgY2hhcmFjdGVyICgnXFx1ZmZmZCcpLCB0byBtYXRjaCB2OCdzIFVURi04IGRlY29kaW5nXG4vLyBiZWhhdmlvci4gVGhlIGNvbnRpbnVhdGlvbiBieXRlIGNoZWNrIGlzIGluY2x1ZGVkIHRocmVlIHRpbWVzIGluIHRoZSBjYXNlXG4vLyB3aGVyZSBhbGwgb2YgdGhlIGNvbnRpbnVhdGlvbiBieXRlcyBmb3IgYSBjaGFyYWN0ZXIgZXhpc3QgaW4gdGhlIHNhbWUgYnVmZmVyLlxuLy8gSXQgaXMgYWxzbyBkb25lIHRoaXMgd2F5IGFzIGEgc2xpZ2h0IHBlcmZvcm1hbmNlIGluY3JlYXNlIGluc3RlYWQgb2YgdXNpbmcgYVxuLy8gbG9vcC5cbmZ1bmN0aW9uIHV0ZjhDaGVja0V4dHJhQnl0ZXMoc2VsZiwgYnVmLCBwKSB7XG4gIGlmICgoYnVmWzBdICYgMHhDMCkgIT09IDB4ODApIHtcbiAgICBzZWxmLmxhc3ROZWVkID0gMDtcbiAgICByZXR1cm4gJ1xcdWZmZmQnO1xuICB9XG4gIGlmIChzZWxmLmxhc3ROZWVkID4gMSAmJiBidWYubGVuZ3RoID4gMSkge1xuICAgIGlmICgoYnVmWzFdICYgMHhDMCkgIT09IDB4ODApIHtcbiAgICAgIHNlbGYubGFzdE5lZWQgPSAxO1xuICAgICAgcmV0dXJuICdcXHVmZmZkJztcbiAgICB9XG4gICAgaWYgKHNlbGYubGFzdE5lZWQgPiAyICYmIGJ1Zi5sZW5ndGggPiAyKSB7XG4gICAgICBpZiAoKGJ1ZlsyXSAmIDB4QzApICE9PSAweDgwKSB7XG4gICAgICAgIHNlbGYubGFzdE5lZWQgPSAyO1xuICAgICAgICByZXR1cm4gJ1xcdWZmZmQnO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vLyBBdHRlbXB0cyB0byBjb21wbGV0ZSBhIG11bHRpLWJ5dGUgVVRGLTggY2hhcmFjdGVyIHVzaW5nIGJ5dGVzIGZyb20gYSBCdWZmZXIuXG5mdW5jdGlvbiB1dGY4RmlsbExhc3QoYnVmKSB7XG4gIHZhciBwID0gdGhpcy5sYXN0VG90YWwgLSB0aGlzLmxhc3ROZWVkO1xuICB2YXIgciA9IHV0ZjhDaGVja0V4dHJhQnl0ZXModGhpcywgYnVmLCBwKTtcbiAgaWYgKHIgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHI7XG4gIGlmICh0aGlzLmxhc3ROZWVkIDw9IGJ1Zi5sZW5ndGgpIHtcbiAgICBidWYuY29weSh0aGlzLmxhc3RDaGFyLCBwLCAwLCB0aGlzLmxhc3ROZWVkKTtcbiAgICByZXR1cm4gdGhpcy5sYXN0Q2hhci50b1N0cmluZyh0aGlzLmVuY29kaW5nLCAwLCB0aGlzLmxhc3RUb3RhbCk7XG4gIH1cbiAgYnVmLmNvcHkodGhpcy5sYXN0Q2hhciwgcCwgMCwgYnVmLmxlbmd0aCk7XG4gIHRoaXMubGFzdE5lZWQgLT0gYnVmLmxlbmd0aDtcbn1cblxuLy8gUmV0dXJucyBhbGwgY29tcGxldGUgVVRGLTggY2hhcmFjdGVycyBpbiBhIEJ1ZmZlci4gSWYgdGhlIEJ1ZmZlciBlbmRlZCBvbiBhXG4vLyBwYXJ0aWFsIGNoYXJhY3RlciwgdGhlIGNoYXJhY3RlcidzIGJ5dGVzIGFyZSBidWZmZXJlZCB1bnRpbCB0aGUgcmVxdWlyZWRcbi8vIG51bWJlciBvZiBieXRlcyBhcmUgYXZhaWxhYmxlLlxuZnVuY3Rpb24gdXRmOFRleHQoYnVmLCBpKSB7XG4gIHZhciB0b3RhbCA9IHV0ZjhDaGVja0luY29tcGxldGUodGhpcywgYnVmLCBpKTtcbiAgaWYgKCF0aGlzLmxhc3ROZWVkKSByZXR1cm4gYnVmLnRvU3RyaW5nKCd1dGY4JywgaSk7XG4gIHRoaXMubGFzdFRvdGFsID0gdG90YWw7XG4gIHZhciBlbmQgPSBidWYubGVuZ3RoIC0gKHRvdGFsIC0gdGhpcy5sYXN0TmVlZCk7XG4gIGJ1Zi5jb3B5KHRoaXMubGFzdENoYXIsIDAsIGVuZCk7XG4gIHJldHVybiBidWYudG9TdHJpbmcoJ3V0ZjgnLCBpLCBlbmQpO1xufVxuXG4vLyBGb3IgVVRGLTgsIGEgcmVwbGFjZW1lbnQgY2hhcmFjdGVyIGlzIGFkZGVkIHdoZW4gZW5kaW5nIG9uIGEgcGFydGlhbFxuLy8gY2hhcmFjdGVyLlxuZnVuY3Rpb24gdXRmOEVuZChidWYpIHtcbiAgdmFyIHIgPSBidWYgJiYgYnVmLmxlbmd0aCA/IHRoaXMud3JpdGUoYnVmKSA6ICcnO1xuICBpZiAodGhpcy5sYXN0TmVlZCkgcmV0dXJuIHIgKyAnXFx1ZmZmZCc7XG4gIHJldHVybiByO1xufVxuXG4vLyBVVEYtMTZMRSB0eXBpY2FsbHkgbmVlZHMgdHdvIGJ5dGVzIHBlciBjaGFyYWN0ZXIsIGJ1dCBldmVuIGlmIHdlIGhhdmUgYW4gZXZlblxuLy8gbnVtYmVyIG9mIGJ5dGVzIGF2YWlsYWJsZSwgd2UgbmVlZCB0byBjaGVjayBpZiB3ZSBlbmQgb24gYSBsZWFkaW5nL2hpZ2hcbi8vIHN1cnJvZ2F0ZS4gSW4gdGhhdCBjYXNlLCB3ZSBuZWVkIHRvIHdhaXQgZm9yIHRoZSBuZXh0IHR3byBieXRlcyBpbiBvcmRlciB0b1xuLy8gZGVjb2RlIHRoZSBsYXN0IGNoYXJhY3RlciBwcm9wZXJseS5cbmZ1bmN0aW9uIHV0ZjE2VGV4dChidWYsIGkpIHtcbiAgaWYgKChidWYubGVuZ3RoIC0gaSkgJSAyID09PSAwKSB7XG4gICAgdmFyIHIgPSBidWYudG9TdHJpbmcoJ3V0ZjE2bGUnLCBpKTtcbiAgICBpZiAocikge1xuICAgICAgdmFyIGMgPSByLmNoYXJDb2RlQXQoci5sZW5ndGggLSAxKTtcbiAgICAgIGlmIChjID49IDB4RDgwMCAmJiBjIDw9IDB4REJGRikge1xuICAgICAgICB0aGlzLmxhc3ROZWVkID0gMjtcbiAgICAgICAgdGhpcy5sYXN0VG90YWwgPSA0O1xuICAgICAgICB0aGlzLmxhc3RDaGFyWzBdID0gYnVmW2J1Zi5sZW5ndGggLSAyXTtcbiAgICAgICAgdGhpcy5sYXN0Q2hhclsxXSA9IGJ1ZltidWYubGVuZ3RoIC0gMV07XG4gICAgICAgIHJldHVybiByLnNsaWNlKDAsIC0xKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHI7XG4gIH1cbiAgdGhpcy5sYXN0TmVlZCA9IDE7XG4gIHRoaXMubGFzdFRvdGFsID0gMjtcbiAgdGhpcy5sYXN0Q2hhclswXSA9IGJ1ZltidWYubGVuZ3RoIC0gMV07XG4gIHJldHVybiBidWYudG9TdHJpbmcoJ3V0ZjE2bGUnLCBpLCBidWYubGVuZ3RoIC0gMSk7XG59XG5cbi8vIEZvciBVVEYtMTZMRSB3ZSBkbyBub3QgZXhwbGljaXRseSBhcHBlbmQgc3BlY2lhbCByZXBsYWNlbWVudCBjaGFyYWN0ZXJzIGlmIHdlXG4vLyBlbmQgb24gYSBwYXJ0aWFsIGNoYXJhY3Rlciwgd2Ugc2ltcGx5IGxldCB2OCBoYW5kbGUgdGhhdC5cbmZ1bmN0aW9uIHV0ZjE2RW5kKGJ1Zikge1xuICB2YXIgciA9IGJ1ZiAmJiBidWYubGVuZ3RoID8gdGhpcy53cml0ZShidWYpIDogJyc7XG4gIGlmICh0aGlzLmxhc3ROZWVkKSB7XG4gICAgdmFyIGVuZCA9IHRoaXMubGFzdFRvdGFsIC0gdGhpcy5sYXN0TmVlZDtcbiAgICByZXR1cm4gciArIHRoaXMubGFzdENoYXIudG9TdHJpbmcoJ3V0ZjE2bGUnLCAwLCBlbmQpO1xuICB9XG4gIHJldHVybiByO1xufVxuXG5mdW5jdGlvbiBiYXNlNjRUZXh0KGJ1ZiwgaSkge1xuICB2YXIgbiA9IChidWYubGVuZ3RoIC0gaSkgJSAzO1xuICBpZiAobiA9PT0gMCkgcmV0dXJuIGJ1Zi50b1N0cmluZygnYmFzZTY0JywgaSk7XG4gIHRoaXMubGFzdE5lZWQgPSAzIC0gbjtcbiAgdGhpcy5sYXN0VG90YWwgPSAzO1xuICBpZiAobiA9PT0gMSkge1xuICAgIHRoaXMubGFzdENoYXJbMF0gPSBidWZbYnVmLmxlbmd0aCAtIDFdO1xuICB9IGVsc2Uge1xuICAgIHRoaXMubGFzdENoYXJbMF0gPSBidWZbYnVmLmxlbmd0aCAtIDJdO1xuICAgIHRoaXMubGFzdENoYXJbMV0gPSBidWZbYnVmLmxlbmd0aCAtIDFdO1xuICB9XG4gIHJldHVybiBidWYudG9TdHJpbmcoJ2Jhc2U2NCcsIGksIGJ1Zi5sZW5ndGggLSBuKTtcbn1cblxuZnVuY3Rpb24gYmFzZTY0RW5kKGJ1Zikge1xuICB2YXIgciA9IGJ1ZiAmJiBidWYubGVuZ3RoID8gdGhpcy53cml0ZShidWYpIDogJyc7XG4gIGlmICh0aGlzLmxhc3ROZWVkKSByZXR1cm4gciArIHRoaXMubGFzdENoYXIudG9TdHJpbmcoJ2Jhc2U2NCcsIDAsIDMgLSB0aGlzLmxhc3ROZWVkKTtcbiAgcmV0dXJuIHI7XG59XG5cbi8vIFBhc3MgYnl0ZXMgb24gdGhyb3VnaCBmb3Igc2luZ2xlLWJ5dGUgZW5jb2RpbmdzIChlLmcuIGFzY2lpLCBsYXRpbjEsIGhleClcbmZ1bmN0aW9uIHNpbXBsZVdyaXRlKGJ1Zikge1xuICByZXR1cm4gYnVmLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcpO1xufVxuXG5mdW5jdGlvbiBzaW1wbGVFbmQoYnVmKSB7XG4gIHJldHVybiBidWYgJiYgYnVmLmxlbmd0aCA/IHRoaXMud3JpdGUoYnVmKSA6ICcnO1xufSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9yZWFkYWJsZScpLlBhc3NUaHJvdWdoXG4iLCJleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3JlYWRhYmxlLmpzJyk7XG5leHBvcnRzLlN0cmVhbSA9IGV4cG9ydHM7XG5leHBvcnRzLlJlYWRhYmxlID0gZXhwb3J0cztcbmV4cG9ydHMuV3JpdGFibGUgPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3dyaXRhYmxlLmpzJyk7XG5leHBvcnRzLkR1cGxleCA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fZHVwbGV4LmpzJyk7XG5leHBvcnRzLlRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzJyk7XG5leHBvcnRzLlBhc3NUaHJvdWdoID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qcycpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3JlYWRhYmxlJykuVHJhbnNmb3JtXG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fd3JpdGFibGUuanMnKTtcbiIsInZhciB0aHJvdWdoID0gcmVxdWlyZSgndGhyb3VnaCcpO1xudmFyIG5leHRUaWNrID0gdHlwZW9mIHNldEltbWVkaWF0ZSAhPT0gJ3VuZGVmaW5lZCdcbiAgICA/IHNldEltbWVkaWF0ZVxuICAgIDogcHJvY2Vzcy5uZXh0VGlja1xuO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh3cml0ZSwgZW5kKSB7XG4gICAgdmFyIHRyID0gdGhyb3VnaCh3cml0ZSwgZW5kKTtcbiAgICB0ci5wYXVzZSgpO1xuICAgIHZhciByZXN1bWUgPSB0ci5yZXN1bWU7XG4gICAgdmFyIHBhdXNlID0gdHIucGF1c2U7XG4gICAgdmFyIHBhdXNlZCA9IGZhbHNlO1xuICAgIFxuICAgIHRyLnBhdXNlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBwYXVzZWQgPSB0cnVlO1xuICAgICAgICByZXR1cm4gcGF1c2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICAgIFxuICAgIHRyLnJlc3VtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGF1c2VkID0gZmFsc2U7XG4gICAgICAgIHJldHVybiByZXN1bWUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICAgIFxuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFwYXVzZWQpIHRyLnJlc3VtZSgpO1xuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiB0cjtcbn07XG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBub2RlL25vLWRlcHJlY2F0ZWQtYXBpICovXG52YXIgYnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJylcbnZhciBCdWZmZXIgPSBidWZmZXIuQnVmZmVyXG5cbi8vIGFsdGVybmF0aXZlIHRvIHVzaW5nIE9iamVjdC5rZXlzIGZvciBvbGQgYnJvd3NlcnNcbmZ1bmN0aW9uIGNvcHlQcm9wcyAoc3JjLCBkc3QpIHtcbiAgZm9yICh2YXIga2V5IGluIHNyYykge1xuICAgIGRzdFtrZXldID0gc3JjW2tleV1cbiAgfVxufVxuaWYgKEJ1ZmZlci5mcm9tICYmIEJ1ZmZlci5hbGxvYyAmJiBCdWZmZXIuYWxsb2NVbnNhZmUgJiYgQnVmZmVyLmFsbG9jVW5zYWZlU2xvdykge1xuICBtb2R1bGUuZXhwb3J0cyA9IGJ1ZmZlclxufSBlbHNlIHtcbiAgLy8gQ29weSBwcm9wZXJ0aWVzIGZyb20gcmVxdWlyZSgnYnVmZmVyJylcbiAgY29weVByb3BzKGJ1ZmZlciwgZXhwb3J0cylcbiAgZXhwb3J0cy5CdWZmZXIgPSBTYWZlQnVmZmVyXG59XG5cbmZ1bmN0aW9uIFNhZmVCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBCdWZmZXIoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIENvcHkgc3RhdGljIG1ldGhvZHMgZnJvbSBCdWZmZXJcbmNvcHlQcm9wcyhCdWZmZXIsIFNhZmVCdWZmZXIpXG5cblNhZmVCdWZmZXIuZnJvbSA9IGZ1bmN0aW9uIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IG5vdCBiZSBhIG51bWJlcicpXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlcihhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuU2FmZUJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIG51bWJlcicpXG4gIH1cbiAgdmFyIGJ1ZiA9IEJ1ZmZlcihzaXplKVxuICBpZiAoZmlsbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGJ1Zi5maWxsKGZpbGwsIGVuY29kaW5nKVxuICAgIH0gZWxzZSB7XG4gICAgICBidWYuZmlsbChmaWxsKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBidWYuZmlsbCgwKVxuICB9XG4gIHJldHVybiBidWZcbn1cblxuU2FmZUJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgbnVtYmVyJylcbiAgfVxuICByZXR1cm4gQnVmZmVyKHNpemUpXG59XG5cblNhZmVCdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgaWYgKHR5cGVvZiBzaXplICE9PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBudW1iZXInKVxuICB9XG4gIHJldHVybiBidWZmZXIuU2xvd0J1ZmZlcihzaXplKVxufVxuIiwidmFyIENPTVBMRVRFID0gJ2NvbXBsZXRlJyxcbiAgICBDQU5DRUxFRCA9ICdjYW5jZWxlZCc7XG5cbmZ1bmN0aW9uIHJhZih0YXNrKXtcbiAgICBpZigncmVxdWVzdEFuaW1hdGlvbkZyYW1lJyBpbiB3aW5kb3cpe1xuICAgICAgICByZXR1cm4gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSh0YXNrKTtcbiAgICB9XG5cbiAgICBzZXRUaW1lb3V0KHRhc2ssIDE2KTtcbn1cblxuZnVuY3Rpb24gc2V0RWxlbWVudFNjcm9sbChlbGVtZW50LCB4LCB5KXtcbiAgICBpZihlbGVtZW50LnNlbGYgPT09IGVsZW1lbnQpe1xuICAgICAgICBlbGVtZW50LnNjcm9sbFRvKHgsIHkpO1xuICAgIH1lbHNle1xuICAgICAgICBlbGVtZW50LnNjcm9sbExlZnQgPSB4O1xuICAgICAgICBlbGVtZW50LnNjcm9sbFRvcCA9IHk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRUYXJnZXRTY3JvbGxMb2NhdGlvbih0YXJnZXQsIHBhcmVudCwgYWxpZ24pe1xuICAgIHZhciB0YXJnZXRQb3NpdGlvbiA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgcGFyZW50UG9zaXRpb24sXG4gICAgICAgIHgsXG4gICAgICAgIHksXG4gICAgICAgIGRpZmZlcmVuY2VYLFxuICAgICAgICBkaWZmZXJlbmNlWSxcbiAgICAgICAgdGFyZ2V0V2lkdGgsXG4gICAgICAgIHRhcmdldEhlaWdodCxcbiAgICAgICAgbGVmdEFsaWduID0gYWxpZ24gJiYgYWxpZ24ubGVmdCAhPSBudWxsID8gYWxpZ24ubGVmdCA6IDAuNSxcbiAgICAgICAgdG9wQWxpZ24gPSBhbGlnbiAmJiBhbGlnbi50b3AgIT0gbnVsbCA/IGFsaWduLnRvcCA6IDAuNSxcbiAgICAgICAgbGVmdE9mZnNldCA9IGFsaWduICYmIGFsaWduLmxlZnRPZmZzZXQgIT0gbnVsbCA/IGFsaWduLmxlZnRPZmZzZXQgOiAwLFxuICAgICAgICB0b3BPZmZzZXQgPSBhbGlnbiAmJiBhbGlnbi50b3BPZmZzZXQgIT0gbnVsbCA/IGFsaWduLnRvcE9mZnNldCA6IDAsXG4gICAgICAgIGxlZnRTY2FsYXIgPSBsZWZ0QWxpZ24sXG4gICAgICAgIHRvcFNjYWxhciA9IHRvcEFsaWduO1xuXG4gICAgaWYocGFyZW50LnNlbGYgPT09IHBhcmVudCl7XG4gICAgICAgIHRhcmdldFdpZHRoID0gTWF0aC5taW4odGFyZ2V0UG9zaXRpb24ud2lkdGgsIHBhcmVudC5pbm5lcldpZHRoKTtcbiAgICAgICAgdGFyZ2V0SGVpZ2h0ID0gTWF0aC5taW4odGFyZ2V0UG9zaXRpb24uaGVpZ2h0LCBwYXJlbnQuaW5uZXJIZWlnaHQpO1xuICAgICAgICB4ID0gdGFyZ2V0UG9zaXRpb24ubGVmdCArIHBhcmVudC5wYWdlWE9mZnNldCAtIHBhcmVudC5pbm5lcldpZHRoICogbGVmdFNjYWxhciArIHRhcmdldFdpZHRoICogbGVmdFNjYWxhcjtcbiAgICAgICAgeSA9IHRhcmdldFBvc2l0aW9uLnRvcCArIHBhcmVudC5wYWdlWU9mZnNldCAtIHBhcmVudC5pbm5lckhlaWdodCAqIHRvcFNjYWxhciArIHRhcmdldEhlaWdodCAqIHRvcFNjYWxhcjtcbiAgICAgICAgeCAtPSBsZWZ0T2Zmc2V0O1xuICAgICAgICB5IC09IHRvcE9mZnNldDtcbiAgICAgICAgZGlmZmVyZW5jZVggPSB4IC0gcGFyZW50LnBhZ2VYT2Zmc2V0O1xuICAgICAgICBkaWZmZXJlbmNlWSA9IHkgLSBwYXJlbnQucGFnZVlPZmZzZXQ7XG4gICAgfWVsc2V7XG4gICAgICAgIHRhcmdldFdpZHRoID0gdGFyZ2V0UG9zaXRpb24ud2lkdGg7XG4gICAgICAgIHRhcmdldEhlaWdodCA9IHRhcmdldFBvc2l0aW9uLmhlaWdodDtcbiAgICAgICAgcGFyZW50UG9zaXRpb24gPSBwYXJlbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIHZhciBvZmZzZXRMZWZ0ID0gdGFyZ2V0UG9zaXRpb24ubGVmdCAtIChwYXJlbnRQb3NpdGlvbi5sZWZ0IC0gcGFyZW50LnNjcm9sbExlZnQpO1xuICAgICAgICB2YXIgb2Zmc2V0VG9wID0gdGFyZ2V0UG9zaXRpb24udG9wIC0gKHBhcmVudFBvc2l0aW9uLnRvcCAtIHBhcmVudC5zY3JvbGxUb3ApO1xuICAgICAgICB4ID0gb2Zmc2V0TGVmdCArICh0YXJnZXRXaWR0aCAqIGxlZnRTY2FsYXIpIC0gcGFyZW50LmNsaWVudFdpZHRoICogbGVmdFNjYWxhcjtcbiAgICAgICAgeSA9IG9mZnNldFRvcCArICh0YXJnZXRIZWlnaHQgKiB0b3BTY2FsYXIpIC0gcGFyZW50LmNsaWVudEhlaWdodCAqIHRvcFNjYWxhcjtcbiAgICAgICAgeCA9IE1hdGgubWF4KE1hdGgubWluKHgsIHBhcmVudC5zY3JvbGxXaWR0aCAtIHBhcmVudC5jbGllbnRXaWR0aCksIDApO1xuICAgICAgICB5ID0gTWF0aC5tYXgoTWF0aC5taW4oeSwgcGFyZW50LnNjcm9sbEhlaWdodCAtIHBhcmVudC5jbGllbnRIZWlnaHQpLCAwKTtcbiAgICAgICAgeCAtPSBsZWZ0T2Zmc2V0O1xuICAgICAgICB5IC09IHRvcE9mZnNldDtcbiAgICAgICAgZGlmZmVyZW5jZVggPSB4IC0gcGFyZW50LnNjcm9sbExlZnQ7XG4gICAgICAgIGRpZmZlcmVuY2VZID0geSAtIHBhcmVudC5zY3JvbGxUb3A7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgeDogeCxcbiAgICAgICAgeTogeSxcbiAgICAgICAgZGlmZmVyZW5jZVg6IGRpZmZlcmVuY2VYLFxuICAgICAgICBkaWZmZXJlbmNlWTogZGlmZmVyZW5jZVlcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBhbmltYXRlKHBhcmVudCl7XG4gICAgdmFyIHNjcm9sbFNldHRpbmdzID0gcGFyZW50Ll9zY3JvbGxTZXR0aW5ncztcbiAgICBpZighc2Nyb2xsU2V0dGluZ3Mpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGxvY2F0aW9uID0gZ2V0VGFyZ2V0U2Nyb2xsTG9jYXRpb24oc2Nyb2xsU2V0dGluZ3MudGFyZ2V0LCBwYXJlbnQsIHNjcm9sbFNldHRpbmdzLmFsaWduKSxcbiAgICAgICAgdGltZSA9IERhdGUubm93KCkgLSBzY3JvbGxTZXR0aW5ncy5zdGFydFRpbWUsXG4gICAgICAgIHRpbWVWYWx1ZSA9IE1hdGgubWluKDEgLyBzY3JvbGxTZXR0aW5ncy50aW1lICogdGltZSwgMSk7XG5cbiAgICBpZihcbiAgICAgICAgdGltZSA+IHNjcm9sbFNldHRpbmdzLnRpbWUgJiZcbiAgICAgICAgc2Nyb2xsU2V0dGluZ3MuZW5kSXRlcmF0aW9ucyA+IDNcbiAgICApe1xuICAgICAgICBzZXRFbGVtZW50U2Nyb2xsKHBhcmVudCwgbG9jYXRpb24ueCwgbG9jYXRpb24ueSk7XG4gICAgICAgIHBhcmVudC5fc2Nyb2xsU2V0dGluZ3MgPSBudWxsO1xuICAgICAgICByZXR1cm4gc2Nyb2xsU2V0dGluZ3MuZW5kKENPTVBMRVRFKTtcbiAgICB9XG5cbiAgICBzY3JvbGxTZXR0aW5ncy5lbmRJdGVyYXRpb25zKys7XG5cbiAgICB2YXIgZWFzZVZhbHVlID0gMSAtIHNjcm9sbFNldHRpbmdzLmVhc2UodGltZVZhbHVlKTtcblxuICAgIHNldEVsZW1lbnRTY3JvbGwocGFyZW50LFxuICAgICAgICBsb2NhdGlvbi54IC0gbG9jYXRpb24uZGlmZmVyZW5jZVggKiBlYXNlVmFsdWUsXG4gICAgICAgIGxvY2F0aW9uLnkgLSBsb2NhdGlvbi5kaWZmZXJlbmNlWSAqIGVhc2VWYWx1ZVxuICAgICk7XG5cbiAgICAvLyBBdCB0aGUgZW5kIG9mIGFuaW1hdGlvbiwgbG9vcCBzeW5jaHJvbm91c2x5XG4gICAgLy8gdG8gdHJ5IGFuZCBoaXQgdGhlIHRhZ2V0IGxvY2F0aW9uLlxuICAgIGlmKHRpbWUgPj0gc2Nyb2xsU2V0dGluZ3MudGltZSl7XG4gICAgICAgIHJldHVybiBhbmltYXRlKHBhcmVudCk7XG4gICAgfVxuXG4gICAgcmFmKGFuaW1hdGUuYmluZChudWxsLCBwYXJlbnQpKTtcbn1cbmZ1bmN0aW9uIHRyYW5zaXRpb25TY3JvbGxUbyh0YXJnZXQsIHBhcmVudCwgc2V0dGluZ3MsIGNhbGxiYWNrKXtcbiAgICB2YXIgaWRsZSA9ICFwYXJlbnQuX3Njcm9sbFNldHRpbmdzLFxuICAgICAgICBsYXN0U2V0dGluZ3MgPSBwYXJlbnQuX3Njcm9sbFNldHRpbmdzLFxuICAgICAgICBub3cgPSBEYXRlLm5vdygpLFxuICAgICAgICBlbmRIYW5kbGVyO1xuXG4gICAgaWYobGFzdFNldHRpbmdzKXtcbiAgICAgICAgbGFzdFNldHRpbmdzLmVuZChDQU5DRUxFRCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5kKGVuZFR5cGUpe1xuICAgICAgICBwYXJlbnQuX3Njcm9sbFNldHRpbmdzID0gbnVsbDtcbiAgICAgICAgaWYocGFyZW50LnBhcmVudEVsZW1lbnQgJiYgcGFyZW50LnBhcmVudEVsZW1lbnQuX3Njcm9sbFNldHRpbmdzKXtcbiAgICAgICAgICAgIHBhcmVudC5wYXJlbnRFbGVtZW50Ll9zY3JvbGxTZXR0aW5ncy5lbmQoZW5kVHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZW5kVHlwZSk7XG4gICAgICAgIHBhcmVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgZW5kSGFuZGxlciwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuICAgICAgICBwYXJlbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2hlZWwnLCBlbmRIYW5kbGVyLCB7IHBhc3NpdmU6IHRydWUgfSk7XG4gICAgfVxuXG4gICAgcGFyZW50Ll9zY3JvbGxTZXR0aW5ncyA9IHtcbiAgICAgICAgc3RhcnRUaW1lOiBsYXN0U2V0dGluZ3MgPyBsYXN0U2V0dGluZ3Muc3RhcnRUaW1lIDogRGF0ZS5ub3coKSxcbiAgICAgICAgZW5kSXRlcmF0aW9uczogMCxcbiAgICAgICAgdGFyZ2V0OiB0YXJnZXQsXG4gICAgICAgIHRpbWU6IHNldHRpbmdzLnRpbWUgKyAobGFzdFNldHRpbmdzID8gbm93IC0gbGFzdFNldHRpbmdzLnN0YXJ0VGltZSA6IDApLFxuICAgICAgICBlYXNlOiBzZXR0aW5ncy5lYXNlLFxuICAgICAgICBhbGlnbjogc2V0dGluZ3MuYWxpZ24sXG4gICAgICAgIGVuZDogZW5kXG4gICAgfTtcblxuICAgIGVuZEhhbmRsZXIgPSBlbmQuYmluZChudWxsLCBDQU5DRUxFRCk7XG4gICAgcGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBlbmRIYW5kbGVyLCB7IHBhc3NpdmU6IHRydWUgfSk7XG4gICAgcGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgZW5kSGFuZGxlciwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuXG4gICAgaWYoaWRsZSl7XG4gICAgICAgIGFuaW1hdGUocGFyZW50KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRJc1Njcm9sbGFibGUoZWxlbWVudCl7XG4gICAgcmV0dXJuIChcbiAgICAgICAgJ3BhZ2VYT2Zmc2V0JyBpbiBlbGVtZW50IHx8XG4gICAgICAgIChcbiAgICAgICAgICAgIGVsZW1lbnQuc2Nyb2xsSGVpZ2h0ICE9PSBlbGVtZW50LmNsaWVudEhlaWdodCB8fFxuICAgICAgICAgICAgZWxlbWVudC5zY3JvbGxXaWR0aCAhPT0gZWxlbWVudC5jbGllbnRXaWR0aFxuICAgICAgICApICYmXG4gICAgICAgIGdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkub3ZlcmZsb3cgIT09ICdoaWRkZW4nXG4gICAgKTtcbn1cblxuZnVuY3Rpb24gZGVmYXVsdFZhbGlkVGFyZ2V0KCl7XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0LCBzZXR0aW5ncywgY2FsbGJhY2spe1xuICAgIGlmKCF0YXJnZXQpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIHNldHRpbmdzID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgY2FsbGJhY2sgPSBzZXR0aW5ncztcbiAgICAgICAgc2V0dGluZ3MgPSBudWxsO1xuICAgIH1cblxuICAgIGlmKCFzZXR0aW5ncyl7XG4gICAgICAgIHNldHRpbmdzID0ge307XG4gICAgfVxuXG4gICAgc2V0dGluZ3MudGltZSA9IGlzTmFOKHNldHRpbmdzLnRpbWUpID8gMTAwMCA6IHNldHRpbmdzLnRpbWU7XG4gICAgc2V0dGluZ3MuZWFzZSA9IHNldHRpbmdzLmVhc2UgfHwgZnVuY3Rpb24odil7cmV0dXJuIDEgLSBNYXRoLnBvdygxIC0gdiwgdiAvIDIpO307XG5cbiAgICB2YXIgcGFyZW50ID0gdGFyZ2V0LnBhcmVudEVsZW1lbnQsXG4gICAgICAgIHBhcmVudHMgPSAwO1xuXG4gICAgZnVuY3Rpb24gZG9uZShlbmRUeXBlKXtcbiAgICAgICAgcGFyZW50cy0tO1xuICAgICAgICBpZighcGFyZW50cyl7XG4gICAgICAgICAgICBjYWxsYmFjayAmJiBjYWxsYmFjayhlbmRUeXBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciB2YWxpZFRhcmdldCA9IHNldHRpbmdzLnZhbGlkVGFyZ2V0IHx8IGRlZmF1bHRWYWxpZFRhcmdldDtcbiAgICB2YXIgaXNTY3JvbGxhYmxlID0gc2V0dGluZ3MuaXNTY3JvbGxhYmxlO1xuXG4gICAgd2hpbGUocGFyZW50KXtcbiAgICAgICAgaWYodmFsaWRUYXJnZXQocGFyZW50LCBwYXJlbnRzKSAmJiAoaXNTY3JvbGxhYmxlID8gaXNTY3JvbGxhYmxlKHBhcmVudCwgZGVmYXVsdElzU2Nyb2xsYWJsZSkgOiBkZWZhdWx0SXNTY3JvbGxhYmxlKHBhcmVudCkpKXtcbiAgICAgICAgICAgIHBhcmVudHMrKztcbiAgICAgICAgICAgIHRyYW5zaXRpb25TY3JvbGxUbyh0YXJnZXQsIHBhcmVudCwgc2V0dGluZ3MsIGRvbmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudEVsZW1lbnQ7XG5cbiAgICAgICAgaWYoIXBhcmVudCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihwYXJlbnQudGFnTmFtZSA9PT0gJ0JPRFknKXtcbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5vd25lckRvY3VtZW50O1xuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50LmRlZmF1bHRWaWV3IHx8IHBhcmVudC5vd25lcldpbmRvdztcbiAgICAgICAgfVxuICAgIH1cbn07XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxubW9kdWxlLmV4cG9ydHMgPSBTdHJlYW07XG5cbnZhciBFRSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG5cbmluaGVyaXRzKFN0cmVhbSwgRUUpO1xuU3RyZWFtLlJlYWRhYmxlID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzJyk7XG5TdHJlYW0uV3JpdGFibGUgPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vd3JpdGFibGUuanMnKTtcblN0cmVhbS5EdXBsZXggPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vZHVwbGV4LmpzJyk7XG5TdHJlYW0uVHJhbnNmb3JtID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3RyYW5zZm9ybS5qcycpO1xuU3RyZWFtLlBhc3NUaHJvdWdoID0gcmVxdWlyZSgncmVhZGFibGUtc3RyZWFtL3Bhc3N0aHJvdWdoLmpzJyk7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuNC54XG5TdHJlYW0uU3RyZWFtID0gU3RyZWFtO1xuXG5cblxuLy8gb2xkLXN0eWxlIHN0cmVhbXMuICBOb3RlIHRoYXQgdGhlIHBpcGUgbWV0aG9kICh0aGUgb25seSByZWxldmFudFxuLy8gcGFydCBvZiB0aGlzIGNsYXNzKSBpcyBvdmVycmlkZGVuIGluIHRoZSBSZWFkYWJsZSBjbGFzcy5cblxuZnVuY3Rpb24gU3RyZWFtKCkge1xuICBFRS5jYWxsKHRoaXMpO1xufVxuXG5TdHJlYW0ucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbihkZXN0LCBvcHRpb25zKSB7XG4gIHZhciBzb3VyY2UgPSB0aGlzO1xuXG4gIGZ1bmN0aW9uIG9uZGF0YShjaHVuaykge1xuICAgIGlmIChkZXN0LndyaXRhYmxlKSB7XG4gICAgICBpZiAoZmFsc2UgPT09IGRlc3Qud3JpdGUoY2h1bmspICYmIHNvdXJjZS5wYXVzZSkge1xuICAgICAgICBzb3VyY2UucGF1c2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzb3VyY2Uub24oJ2RhdGEnLCBvbmRhdGEpO1xuXG4gIGZ1bmN0aW9uIG9uZHJhaW4oKSB7XG4gICAgaWYgKHNvdXJjZS5yZWFkYWJsZSAmJiBzb3VyY2UucmVzdW1lKSB7XG4gICAgICBzb3VyY2UucmVzdW1lKCk7XG4gICAgfVxuICB9XG5cbiAgZGVzdC5vbignZHJhaW4nLCBvbmRyYWluKTtcblxuICAvLyBJZiB0aGUgJ2VuZCcgb3B0aW9uIGlzIG5vdCBzdXBwbGllZCwgZGVzdC5lbmQoKSB3aWxsIGJlIGNhbGxlZCB3aGVuXG4gIC8vIHNvdXJjZSBnZXRzIHRoZSAnZW5kJyBvciAnY2xvc2UnIGV2ZW50cy4gIE9ubHkgZGVzdC5lbmQoKSBvbmNlLlxuICBpZiAoIWRlc3QuX2lzU3RkaW8gJiYgKCFvcHRpb25zIHx8IG9wdGlvbnMuZW5kICE9PSBmYWxzZSkpIHtcbiAgICBzb3VyY2Uub24oJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2Uub24oJ2Nsb3NlJywgb25jbG9zZSk7XG4gIH1cblxuICB2YXIgZGlkT25FbmQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgaWYgKGRpZE9uRW5kKSByZXR1cm47XG4gICAgZGlkT25FbmQgPSB0cnVlO1xuXG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG5cbiAgZnVuY3Rpb24gb25jbG9zZSgpIHtcbiAgICBpZiAoZGlkT25FbmQpIHJldHVybjtcbiAgICBkaWRPbkVuZCA9IHRydWU7XG5cbiAgICBpZiAodHlwZW9mIGRlc3QuZGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykgZGVzdC5kZXN0cm95KCk7XG4gIH1cblxuICAvLyBkb24ndCBsZWF2ZSBkYW5nbGluZyBwaXBlcyB3aGVuIHRoZXJlIGFyZSBlcnJvcnMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBjbGVhbnVwKCk7XG4gICAgaWYgKEVFLmxpc3RlbmVyQ291bnQodGhpcywgJ2Vycm9yJykgPT09IDApIHtcbiAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgc3RyZWFtIGVycm9yIGluIHBpcGUuXG4gICAgfVxuICB9XG5cbiAgc291cmNlLm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuICBkZXN0Lm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuXG4gIC8vIHJlbW92ZSBhbGwgdGhlIGV2ZW50IGxpc3RlbmVycyB0aGF0IHdlcmUgYWRkZWQuXG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdkYXRhJywgb25kYXRhKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIG9uY2xvc2UpO1xuXG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGNsZWFudXApO1xuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBjbGVhbnVwKTtcblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgY2xlYW51cCk7XG4gIH1cblxuICBzb3VyY2Uub24oJ2VuZCcsIGNsZWFudXApO1xuICBzb3VyY2Uub24oJ2Nsb3NlJywgY2xlYW51cCk7XG5cbiAgZGVzdC5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0LmVtaXQoJ3BpcGUnLCBzb3VyY2UpO1xuXG4gIC8vIEFsbG93IGZvciB1bml4LWxpa2UgdXNhZ2U6IEEucGlwZShCKS5waXBlKEMpXG4gIHJldHVybiBkZXN0O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJpbmQgPSByZXF1aXJlKCdmdW5jdGlvbi1iaW5kJyk7XG52YXIgRVMgPSByZXF1aXJlKCdlcy1hYnN0cmFjdC9lczUnKTtcbnZhciByZXBsYWNlID0gYmluZC5jYWxsKEZ1bmN0aW9uLmNhbGwsIFN0cmluZy5wcm90b3R5cGUucmVwbGFjZSk7XG5cbnZhciBsZWZ0V2hpdGVzcGFjZSA9IC9eW1xceDA5XFx4MEFcXHgwQlxceDBDXFx4MERcXHgyMFxceEEwXFx1MTY4MFxcdTE4MEVcXHUyMDAwXFx1MjAwMVxcdTIwMDJcXHUyMDAzXFx1MjAwNFxcdTIwMDVcXHUyMDA2XFx1MjAwN1xcdTIwMDhcXHUyMDA5XFx1MjAwQVxcdTIwMkZcXHUyMDVGXFx1MzAwMFxcdTIwMjhcXHUyMDI5XFx1RkVGRl0rLztcbnZhciByaWdodFdoaXRlc3BhY2UgPSAvW1xceDA5XFx4MEFcXHgwQlxceDBDXFx4MERcXHgyMFxceEEwXFx1MTY4MFxcdTE4MEVcXHUyMDAwXFx1MjAwMVxcdTIwMDJcXHUyMDAzXFx1MjAwNFxcdTIwMDVcXHUyMDA2XFx1MjAwN1xcdTIwMDhcXHUyMDA5XFx1MjAwQVxcdTIwMkZcXHUyMDVGXFx1MzAwMFxcdTIwMjhcXHUyMDI5XFx1RkVGRl0rJC87XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gdHJpbSgpIHtcblx0dmFyIFMgPSBFUy5Ub1N0cmluZyhFUy5DaGVja09iamVjdENvZXJjaWJsZSh0aGlzKSk7XG5cdHJldHVybiByZXBsYWNlKHJlcGxhY2UoUywgbGVmdFdoaXRlc3BhY2UsICcnKSwgcmlnaHRXaGl0ZXNwYWNlLCAnJyk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYmluZCA9IHJlcXVpcmUoJ2Z1bmN0aW9uLWJpbmQnKTtcbnZhciBkZWZpbmUgPSByZXF1aXJlKCdkZWZpbmUtcHJvcGVydGllcycpO1xuXG52YXIgaW1wbGVtZW50YXRpb24gPSByZXF1aXJlKCcuL2ltcGxlbWVudGF0aW9uJyk7XG52YXIgZ2V0UG9seWZpbGwgPSByZXF1aXJlKCcuL3BvbHlmaWxsJyk7XG52YXIgc2hpbSA9IHJlcXVpcmUoJy4vc2hpbScpO1xuXG52YXIgYm91bmRUcmltID0gYmluZC5jYWxsKEZ1bmN0aW9uLmNhbGwsIGdldFBvbHlmaWxsKCkpO1xuXG5kZWZpbmUoYm91bmRUcmltLCB7XG5cdGdldFBvbHlmaWxsOiBnZXRQb2x5ZmlsbCxcblx0aW1wbGVtZW50YXRpb246IGltcGxlbWVudGF0aW9uLFxuXHRzaGltOiBzaGltXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBib3VuZFRyaW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpbXBsZW1lbnRhdGlvbiA9IHJlcXVpcmUoJy4vaW1wbGVtZW50YXRpb24nKTtcblxudmFyIHplcm9XaWR0aFNwYWNlID0gJ1xcdTIwMGInO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGdldFBvbHlmaWxsKCkge1xuXHRpZiAoU3RyaW5nLnByb3RvdHlwZS50cmltICYmIHplcm9XaWR0aFNwYWNlLnRyaW0oKSA9PT0gemVyb1dpZHRoU3BhY2UpIHtcblx0XHRyZXR1cm4gU3RyaW5nLnByb3RvdHlwZS50cmltO1xuXHR9XG5cdHJldHVybiBpbXBsZW1lbnRhdGlvbjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkZWZpbmUgPSByZXF1aXJlKCdkZWZpbmUtcHJvcGVydGllcycpO1xudmFyIGdldFBvbHlmaWxsID0gcmVxdWlyZSgnLi9wb2x5ZmlsbCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNoaW1TdHJpbmdUcmltKCkge1xuXHR2YXIgcG9seWZpbGwgPSBnZXRQb2x5ZmlsbCgpO1xuXHRkZWZpbmUoU3RyaW5nLnByb3RvdHlwZSwgeyB0cmltOiBwb2x5ZmlsbCB9LCB7IHRyaW06IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFN0cmluZy5wcm90b3R5cGUudHJpbSAhPT0gcG9seWZpbGw7IH0gfSk7XG5cdHJldHVybiBwb2x5ZmlsbDtcbn07XG4iLCJ2YXIgZGVmaW5lZCA9IHJlcXVpcmUoJ2RlZmluZWQnKTtcbnZhciBjcmVhdGVEZWZhdWx0U3RyZWFtID0gcmVxdWlyZSgnLi9saWIvZGVmYXVsdF9zdHJlYW0nKTtcbnZhciBUZXN0ID0gcmVxdWlyZSgnLi9saWIvdGVzdCcpO1xudmFyIGNyZWF0ZVJlc3VsdCA9IHJlcXVpcmUoJy4vbGliL3Jlc3VsdHMnKTtcbnZhciB0aHJvdWdoID0gcmVxdWlyZSgndGhyb3VnaCcpO1xuXG52YXIgY2FuRW1pdEV4aXQgPSB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvY2Vzc1xuICAgICYmIHR5cGVvZiBwcm9jZXNzLm9uID09PSAnZnVuY3Rpb24nICYmIHByb2Nlc3MuYnJvd3NlciAhPT0gdHJ1ZVxuO1xudmFyIGNhbkV4aXQgPSB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvY2Vzc1xuICAgICYmIHR5cGVvZiBwcm9jZXNzLmV4aXQgPT09ICdmdW5jdGlvbidcbjtcblxudmFyIG5leHRUaWNrID0gdHlwZW9mIHNldEltbWVkaWF0ZSAhPT0gJ3VuZGVmaW5lZCdcbiAgICA/IHNldEltbWVkaWF0ZVxuICAgIDogcHJvY2Vzcy5uZXh0VGlja1xuO1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBoYXJuZXNzO1xuICAgIHZhciBsYXp5TG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGdldEhhcm5lc3MoKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICBsYXp5TG9hZC5vbmx5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZ2V0SGFybmVzcygpLm9ubHkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgbGF6eUxvYWQuY3JlYXRlU3RyZWFtID0gZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgaWYgKCFvcHRzKSBvcHRzID0ge307XG4gICAgICAgIGlmICghaGFybmVzcykge1xuICAgICAgICAgICAgdmFyIG91dHB1dCA9IHRocm91Z2goKTtcbiAgICAgICAgICAgIGdldEhhcm5lc3MoeyBzdHJlYW06IG91dHB1dCwgb2JqZWN0TW9kZTogb3B0cy5vYmplY3RNb2RlIH0pO1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFybmVzcy5jcmVhdGVTdHJlYW0ob3B0cyk7XG4gICAgfTtcblxuICAgIGxhenlMb2FkLm9uRmluaXNoID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZ2V0SGFybmVzcygpLm9uRmluaXNoLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIGxhenlMb2FkLm9uRmFpbHVyZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGdldEhhcm5lc3MoKS5vbkZhaWx1cmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgbGF6eUxvYWQuZ2V0SGFybmVzcyA9IGdldEhhcm5lc3NcblxuICAgIHJldHVybiBsYXp5TG9hZFxuXG4gICAgZnVuY3Rpb24gZ2V0SGFybmVzcyhvcHRzKSB7XG4gICAgICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAgICAgICBvcHRzLmF1dG9jbG9zZSA9ICFjYW5FbWl0RXhpdDtcbiAgICAgICAgaWYgKCFoYXJuZXNzKSBoYXJuZXNzID0gY3JlYXRlRXhpdEhhcm5lc3Mob3B0cyk7XG4gICAgICAgIHJldHVybiBoYXJuZXNzO1xuICAgIH1cbn0pKCk7XG5cbmZ1bmN0aW9uIGNyZWF0ZUV4aXRIYXJuZXNzKGNvbmYpIHtcbiAgICBpZiAoIWNvbmYpIGNvbmYgPSB7fTtcbiAgICB2YXIgaGFybmVzcyA9IGNyZWF0ZUhhcm5lc3Moe1xuICAgICAgICBhdXRvY2xvc2U6IGRlZmluZWQoY29uZi5hdXRvY2xvc2UsIGZhbHNlKVxuICAgIH0pO1xuXG4gICAgdmFyIHN0cmVhbSA9IGhhcm5lc3MuY3JlYXRlU3RyZWFtKHsgb2JqZWN0TW9kZTogY29uZi5vYmplY3RNb2RlIH0pO1xuICAgIHZhciBlcyA9IHN0cmVhbS5waXBlKGNvbmYuc3RyZWFtIHx8IGNyZWF0ZURlZmF1bHRTdHJlYW0oKSk7XG4gICAgaWYgKGNhbkVtaXRFeGl0KSB7XG4gICAgICAgIGVzLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlcnIpIHsgaGFybmVzcy5fZXhpdENvZGUgPSAxIH0pO1xuICAgIH1cblxuICAgIHZhciBlbmRlZCA9IGZhbHNlO1xuICAgIHN0cmVhbS5vbignZW5kJywgZnVuY3Rpb24gKCkgeyBlbmRlZCA9IHRydWUgfSk7XG5cbiAgICBpZiAoY29uZi5leGl0ID09PSBmYWxzZSkgcmV0dXJuIGhhcm5lc3M7XG4gICAgaWYgKCFjYW5FbWl0RXhpdCB8fCAhY2FuRXhpdCkgcmV0dXJuIGhhcm5lc3M7XG5cbiAgICB2YXIgaW5FcnJvclN0YXRlID0gZmFsc2U7XG5cbiAgICBwcm9jZXNzLm9uKCdleGl0JywgZnVuY3Rpb24gKGNvZGUpIHtcbiAgICAgICAgLy8gbGV0IHRoZSBwcm9jZXNzIGV4aXQgY2xlYW5seS5cbiAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlbmRlZCkge1xuICAgICAgICAgICAgdmFyIG9ubHkgPSBoYXJuZXNzLl9yZXN1bHRzLl9vbmx5O1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBoYXJuZXNzLl90ZXN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciB0ID0gaGFybmVzcy5fdGVzdHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKG9ubHkgJiYgdCAhPT0gb25seSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgdC5fZXhpdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGhhcm5lc3MuY2xvc2UoKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KGNvZGUgfHwgaGFybmVzcy5fZXhpdENvZGUpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGhhcm5lc3M7XG59XG5cbmV4cG9ydHMuY3JlYXRlSGFybmVzcyA9IGNyZWF0ZUhhcm5lc3M7XG5leHBvcnRzLlRlc3QgPSBUZXN0O1xuZXhwb3J0cy50ZXN0ID0gZXhwb3J0czsgLy8gdGFwIGNvbXBhdFxuZXhwb3J0cy50ZXN0LnNraXAgPSBUZXN0LnNraXA7XG5cbnZhciBleGl0SW50ZXJ2YWw7XG5cbmZ1bmN0aW9uIGNyZWF0ZUhhcm5lc3MoY29uZl8pIHtcbiAgICBpZiAoIWNvbmZfKSBjb25mXyA9IHt9O1xuICAgIHZhciByZXN1bHRzID0gY3JlYXRlUmVzdWx0KCk7XG4gICAgaWYgKGNvbmZfLmF1dG9jbG9zZSAhPT0gZmFsc2UpIHtcbiAgICAgICAgcmVzdWx0cy5vbmNlKCdkb25lJywgZnVuY3Rpb24gKCkgeyByZXN1bHRzLmNsb3NlKCkgfSk7XG4gICAgfVxuXG4gICAgdmFyIHRlc3QgPSBmdW5jdGlvbiAobmFtZSwgY29uZiwgY2IpIHtcbiAgICAgICAgdmFyIHQgPSBuZXcgVGVzdChuYW1lLCBjb25mLCBjYik7XG4gICAgICAgIHRlc3QuX3Rlc3RzLnB1c2godCk7XG5cbiAgICAgICAgKGZ1bmN0aW9uIGluc3BlY3RDb2RlKHN0KSB7XG4gICAgICAgICAgICBzdC5vbigndGVzdCcsIGZ1bmN0aW9uIHN1YihzdF8pIHtcbiAgICAgICAgICAgICAgICBpbnNwZWN0Q29kZShzdF8pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzdC5vbigncmVzdWx0JywgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXIub2sgJiYgdHlwZW9mIHIgIT09ICdzdHJpbmcnKSB0ZXN0Ll9leGl0Q29kZSA9IDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KSh0KTtcblxuICAgICAgICByZXN1bHRzLnB1c2godCk7XG4gICAgICAgIHJldHVybiB0O1xuICAgIH07XG4gICAgdGVzdC5fcmVzdWx0cyA9IHJlc3VsdHM7XG5cbiAgICB0ZXN0Ll90ZXN0cyA9IFtdO1xuXG4gICAgdGVzdC5jcmVhdGVTdHJlYW0gPSBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICByZXR1cm4gcmVzdWx0cy5jcmVhdGVTdHJlYW0ob3B0cyk7XG4gICAgfTtcblxuICAgIHRlc3Qub25GaW5pc2ggPSBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgcmVzdWx0cy5vbignZG9uZScsIGNiKTtcbiAgICB9O1xuXG4gICAgdGVzdC5vbkZhaWx1cmUgPSBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgcmVzdWx0cy5vbignZmFpbCcsIGNiKTtcbiAgICB9O1xuXG4gICAgdmFyIG9ubHkgPSBmYWxzZTtcbiAgICB0ZXN0Lm9ubHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChvbmx5KSB0aHJvdyBuZXcgRXJyb3IoJ3RoZXJlIGNhbiBvbmx5IGJlIG9uZSBvbmx5IHRlc3QnKTtcbiAgICAgICAgb25seSA9IHRydWU7XG4gICAgICAgIHZhciB0ID0gdGVzdC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICByZXN1bHRzLm9ubHkodCk7XG4gICAgICAgIHJldHVybiB0O1xuICAgIH07XG4gICAgdGVzdC5fZXhpdENvZGUgPSAwO1xuXG4gICAgdGVzdC5jbG9zZSA9IGZ1bmN0aW9uICgpIHsgcmVzdWx0cy5jbG9zZSgpIH07XG5cbiAgICByZXR1cm4gdGVzdDtcbn1cbiIsInZhciB0aHJvdWdoID0gcmVxdWlyZSgndGhyb3VnaCcpO1xudmFyIGZzID0gcmVxdWlyZSgnZnMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGxpbmUgPSAnJztcbiAgICB2YXIgc3RyZWFtID0gdGhyb3VnaCh3cml0ZSwgZmx1c2gpO1xuICAgIHJldHVybiBzdHJlYW07XG5cbiAgICBmdW5jdGlvbiB3cml0ZShidWYpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWYubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjID0gdHlwZW9mIGJ1ZiA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgICAgICA/IGJ1Zi5jaGFyQXQoaSlcbiAgICAgICAgICAgICAgICA6IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgICAgICAgO1xuICAgICAgICAgICAgaWYgKGMgPT09ICdcXG4nKSBmbHVzaCgpO1xuICAgICAgICAgICAgZWxzZSBsaW5lICs9IGM7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmbHVzaCgpIHtcbiAgICAgICAgaWYgKGZzLndyaXRlU3luYyAmJiAvXndpbi8udGVzdChwcm9jZXNzLnBsYXRmb3JtKSkge1xuICAgICAgICAgICAgdHJ5IHsgZnMud3JpdGVTeW5jKDEsIGxpbmUgKyAnXFxuJyk7IH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7IGNvbnNvbGUubG9nKGxpbmUpIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpIH1cbiAgICAgICAgfVxuICAgICAgICBsaW5lID0gJyc7XG4gICAgfVxufTtcbiIsInZhciBkZWZpbmVkID0gcmVxdWlyZSgnZGVmaW5lZCcpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG52YXIgdGhyb3VnaCA9IHJlcXVpcmUoJ3Rocm91Z2gnKTtcbnZhciByZXN1bWVyID0gcmVxdWlyZSgncmVzdW1lcicpO1xudmFyIGluc3BlY3QgPSByZXF1aXJlKCdvYmplY3QtaW5zcGVjdCcpO1xudmFyIGJpbmQgPSByZXF1aXJlKCdmdW5jdGlvbi1iaW5kJyk7XG52YXIgaGFzID0gcmVxdWlyZSgnaGFzJyk7XG52YXIgcmVnZXhwVGVzdCA9IGJpbmQuY2FsbChGdW5jdGlvbi5jYWxsLCBSZWdFeHAucHJvdG90eXBlLnRlc3QpO1xudmFyIHlhbWxJbmRpY2F0b3JzID0gL1xcOnxcXC18XFw/LztcbnZhciBuZXh0VGljayA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnXG4gICAgPyBzZXRJbW1lZGlhdGVcbiAgICA6IHByb2Nlc3MubmV4dFRpY2tcbjtcblxubW9kdWxlLmV4cG9ydHMgPSBSZXN1bHRzO1xuaW5oZXJpdHMoUmVzdWx0cywgRXZlbnRFbWl0dGVyKTtcblxuZnVuY3Rpb24gUmVzdWx0cygpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUmVzdWx0cykpIHJldHVybiBuZXcgUmVzdWx0cztcbiAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB0aGlzLmZhaWwgPSAwO1xuICAgIHRoaXMucGFzcyA9IDA7XG4gICAgdGhpcy50b2RvID0gMDtcbiAgICB0aGlzLl9zdHJlYW0gPSB0aHJvdWdoKCk7XG4gICAgdGhpcy50ZXN0cyA9IFtdO1xuICAgIHRoaXMuX29ubHkgPSBudWxsO1xuICAgIHRoaXMuX2lzUnVubmluZyA9IGZhbHNlO1xufVxuXG5SZXN1bHRzLnByb3RvdHlwZS5jcmVhdGVTdHJlYW0gPSBmdW5jdGlvbiAob3B0cykge1xuICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb3V0cHV0LCB0ZXN0SWQgPSAwO1xuICAgIGlmIChvcHRzLm9iamVjdE1vZGUpIHtcbiAgICAgICAgb3V0cHV0ID0gdGhyb3VnaCgpO1xuICAgICAgICBzZWxmLm9uKCdfcHVzaCcsIGZ1bmN0aW9uIG9udGVzdCh0LCBleHRyYSkge1xuICAgICAgICAgICAgaWYgKCFleHRyYSkgZXh0cmEgPSB7fTtcbiAgICAgICAgICAgIHZhciBpZCA9IHRlc3RJZCsrO1xuICAgICAgICAgICAgdC5vbmNlKCdwcmVydW4nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJvdyA9IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Rlc3QnLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiB0Lm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGlkOiBpZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGhhcyhleHRyYSwgJ3BhcmVudCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJvdy5wYXJlbnQgPSBleHRyYS5wYXJlbnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG91dHB1dC5xdWV1ZShyb3cpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0Lm9uKCd0ZXN0JywgZnVuY3Rpb24gKHN0KSB7XG4gICAgICAgICAgICAgICAgb250ZXN0KHN0LCB7IHBhcmVudDogaWQgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHQub24oJ3Jlc3VsdCcsIGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgICAgICAgICByZXMudGVzdCA9IGlkO1xuICAgICAgICAgICAgICAgIHJlcy50eXBlID0gJ2Fzc2VydCc7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnF1ZXVlKHJlcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHQub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQucXVldWUoeyB0eXBlOiAnZW5kJywgdGVzdDogaWQgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGYub24oJ2RvbmUnLCBmdW5jdGlvbiAoKSB7IG91dHB1dC5xdWV1ZShudWxsKSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQgPSByZXN1bWVyKCk7XG4gICAgICAgIG91dHB1dC5xdWV1ZSgnVEFQIHZlcnNpb24gMTNcXG4nKTtcbiAgICAgICAgc2VsZi5fc3RyZWFtLnBpcGUob3V0cHV0KTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX2lzUnVubmluZykge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSB0cnVlO1xuICAgICAgICBuZXh0VGljayhmdW5jdGlvbiBuZXh0KCkge1xuICAgICAgICAgICAgdmFyIHQ7XG4gICAgICAgICAgICB3aGlsZSAodCA9IGdldE5leHRUZXN0KHNlbGYpKSB7XG4gICAgICAgICAgICAgICAgdC5ydW4oKTtcbiAgICAgICAgICAgICAgICBpZiAoIXQuZW5kZWQpIHJldHVybiB0Lm9uY2UoJ2VuZCcsIGZ1bmN0aW9uICgpIHsgbmV4dFRpY2sobmV4dCk7IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VsZi5lbWl0KCdkb25lJyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBvdXRwdXQ7XG59O1xuXG5SZXN1bHRzLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKHQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi50ZXN0cy5wdXNoKHQpO1xuICAgIHNlbGYuX3dhdGNoKHQpO1xuICAgIHNlbGYuZW1pdCgnX3B1c2gnLCB0KTtcbn07XG5cblJlc3VsdHMucHJvdG90eXBlLm9ubHkgPSBmdW5jdGlvbiAodCkge1xuICAgIHRoaXMuX29ubHkgPSB0O1xufTtcblxuUmVzdWx0cy5wcm90b3R5cGUuX3dhdGNoID0gZnVuY3Rpb24gKHQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHdyaXRlID0gZnVuY3Rpb24gKHMpIHsgc2VsZi5fc3RyZWFtLnF1ZXVlKHMpIH07XG4gICAgdC5vbmNlKCdwcmVydW4nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHdyaXRlKCcjICcgKyB0Lm5hbWUgKyAnXFxuJyk7XG4gICAgfSk7XG5cbiAgICB0Lm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgcmVzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgd3JpdGUoJyMgJyArIHJlcyArICdcXG4nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB3cml0ZShlbmNvZGVSZXN1bHQocmVzLCBzZWxmLmNvdW50ICsgMSkpO1xuICAgICAgICBzZWxmLmNvdW50ICsrO1xuXG4gICAgICAgIGlmIChyZXMub2sgfHwgcmVzLnRvZG8pIHNlbGYucGFzcyArK1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuZmFpbCArKztcbiAgICAgICAgICAgIHNlbGYuZW1pdCgnZmFpbCcpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB0Lm9uKCd0ZXN0JywgZnVuY3Rpb24gKHN0KSB7IHNlbGYuX3dhdGNoKHN0KSB9KTtcbn07XG5cblJlc3VsdHMucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5jbG9zZWQpIHNlbGYuX3N0cmVhbS5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignQUxSRUFEWSBDTE9TRUQnKSk7XG4gICAgc2VsZi5jbG9zZWQgPSB0cnVlO1xuICAgIHZhciB3cml0ZSA9IGZ1bmN0aW9uIChzKSB7IHNlbGYuX3N0cmVhbS5xdWV1ZShzKSB9O1xuXG4gICAgd3JpdGUoJ1xcbjEuLicgKyBzZWxmLmNvdW50ICsgJ1xcbicpO1xuICAgIHdyaXRlKCcjIHRlc3RzICcgKyBzZWxmLmNvdW50ICsgJ1xcbicpO1xuICAgIHdyaXRlKCcjIHBhc3MgICcgKyAoc2VsZi5wYXNzICsgc2VsZi50b2RvKSArICdcXG4nKTtcbiAgICBpZiAoc2VsZi50b2RvKSB3cml0ZSgnIyB0b2RvICAnICsgc2VsZi50b2RvICsgJ1xcbicpO1xuICAgIGlmIChzZWxmLmZhaWwpIHdyaXRlKCcjIGZhaWwgICcgKyBzZWxmLmZhaWwgKyAnXFxuJyk7XG4gICAgZWxzZSB3cml0ZSgnXFxuIyBva1xcbicpO1xuXG4gICAgc2VsZi5fc3RyZWFtLnF1ZXVlKG51bGwpO1xufTtcblxuZnVuY3Rpb24gZW5jb2RlUmVzdWx0KHJlcywgY291bnQpIHtcbiAgICB2YXIgb3V0cHV0ID0gJyc7XG4gICAgb3V0cHV0ICs9IChyZXMub2sgPyAnb2sgJyA6ICdub3Qgb2sgJykgKyBjb3VudDtcbiAgICBvdXRwdXQgKz0gcmVzLm5hbWUgPyAnICcgKyByZXMubmFtZS50b1N0cmluZygpLnJlcGxhY2UoL1xccysvZywgJyAnKSA6ICcnO1xuXG4gICAgaWYgKHJlcy5za2lwKSBvdXRwdXQgKz0gJyAjIFNLSVAnO1xuICAgIGVsc2UgaWYgKHJlcy50b2RvKSBvdXRwdXQgKz0gJyAjIFRPRE8nO1xuXG4gICAgb3V0cHV0ICs9ICdcXG4nO1xuICAgIGlmIChyZXMub2spIHJldHVybiBvdXRwdXQ7XG5cbiAgICB2YXIgb3V0ZXIgPSAnICAnO1xuICAgIHZhciBpbm5lciA9IG91dGVyICsgJyAgJztcbiAgICBvdXRwdXQgKz0gb3V0ZXIgKyAnLS0tXFxuJztcbiAgICBvdXRwdXQgKz0gaW5uZXIgKyAnb3BlcmF0b3I6ICcgKyByZXMub3BlcmF0b3IgKyAnXFxuJztcblxuICAgIGlmIChoYXMocmVzLCAnZXhwZWN0ZWQnKSB8fCBoYXMocmVzLCAnYWN0dWFsJykpIHtcbiAgICAgICAgdmFyIGV4ID0gaW5zcGVjdChyZXMuZXhwZWN0ZWQsIHtkZXB0aDogcmVzLm9iamVjdFByaW50RGVwdGh9KTtcbiAgICAgICAgdmFyIGFjID0gaW5zcGVjdChyZXMuYWN0dWFsLCB7ZGVwdGg6IHJlcy5vYmplY3RQcmludERlcHRofSk7XG5cbiAgICAgICAgaWYgKE1hdGgubWF4KGV4Lmxlbmd0aCwgYWMubGVuZ3RoKSA+IDY1IHx8IGludmFsaWRZYW1sKGV4KSB8fCBpbnZhbGlkWWFtbChhYykpIHtcbiAgICAgICAgICAgIG91dHB1dCArPSBpbm5lciArICdleHBlY3RlZDogfC1cXG4nICsgaW5uZXIgKyAnICAnICsgZXggKyAnXFxuJztcbiAgICAgICAgICAgIG91dHB1dCArPSBpbm5lciArICdhY3R1YWw6IHwtXFxuJyArIGlubmVyICsgJyAgJyArIGFjICsgJ1xcbic7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvdXRwdXQgKz0gaW5uZXIgKyAnZXhwZWN0ZWQ6ICcgKyBleCArICdcXG4nO1xuICAgICAgICAgICAgb3V0cHV0ICs9IGlubmVyICsgJ2FjdHVhbDogICAnICsgYWMgKyAnXFxuJztcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAocmVzLmF0KSB7XG4gICAgICAgIG91dHB1dCArPSBpbm5lciArICdhdDogJyArIHJlcy5hdCArICdcXG4nO1xuICAgIH1cblxuICAgIHZhciBhY3R1YWxTdGFjayA9IHJlcy5hY3R1YWwgJiYgKHR5cGVvZiByZXMuYWN0dWFsID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgcmVzLmFjdHVhbCA9PT0gJ2Z1bmN0aW9uJykgPyByZXMuYWN0dWFsLnN0YWNrIDogdW5kZWZpbmVkO1xuICAgIHZhciBlcnJvclN0YWNrID0gcmVzLmVycm9yICYmIHJlcy5lcnJvci5zdGFjaztcbiAgICB2YXIgc3RhY2sgPSBkZWZpbmVkKGFjdHVhbFN0YWNrLCBlcnJvclN0YWNrKTtcbiAgICBpZiAoc3RhY2spIHtcbiAgICAgICAgdmFyIGxpbmVzID0gU3RyaW5nKHN0YWNrKS5zcGxpdCgnXFxuJyk7XG4gICAgICAgIG91dHB1dCArPSBpbm5lciArICdzdGFjazogfC1cXG4nO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBvdXRwdXQgKz0gaW5uZXIgKyAnICAnICsgbGluZXNbaV0gKyAnXFxuJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG91dHB1dCArPSBvdXRlciArICcuLi5cXG4nO1xuICAgIHJldHVybiBvdXRwdXQ7XG59XG5cbmZ1bmN0aW9uIGdldE5leHRUZXN0KHJlc3VsdHMpIHtcbiAgICBpZiAoIXJlc3VsdHMuX29ubHkpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHMudGVzdHMuc2hpZnQoKTtcbiAgICB9XG5cbiAgICBkbyB7XG4gICAgICAgIHZhciB0ID0gcmVzdWx0cy50ZXN0cy5zaGlmdCgpO1xuICAgICAgICBpZiAoIXQpIGNvbnRpbnVlO1xuICAgICAgICBpZiAocmVzdWx0cy5fb25seSA9PT0gdCkge1xuICAgICAgICAgICAgcmV0dXJuIHQ7XG4gICAgICAgIH1cbiAgICB9IHdoaWxlIChyZXN1bHRzLnRlc3RzLmxlbmd0aCAhPT0gMClcbn1cblxuZnVuY3Rpb24gaW52YWxpZFlhbWwoc3RyKSB7XG4gICAgcmV0dXJuIHJlZ2V4cFRlc3QoeWFtbEluZGljYXRvcnMsIHN0cik7XG59XG4iLCJ2YXIgZGVlcEVxdWFsID0gcmVxdWlyZSgnZGVlcC1lcXVhbCcpO1xudmFyIGRlZmluZWQgPSByZXF1aXJlKCdkZWZpbmVkJyk7XG52YXIgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xudmFyIGhhcyA9IHJlcXVpcmUoJ2hhcycpO1xudmFyIHRyaW0gPSByZXF1aXJlKCdzdHJpbmcucHJvdG90eXBlLnRyaW0nKTtcbnZhciBiaW5kID0gcmVxdWlyZSgnZnVuY3Rpb24tYmluZCcpO1xudmFyIGZvckVhY2ggPSByZXF1aXJlKCdmb3ItZWFjaCcpO1xudmFyIGlzRW51bWVyYWJsZSA9IGJpbmQuY2FsbChGdW5jdGlvbi5jYWxsLCBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlKTtcbnZhciB0b0xvd2VyQ2FzZSA9IGJpbmQuY2FsbChGdW5jdGlvbi5jYWxsLCBTdHJpbmcucHJvdG90eXBlLnRvTG93ZXJDYXNlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXN0O1xuXG52YXIgbmV4dFRpY2sgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlICE9PSAndW5kZWZpbmVkJ1xuICAgID8gc2V0SW1tZWRpYXRlXG4gICAgOiBwcm9jZXNzLm5leHRUaWNrO1xudmFyIHNhZmVTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbnZhciBzYWZlQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuXG5pbmhlcml0cyhUZXN0LCBFdmVudEVtaXR0ZXIpO1xuXG52YXIgZ2V0VGVzdEFyZ3MgPSBmdW5jdGlvbiAobmFtZV8sIG9wdHNfLCBjYl8pIHtcbiAgICB2YXIgbmFtZSA9ICcoYW5vbnltb3VzKSc7XG4gICAgdmFyIG9wdHMgPSB7fTtcbiAgICB2YXIgY2I7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYXJnID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB2YXIgdCA9IHR5cGVvZiBhcmc7XG4gICAgICAgIGlmICh0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgbmFtZSA9IGFyZztcbiAgICAgICAgfSBlbHNlIGlmICh0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgb3B0cyA9IGFyZyB8fCBvcHRzO1xuICAgICAgICB9IGVsc2UgaWYgKHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNiID0gYXJnO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IG5hbWU6IG5hbWUsIG9wdHM6IG9wdHMsIGNiOiBjYiB9O1xufTtcblxuZnVuY3Rpb24gVGVzdChuYW1lXywgb3B0c18sIGNiXykge1xuICAgIGlmICghICh0aGlzIGluc3RhbmNlb2YgVGVzdCkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBUZXN0KG5hbWVfLCBvcHRzXywgY2JfKTtcbiAgICB9XG5cbiAgICB2YXIgYXJncyA9IGdldFRlc3RBcmdzKG5hbWVfLCBvcHRzXywgY2JfKTtcblxuICAgIHRoaXMucmVhZGFibGUgPSB0cnVlO1xuICAgIHRoaXMubmFtZSA9IGFyZ3MubmFtZSB8fCAnKGFub255bW91cyknO1xuICAgIHRoaXMuYXNzZXJ0Q291bnQgPSAwO1xuICAgIHRoaXMucGVuZGluZ0NvdW50ID0gMDtcbiAgICB0aGlzLl9za2lwID0gYXJncy5vcHRzLnNraXAgfHwgZmFsc2U7XG4gICAgdGhpcy5fdG9kbyA9IGFyZ3Mub3B0cy50b2RvIHx8IGZhbHNlO1xuICAgIHRoaXMuX3RpbWVvdXQgPSBhcmdzLm9wdHMudGltZW91dDtcbiAgICB0aGlzLl9wbGFuID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX2NiID0gYXJncy5jYjtcbiAgICB0aGlzLl9wcm9nZW55ID0gW107XG4gICAgdGhpcy5fb2sgPSB0cnVlO1xuICAgIHZhciBkZXB0aEVudlZhciA9IHByb2Nlc3MuZW52Lk5PREVfVEFQRV9PQkpFQ1RfUFJJTlRfREVQVEg7XG4gICAgaWYgKGFyZ3Mub3B0cy5vYmplY3RQcmludERlcHRoKSB7XG4gICAgICAgIHRoaXMuX29iamVjdFByaW50RGVwdGggPSBhcmdzLm9wdHMub2JqZWN0UHJpbnREZXB0aDtcbiAgICB9IGVsc2UgaWYgKGRlcHRoRW52VmFyKSB7XG4gICAgICAgIGlmICh0b0xvd2VyQ2FzZShkZXB0aEVudlZhcikgPT09ICdpbmZpbml0eScpIHtcbiAgICAgICAgICAgIHRoaXMuX29iamVjdFByaW50RGVwdGggPSBJbmZpbml0eTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29iamVjdFByaW50RGVwdGggPSBkZXB0aEVudlZhcjtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX29iamVjdFByaW50RGVwdGggPSA1O1xuICAgIH1cblxuICAgIGZvciAodmFyIHByb3AgaW4gdGhpcykge1xuICAgICAgICB0aGlzW3Byb3BdID0gKGZ1bmN0aW9uIGJpbmQoc2VsZiwgdmFsKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBib3VuZCgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgICB9KSh0aGlzLCB0aGlzW3Byb3BdKTtcbiAgICB9XG59XG5cblRlc3QucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fc2tpcCkge1xuICAgICAgICB0aGlzLmNvbW1lbnQoJ1NLSVAgJyArIHRoaXMubmFtZSk7XG4gICAgfVxuICAgIGlmICghdGhpcy5fY2IgfHwgdGhpcy5fc2tpcCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5kKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLl90aW1lb3V0ICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy50aW1lb3V0QWZ0ZXIodGhpcy5fdGltZW91dCk7XG4gICAgfVxuICAgIHRoaXMuZW1pdCgncHJlcnVuJyk7XG4gICAgdGhpcy5fY2IodGhpcyk7XG4gICAgdGhpcy5lbWl0KCdydW4nKTtcbn07XG5cblRlc3QucHJvdG90eXBlLnRlc3QgPSBmdW5jdGlvbiAobmFtZSwgb3B0cywgY2IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHQgPSBuZXcgVGVzdChuYW1lLCBvcHRzLCBjYik7XG4gICAgdGhpcy5fcHJvZ2VueS5wdXNoKHQpO1xuICAgIHRoaXMucGVuZGluZ0NvdW50Kys7XG4gICAgdGhpcy5lbWl0KCd0ZXN0JywgdCk7XG4gICAgdC5vbigncHJlcnVuJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmFzc2VydENvdW50Kys7XG4gICAgfSlcblxuICAgIGlmICghc2VsZi5fcGVuZGluZ0Fzc2VydHMoKSkge1xuICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLl9lbmQoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXNlbGYuX3BsYW4gJiYgc2VsZi5wZW5kaW5nQ291bnQgPT0gc2VsZi5fcHJvZ2VueS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHNlbGYuX2VuZCgpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5jb21tZW50ID0gZnVuY3Rpb24gKG1zZykge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBmb3JFYWNoKHRyaW0obXNnKS5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIChhTXNnKSB7XG4gICAgICAgIHRoYXQuZW1pdCgncmVzdWx0JywgdHJpbShhTXNnKS5yZXBsYWNlKC9eI1xccyovLCAnJykpO1xuICAgIH0pO1xufTtcblxuVGVzdC5wcm90b3R5cGUucGxhbiA9IGZ1bmN0aW9uIChuKSB7XG4gICAgdGhpcy5fcGxhbiA9IG47XG4gICAgdGhpcy5lbWl0KCdwbGFuJywgbik7XG59O1xuXG5UZXN0LnByb3RvdHlwZS50aW1lb3V0QWZ0ZXIgPSBmdW5jdGlvbiAobXMpIHtcbiAgICBpZiAoIW1zKSB0aHJvdyBuZXcgRXJyb3IoJ3RpbWVvdXRBZnRlciByZXF1aXJlcyBhIHRpbWVzcGFuJyk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB0aW1lb3V0ID0gc2FmZVNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmZhaWwoJ3Rlc3QgdGltZWQgb3V0IGFmdGVyICcgKyBtcyArICdtcycpO1xuICAgICAgICBzZWxmLmVuZCgpO1xuICAgIH0sIG1zKTtcbiAgICB0aGlzLm9uY2UoJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2FmZUNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICB9KTtcbn1cblxuVGVzdC5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24gKGVycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAxICYmICEhZXJyKSB7XG4gICAgICAgIHRoaXMuaWZFcnJvcihlcnIpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNhbGxlZEVuZCkge1xuICAgICAgICB0aGlzLmZhaWwoJy5lbmQoKSBjYWxsZWQgdHdpY2UnKTtcbiAgICB9XG4gICAgdGhpcy5jYWxsZWRFbmQgPSB0cnVlO1xuICAgIHRoaXMuX2VuZCgpO1xufTtcblxuVGVzdC5wcm90b3R5cGUuX2VuZCA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHRoaXMuX3Byb2dlbnkubGVuZ3RoKSB7XG4gICAgICAgIHZhciB0ID0gdGhpcy5fcHJvZ2VueS5zaGlmdCgpO1xuICAgICAgICB0Lm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7IHNlbGYuX2VuZCgpIH0pO1xuICAgICAgICB0LnJ1bigpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmVuZGVkKSB0aGlzLmVtaXQoJ2VuZCcpO1xuICAgIHZhciBwZW5kaW5nQXNzZXJ0cyA9IHRoaXMuX3BlbmRpbmdBc3NlcnRzKCk7XG4gICAgaWYgKCF0aGlzLl9wbGFuRXJyb3IgJiYgdGhpcy5fcGxhbiAhPT0gdW5kZWZpbmVkICYmIHBlbmRpbmdBc3NlcnRzKSB7XG4gICAgICAgIHRoaXMuX3BsYW5FcnJvciA9IHRydWU7XG4gICAgICAgIHRoaXMuZmFpbCgncGxhbiAhPSBjb3VudCcsIHtcbiAgICAgICAgICAgIGV4cGVjdGVkIDogdGhpcy5fcGxhbixcbiAgICAgICAgICAgIGFjdHVhbCA6IHRoaXMuYXNzZXJ0Q291bnRcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHRoaXMuZW5kZWQgPSB0cnVlO1xufTtcblxuVGVzdC5wcm90b3R5cGUuX2V4aXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX3BsYW4gIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhdGhpcy5fcGxhbkVycm9yICYmIHRoaXMuYXNzZXJ0Q291bnQgIT09IHRoaXMuX3BsYW4pIHtcbiAgICAgICAgdGhpcy5fcGxhbkVycm9yID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5mYWlsKCdwbGFuICE9IGNvdW50Jywge1xuICAgICAgICAgICAgZXhwZWN0ZWQgOiB0aGlzLl9wbGFuLFxuICAgICAgICAgICAgYWN0dWFsIDogdGhpcy5hc3NlcnRDb3VudCxcbiAgICAgICAgICAgIGV4aXRpbmcgOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuZW5kZWQpIHtcbiAgICAgICAgdGhpcy5mYWlsKCd0ZXN0IGV4aXRlZCB3aXRob3V0IGVuZGluZycsIHtcbiAgICAgICAgICAgIGV4aXRpbmc6IHRydWVcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuVGVzdC5wcm90b3R5cGUuX3BlbmRpbmdBc3NlcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9wbGFuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9wbGFuIC0gKHRoaXMuX3Byb2dlbnkubGVuZ3RoICsgdGhpcy5hc3NlcnRDb3VudCk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5fYXNzZXJ0ID0gZnVuY3Rpb24gYXNzZXJ0KG9rLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBleHRyYSA9IG9wdHMuZXh0cmEgfHwge307XG5cbiAgICB2YXIgcmVzID0ge1xuICAgICAgICBpZDogc2VsZi5hc3NlcnRDb3VudCsrLFxuICAgICAgICBvazogQm9vbGVhbihvayksXG4gICAgICAgIHNraXA6IGRlZmluZWQoZXh0cmEuc2tpcCwgb3B0cy5za2lwKSxcbiAgICAgICAgdG9kbzogZGVmaW5lZChleHRyYS50b2RvLCBvcHRzLnRvZG8sIHNlbGYuX3RvZG8pLFxuICAgICAgICBuYW1lOiBkZWZpbmVkKGV4dHJhLm1lc3NhZ2UsIG9wdHMubWVzc2FnZSwgJyh1bm5hbWVkIGFzc2VydCknKSxcbiAgICAgICAgb3BlcmF0b3I6IGRlZmluZWQoZXh0cmEub3BlcmF0b3IsIG9wdHMub3BlcmF0b3IpLFxuICAgICAgICBvYmplY3RQcmludERlcHRoOiBzZWxmLl9vYmplY3RQcmludERlcHRoXG4gICAgfTtcbiAgICBpZiAoaGFzKG9wdHMsICdhY3R1YWwnKSB8fCBoYXMoZXh0cmEsICdhY3R1YWwnKSkge1xuICAgICAgICByZXMuYWN0dWFsID0gZGVmaW5lZChleHRyYS5hY3R1YWwsIG9wdHMuYWN0dWFsKTtcbiAgICB9XG4gICAgaWYgKGhhcyhvcHRzLCAnZXhwZWN0ZWQnKSB8fCBoYXMoZXh0cmEsICdleHBlY3RlZCcpKSB7XG4gICAgICAgIHJlcy5leHBlY3RlZCA9IGRlZmluZWQoZXh0cmEuZXhwZWN0ZWQsIG9wdHMuZXhwZWN0ZWQpO1xuICAgIH1cbiAgICB0aGlzLl9vayA9IEJvb2xlYW4odGhpcy5fb2sgJiYgb2spO1xuXG4gICAgaWYgKCFvayAmJiAhcmVzLnRvZG8pIHtcbiAgICAgICAgcmVzLmVycm9yID0gZGVmaW5lZChleHRyYS5lcnJvciwgb3B0cy5lcnJvciwgbmV3IEVycm9yKHJlcy5uYW1lKSk7XG4gICAgfVxuXG4gICAgaWYgKCFvaykge1xuICAgICAgICB2YXIgZSA9IG5ldyBFcnJvcignZXhjZXB0aW9uJyk7XG4gICAgICAgIHZhciBlcnIgPSAoZS5zdGFjayB8fCAnJykuc3BsaXQoJ1xcbicpO1xuICAgICAgICB2YXIgZGlyID0gX19kaXJuYW1lICsgcGF0aC5zZXA7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgU3RhY2sgdHJhY2UgbGluZXMgbWF5IHJlc2VtYmxlIG9uZSBvZiB0aGUgZm9sbG93aW5nLiBXZSBuZWVkXG4gICAgICAgICAgICAgICAgdG8gc2hvdWxkIGNvcnJlY3RseSBleHRyYWN0IGEgZnVuY3Rpb24gbmFtZSAoaWYgYW55KSBhbmRcbiAgICAgICAgICAgICAgICBwYXRoIC8gbGluZSBuby4gZm9yIGVhY2ggbGluZS5cblxuICAgICAgICAgICAgICAgICAgICBhdCBteUZ1bmN0aW9uICgvcGF0aC90by9maWxlLmpzOjEyMzo0NSlcbiAgICAgICAgICAgICAgICAgICAgYXQgbXlGdW5jdGlvbiAoL3BhdGgvdG8vZmlsZS5vdGhlci1leHQ6MTIzOjQ1KVxuICAgICAgICAgICAgICAgICAgICBhdCBteUZ1bmN0aW9uICgvcGF0aCB0by9maWxlLmpzOjEyMzo0NSlcbiAgICAgICAgICAgICAgICAgICAgYXQgbXlGdW5jdGlvbiAoQzpcXHBhdGhcXHRvXFxmaWxlLmpzOjEyMzo0NSlcbiAgICAgICAgICAgICAgICAgICAgYXQgbXlGdW5jdGlvbiAoL3BhdGgvdG8vZmlsZS5qczoxMjMpXG4gICAgICAgICAgICAgICAgICAgIGF0IFRlc3QuPGFub255bW91cz4gKC9wYXRoL3RvL2ZpbGUuanM6MTIzOjQ1KVxuICAgICAgICAgICAgICAgICAgICBhdCBUZXN0LmJvdW5kIFthcyBydW5dICgvcGF0aC90by9maWxlLmpzOjEyMzo0NSlcbiAgICAgICAgICAgICAgICAgICAgYXQgL3BhdGgvdG8vZmlsZS5qczoxMjM6NDVcblxuICAgICAgICAgICAgICAgIFJlZ2V4IGhhcyB0aHJlZSBwYXJ0cy4gRmlyc3QgaXMgbm9uLWNhcHR1cmluZyBncm91cCBmb3IgJ2F0ICdcbiAgICAgICAgICAgICAgICAocGx1cyBhbnl0aGluZyBwcmVjZWRpbmcgaXQpLlxuXG4gICAgICAgICAgICAgICAgICAgIC9eKD86W15cXHNdKlxccypcXGJhdFxccyspL1xuXG4gICAgICAgICAgICAgICAgU2Vjb25kIGNhcHR1cmVzIGZ1bmN0aW9uIGNhbGwgZGVzY3JpcHRpb24gKG9wdGlvbmFsKS4gVGhpcyBpc1xuICAgICAgICAgICAgICAgIG5vdCBuZWNlc3NhcmlseSBhIHZhbGlkIEpTIGZ1bmN0aW9uIG5hbWUsIGJ1dCBqdXN0IHdoYXQgdGhlXG4gICAgICAgICAgICAgICAgc3RhY2sgdHJhY2UgaXMgdXNpbmcgdG8gcmVwcmVzZW50IGEgZnVuY3Rpb24gY2FsbC4gSXQgbWF5IGxvb2tcbiAgICAgICAgICAgICAgICBsaWtlIGA8YW5vbnltb3VzPmAgb3IgJ1Rlc3QuYm91bmQgW2FzIHJ1bl0nLlxuXG4gICAgICAgICAgICAgICAgRm9yIG91ciBwdXJwb3Nlcywgd2UgYXNzdW1lIHRoYXQsIGlmIHRoZXJlIGlzIGEgZnVuY3Rpb25cbiAgICAgICAgICAgICAgICBuYW1lLCBpdCdzIGV2ZXJ5dGhpbmcgbGVhZGluZyB1cCB0byB0aGUgZmlyc3Qgb3BlblxuICAgICAgICAgICAgICAgIHBhcmVudGhlc2VzICh0cmltbWVkKSBiZWZvcmUgb3VyIHBhdGhuYW1lLlxuXG4gICAgICAgICAgICAgICAgICAgIC8oPzooLiopXFxzK1xcKCk/L1xuXG4gICAgICAgICAgICAgICAgTGFzdCBwYXJ0IGNhcHR1cmVzIGZpbGUgcGF0aCBwbHVzIGxpbmUgbm8gKGFuZCBvcHRpb25hbFxuICAgICAgICAgICAgICAgIGNvbHVtbiBubykuXG5cbiAgICAgICAgICAgICAgICAgICAgLygoPzpcXC98W2EtekEtWl06XFxcXClbXjpcXCldKzooXFxkKykoPzo6KFxcZCspKT8pL1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciByZSA9IC9eKD86W15cXHNdKlxccypcXGJhdFxccyspKD86KC4qKVxccytcXCgpPygoPzpcXC98W2EtekEtWl06XFxcXClbXjpcXCldKzooXFxkKykoPzo6KFxcZCspKT8pL1xuICAgICAgICAgICAgdmFyIG0gPSByZS5leGVjKGVycltpXSk7XG5cbiAgICAgICAgICAgIGlmICghbSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY2FsbERlc2NyaXB0aW9uID0gbVsxXSB8fCAnPGFub255bW91cz4nO1xuICAgICAgICAgICAgdmFyIGZpbGVQYXRoID0gbVsyXTtcblxuICAgICAgICAgICAgaWYgKGZpbGVQYXRoLnNsaWNlKDAsIGRpci5sZW5ndGgpID09PSBkaXIpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRnVuY3Rpb24gY2FsbCBkZXNjcmlwdGlvbiBtYXkgbm90IChqdXN0KSBiZSBhIGZ1bmN0aW9uIG5hbWUuXG4gICAgICAgICAgICAvLyBUcnkgdG8gZXh0cmFjdCBmdW5jdGlvbiBuYW1lIGJ5IGxvb2tpbmcgYXQgZmlyc3QgXCJ3b3JkXCIgb25seS5cbiAgICAgICAgICAgIHJlcy5mdW5jdGlvbk5hbWUgPSBjYWxsRGVzY3JpcHRpb24uc3BsaXQoL1xccysvKVswXVxuICAgICAgICAgICAgcmVzLmZpbGUgPSBmaWxlUGF0aDtcbiAgICAgICAgICAgIHJlcy5saW5lID0gTnVtYmVyKG1bM10pO1xuICAgICAgICAgICAgaWYgKG1bNF0pIHJlcy5jb2x1bW4gPSBOdW1iZXIobVs0XSk7XG5cbiAgICAgICAgICAgIHJlcy5hdCA9IGNhbGxEZXNjcmlwdGlvbiArICcgKCcgKyBmaWxlUGF0aCArICcpJztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2VsZi5lbWl0KCdyZXN1bHQnLCByZXMpO1xuXG4gICAgdmFyIHBlbmRpbmdBc3NlcnRzID0gc2VsZi5fcGVuZGluZ0Fzc2VydHMoKTtcbiAgICBpZiAoIXBlbmRpbmdBc3NlcnRzKSB7XG4gICAgICAgIGlmIChleHRyYS5leGl0aW5nKSB7XG4gICAgICAgICAgICBzZWxmLl9lbmQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9lbmQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzZWxmLl9wbGFuRXJyb3IgJiYgcGVuZGluZ0Fzc2VydHMgPCAwKSB7XG4gICAgICAgIHNlbGYuX3BsYW5FcnJvciA9IHRydWU7XG4gICAgICAgIHNlbGYuZmFpbCgncGxhbiAhPSBjb3VudCcsIHtcbiAgICAgICAgICAgIGV4cGVjdGVkIDogc2VsZi5fcGxhbixcbiAgICAgICAgICAgIGFjdHVhbCA6IHNlbGYuX3BsYW4gLSBwZW5kaW5nQXNzZXJ0c1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5UZXN0LnByb3RvdHlwZS5mYWlsID0gZnVuY3Rpb24gKG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQoZmFsc2UsIHtcbiAgICAgICAgbWVzc2FnZSA6IG1zZyxcbiAgICAgICAgb3BlcmF0b3IgOiAnZmFpbCcsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cblRlc3QucHJvdG90eXBlLnBhc3MgPSBmdW5jdGlvbiAobXNnLCBleHRyYSkge1xuICAgIHRoaXMuX2Fzc2VydCh0cnVlLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBtc2csXG4gICAgICAgIG9wZXJhdG9yIDogJ3Bhc3MnLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5za2lwID0gZnVuY3Rpb24gKG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQodHJ1ZSwge1xuICAgICAgICBtZXNzYWdlIDogbXNnLFxuICAgICAgICBvcGVyYXRvciA6ICdza2lwJyxcbiAgICAgICAgc2tpcCA6IHRydWUsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cbmZ1bmN0aW9uIGFzc2VydCh2YWx1ZSwgbXNnLCBleHRyYSkge1xuICAgIHRoaXMuX2Fzc2VydCh2YWx1ZSwge1xuICAgICAgICBtZXNzYWdlIDogZGVmaW5lZChtc2csICdzaG91bGQgYmUgdHJ1dGh5JyksXG4gICAgICAgIG9wZXJhdG9yIDogJ29rJyxcbiAgICAgICAgZXhwZWN0ZWQgOiB0cnVlLFxuICAgICAgICBhY3R1YWwgOiB2YWx1ZSxcbiAgICAgICAgZXh0cmEgOiBleHRyYVxuICAgIH0pO1xufVxuVGVzdC5wcm90b3R5cGUub2tcbj0gVGVzdC5wcm90b3R5cGVbJ3RydWUnXVxuPSBUZXN0LnByb3RvdHlwZS5hc3NlcnRcbj0gYXNzZXJ0O1xuXG5mdW5jdGlvbiBub3RPSyh2YWx1ZSwgbXNnLCBleHRyYSkge1xuICAgIHRoaXMuX2Fzc2VydCghdmFsdWUsIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCAnc2hvdWxkIGJlIGZhbHN5JyksXG4gICAgICAgIG9wZXJhdG9yIDogJ25vdE9rJyxcbiAgICAgICAgZXhwZWN0ZWQgOiBmYWxzZSxcbiAgICAgICAgYWN0dWFsIDogdmFsdWUsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn1cblRlc3QucHJvdG90eXBlLm5vdE9rXG49IFRlc3QucHJvdG90eXBlWydmYWxzZSddXG49IFRlc3QucHJvdG90eXBlLm5vdG9rXG49IG5vdE9LO1xuXG5mdW5jdGlvbiBlcnJvcihlcnIsIG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQoIWVyciwge1xuICAgICAgICBtZXNzYWdlIDogZGVmaW5lZChtc2csIFN0cmluZyhlcnIpKSxcbiAgICAgICAgb3BlcmF0b3IgOiAnZXJyb3InLFxuICAgICAgICBhY3R1YWwgOiBlcnIsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn1cblRlc3QucHJvdG90eXBlLmVycm9yXG49IFRlc3QucHJvdG90eXBlLmlmRXJyb3Jcbj0gVGVzdC5wcm90b3R5cGUuaWZFcnJcbj0gVGVzdC5wcm90b3R5cGUuaWZlcnJvclxuPSBlcnJvcjtcblxuZnVuY3Rpb24gZXF1YWwoYSwgYiwgbXNnLCBleHRyYSkge1xuICAgIHRoaXMuX2Fzc2VydChhID09PSBiLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBkZWZpbmVkKG1zZywgJ3Nob3VsZCBiZSBlcXVhbCcpLFxuICAgICAgICBvcGVyYXRvciA6ICdlcXVhbCcsXG4gICAgICAgIGFjdHVhbCA6IGEsXG4gICAgICAgIGV4cGVjdGVkIDogYixcbiAgICAgICAgZXh0cmEgOiBleHRyYVxuICAgIH0pO1xufVxuVGVzdC5wcm90b3R5cGUuZXF1YWxcbj0gVGVzdC5wcm90b3R5cGUuZXF1YWxzXG49IFRlc3QucHJvdG90eXBlLmlzRXF1YWxcbj0gVGVzdC5wcm90b3R5cGUuaXNcbj0gVGVzdC5wcm90b3R5cGUuc3RyaWN0RXF1YWxcbj0gVGVzdC5wcm90b3R5cGUuc3RyaWN0RXF1YWxzXG49IGVxdWFsO1xuXG5mdW5jdGlvbiBub3RFcXVhbChhLCBiLCBtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KGEgIT09IGIsIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCAnc2hvdWxkIG5vdCBiZSBlcXVhbCcpLFxuICAgICAgICBvcGVyYXRvciA6ICdub3RFcXVhbCcsXG4gICAgICAgIGFjdHVhbCA6IGEsXG4gICAgICAgIGV4cGVjdGVkIDogYixcbiAgICAgICAgZXh0cmEgOiBleHRyYVxuICAgIH0pO1xufVxuVGVzdC5wcm90b3R5cGUubm90RXF1YWxcbj0gVGVzdC5wcm90b3R5cGUubm90RXF1YWxzXG49IFRlc3QucHJvdG90eXBlLm5vdFN0cmljdEVxdWFsXG49IFRlc3QucHJvdG90eXBlLm5vdFN0cmljdEVxdWFsc1xuPSBUZXN0LnByb3RvdHlwZS5pc05vdEVxdWFsXG49IFRlc3QucHJvdG90eXBlLmlzTm90XG49IFRlc3QucHJvdG90eXBlLm5vdFxuPSBUZXN0LnByb3RvdHlwZS5kb2VzTm90RXF1YWxcbj0gVGVzdC5wcm90b3R5cGUuaXNJbmVxdWFsXG49IG5vdEVxdWFsO1xuXG5mdW5jdGlvbiB0YXBlRGVlcEVxdWFsKGEsIGIsIG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQoZGVlcEVxdWFsKGEsIGIsIHsgc3RyaWN0OiB0cnVlIH0pLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBkZWZpbmVkKG1zZywgJ3Nob3VsZCBiZSBlcXVpdmFsZW50JyksXG4gICAgICAgIG9wZXJhdG9yIDogJ2RlZXBFcXVhbCcsXG4gICAgICAgIGFjdHVhbCA6IGEsXG4gICAgICAgIGV4cGVjdGVkIDogYixcbiAgICAgICAgZXh0cmEgOiBleHRyYVxuICAgIH0pO1xufVxuVGVzdC5wcm90b3R5cGUuZGVlcEVxdWFsXG49IFRlc3QucHJvdG90eXBlLmRlZXBFcXVhbHNcbj0gVGVzdC5wcm90b3R5cGUuaXNFcXVpdmFsZW50XG49IFRlc3QucHJvdG90eXBlLnNhbWVcbj0gdGFwZURlZXBFcXVhbDtcblxuZnVuY3Rpb24gZGVlcExvb3NlRXF1YWwoYSwgYiwgbXNnLCBleHRyYSkge1xuICAgIHRoaXMuX2Fzc2VydChkZWVwRXF1YWwoYSwgYiksIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCAnc2hvdWxkIGJlIGVxdWl2YWxlbnQnKSxcbiAgICAgICAgb3BlcmF0b3IgOiAnZGVlcExvb3NlRXF1YWwnLFxuICAgICAgICBhY3R1YWwgOiBhLFxuICAgICAgICBleHBlY3RlZCA6IGIsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn1cblRlc3QucHJvdG90eXBlLmRlZXBMb29zZUVxdWFsXG49IFRlc3QucHJvdG90eXBlLmxvb3NlRXF1YWxcbj0gVGVzdC5wcm90b3R5cGUubG9vc2VFcXVhbHNcbj0gZGVlcExvb3NlRXF1YWw7XG5cbmZ1bmN0aW9uIG5vdERlZXBFcXVhbChhLCBiLCBtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KCFkZWVwRXF1YWwoYSwgYiwgeyBzdHJpY3Q6IHRydWUgfSksIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCAnc2hvdWxkIG5vdCBiZSBlcXVpdmFsZW50JyksXG4gICAgICAgIG9wZXJhdG9yIDogJ25vdERlZXBFcXVhbCcsXG4gICAgICAgIGFjdHVhbCA6IGEsXG4gICAgICAgIGV4cGVjdGVkIDogYixcbiAgICAgICAgZXh0cmEgOiBleHRyYVxuICAgIH0pO1xufVxuVGVzdC5wcm90b3R5cGUubm90RGVlcEVxdWFsXG49IFRlc3QucHJvdG90eXBlLm5vdERlZXBFcXVhbHNcbj0gVGVzdC5wcm90b3R5cGUubm90RXF1aXZhbGVudFxuPSBUZXN0LnByb3RvdHlwZS5ub3REZWVwbHlcbj0gVGVzdC5wcm90b3R5cGUubm90U2FtZVxuPSBUZXN0LnByb3RvdHlwZS5pc05vdERlZXBFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5pc05vdERlZXBseVxuPSBUZXN0LnByb3RvdHlwZS5pc05vdEVxdWl2YWxlbnRcbj0gVGVzdC5wcm90b3R5cGUuaXNJbmVxdWl2YWxlbnRcbj0gbm90RGVlcEVxdWFsO1xuXG5mdW5jdGlvbiBub3REZWVwTG9vc2VFcXVhbChhLCBiLCBtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KCFkZWVwRXF1YWwoYSwgYiksIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCAnc2hvdWxkIGJlIGVxdWl2YWxlbnQnKSxcbiAgICAgICAgb3BlcmF0b3IgOiAnbm90RGVlcExvb3NlRXF1YWwnLFxuICAgICAgICBhY3R1YWwgOiBhLFxuICAgICAgICBleHBlY3RlZCA6IGIsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn1cblRlc3QucHJvdG90eXBlLm5vdERlZXBMb29zZUVxdWFsXG49IFRlc3QucHJvdG90eXBlLm5vdExvb3NlRXF1YWxcbj0gVGVzdC5wcm90b3R5cGUubm90TG9vc2VFcXVhbHNcbj0gbm90RGVlcExvb3NlRXF1YWw7XG5cblRlc3QucHJvdG90eXBlWyd0aHJvd3MnXSA9IGZ1bmN0aW9uIChmbiwgZXhwZWN0ZWQsIG1zZywgZXh0cmEpIHtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnc3RyaW5nJykge1xuICAgICAgICBtc2cgPSBleHBlY3RlZDtcbiAgICAgICAgZXhwZWN0ZWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgdmFyIGNhdWdodCA9IHVuZGVmaW5lZDtcblxuICAgIHRyeSB7XG4gICAgICAgIGZuKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNhdWdodCA9IHsgZXJyb3IgOiBlcnIgfTtcbiAgICAgICAgaWYgKChlcnIgIT0gbnVsbCkgJiYgKCFpc0VudW1lcmFibGUoZXJyLCAnbWVzc2FnZScpIHx8ICFoYXMoZXJyLCAnbWVzc2FnZScpKSkge1xuICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICAgIGRlbGV0ZSBlcnIubWVzc2FnZTtcbiAgICAgICAgICAgIGVyci5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBwYXNzZWQgPSBjYXVnaHQ7XG5cbiAgICBpZiAoZXhwZWN0ZWQgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgcGFzc2VkID0gZXhwZWN0ZWQudGVzdChjYXVnaHQgJiYgY2F1Z2h0LmVycm9yKTtcbiAgICAgICAgZXhwZWN0ZWQgPSBTdHJpbmcoZXhwZWN0ZWQpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgZXhwZWN0ZWQgPT09ICdmdW5jdGlvbicgJiYgY2F1Z2h0KSB7XG4gICAgICAgIHBhc3NlZCA9IGNhdWdodC5lcnJvciBpbnN0YW5jZW9mIGV4cGVjdGVkO1xuICAgICAgICBjYXVnaHQuZXJyb3IgPSBjYXVnaHQuZXJyb3IuY29uc3RydWN0b3I7XG4gICAgfVxuXG4gICAgdGhpcy5fYXNzZXJ0KHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyAmJiBwYXNzZWQsIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCAnc2hvdWxkIHRocm93JyksXG4gICAgICAgIG9wZXJhdG9yIDogJ3Rocm93cycsXG4gICAgICAgIGFjdHVhbCA6IGNhdWdodCAmJiBjYXVnaHQuZXJyb3IsXG4gICAgICAgIGV4cGVjdGVkIDogZXhwZWN0ZWQsXG4gICAgICAgIGVycm9yOiAhcGFzc2VkICYmIGNhdWdodCAmJiBjYXVnaHQuZXJyb3IsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cblRlc3QucHJvdG90eXBlLmRvZXNOb3RUaHJvdyA9IGZ1bmN0aW9uIChmbiwgZXhwZWN0ZWQsIG1zZywgZXh0cmEpIHtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnc3RyaW5nJykge1xuICAgICAgICBtc2cgPSBleHBlY3RlZDtcbiAgICAgICAgZXhwZWN0ZWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHZhciBjYXVnaHQgPSB1bmRlZmluZWQ7XG4gICAgdHJ5IHtcbiAgICAgICAgZm4oKTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgICBjYXVnaHQgPSB7IGVycm9yIDogZXJyIH07XG4gICAgfVxuICAgIHRoaXMuX2Fzc2VydCghY2F1Z2h0LCB7XG4gICAgICAgIG1lc3NhZ2UgOiBkZWZpbmVkKG1zZywgJ3Nob3VsZCBub3QgdGhyb3cnKSxcbiAgICAgICAgb3BlcmF0b3IgOiAndGhyb3dzJyxcbiAgICAgICAgYWN0dWFsIDogY2F1Z2h0ICYmIGNhdWdodC5lcnJvcixcbiAgICAgICAgZXhwZWN0ZWQgOiBleHBlY3RlZCxcbiAgICAgICAgZXJyb3IgOiBjYXVnaHQgJiYgY2F1Z2h0LmVycm9yLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnNraXAgPSBmdW5jdGlvbiAobmFtZV8sIF9vcHRzLCBfY2IpIHtcbiAgICB2YXIgYXJncyA9IGdldFRlc3RBcmdzLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgYXJncy5vcHRzLnNraXAgPSB0cnVlO1xuICAgIHJldHVybiBUZXN0KGFyZ3MubmFtZSwgYXJncy5vcHRzLCBhcmdzLmNiKTtcbn07XG5cbi8vIHZpbTogc2V0IHNvZnR0YWJzdG9wPTQgc2hpZnR3aWR0aD00OlxuIiwidmFyIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cbi8vIHRocm91Z2hcbi8vXG4vLyBhIHN0cmVhbSB0aGF0IGRvZXMgbm90aGluZyBidXQgcmUtZW1pdCB0aGUgaW5wdXQuXG4vLyB1c2VmdWwgZm9yIGFnZ3JlZ2F0aW5nIGEgc2VyaWVzIG9mIGNoYW5naW5nIGJ1dCBub3QgZW5kaW5nIHN0cmVhbXMgaW50byBvbmUgc3RyZWFtKVxuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB0aHJvdWdoXG50aHJvdWdoLnRocm91Z2ggPSB0aHJvdWdoXG5cbi8vY3JlYXRlIGEgcmVhZGFibGUgd3JpdGFibGUgc3RyZWFtLlxuXG5mdW5jdGlvbiB0aHJvdWdoICh3cml0ZSwgZW5kLCBvcHRzKSB7XG4gIHdyaXRlID0gd3JpdGUgfHwgZnVuY3Rpb24gKGRhdGEpIHsgdGhpcy5xdWV1ZShkYXRhKSB9XG4gIGVuZCA9IGVuZCB8fCBmdW5jdGlvbiAoKSB7IHRoaXMucXVldWUobnVsbCkgfVxuXG4gIHZhciBlbmRlZCA9IGZhbHNlLCBkZXN0cm95ZWQgPSBmYWxzZSwgYnVmZmVyID0gW10sIF9lbmRlZCA9IGZhbHNlXG4gIHZhciBzdHJlYW0gPSBuZXcgU3RyZWFtKClcbiAgc3RyZWFtLnJlYWRhYmxlID0gc3RyZWFtLndyaXRhYmxlID0gdHJ1ZVxuICBzdHJlYW0ucGF1c2VkID0gZmFsc2VcblxuLy8gIHN0cmVhbS5hdXRvUGF1c2UgICA9ICEob3B0cyAmJiBvcHRzLmF1dG9QYXVzZSAgID09PSBmYWxzZSlcbiAgc3RyZWFtLmF1dG9EZXN0cm95ID0gIShvcHRzICYmIG9wdHMuYXV0b0Rlc3Ryb3kgPT09IGZhbHNlKVxuXG4gIHN0cmVhbS53cml0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgd3JpdGUuY2FsbCh0aGlzLCBkYXRhKVxuICAgIHJldHVybiAhc3RyZWFtLnBhdXNlZFxuICB9XG5cbiAgZnVuY3Rpb24gZHJhaW4oKSB7XG4gICAgd2hpbGUoYnVmZmVyLmxlbmd0aCAmJiAhc3RyZWFtLnBhdXNlZCkge1xuICAgICAgdmFyIGRhdGEgPSBidWZmZXIuc2hpZnQoKVxuICAgICAgaWYobnVsbCA9PT0gZGF0YSlcbiAgICAgICAgcmV0dXJuIHN0cmVhbS5lbWl0KCdlbmQnKVxuICAgICAgZWxzZVxuICAgICAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGRhdGEpXG4gICAgfVxuICB9XG5cbiAgc3RyZWFtLnF1ZXVlID0gc3RyZWFtLnB1c2ggPSBmdW5jdGlvbiAoZGF0YSkge1xuLy8gICAgY29uc29sZS5lcnJvcihlbmRlZClcbiAgICBpZihfZW5kZWQpIHJldHVybiBzdHJlYW1cbiAgICBpZihkYXRhID09PSBudWxsKSBfZW5kZWQgPSB0cnVlXG4gICAgYnVmZmVyLnB1c2goZGF0YSlcbiAgICBkcmFpbigpXG4gICAgcmV0dXJuIHN0cmVhbVxuICB9XG5cbiAgLy90aGlzIHdpbGwgYmUgcmVnaXN0ZXJlZCBhcyB0aGUgZmlyc3QgJ2VuZCcgbGlzdGVuZXJcbiAgLy9tdXN0IGNhbGwgZGVzdHJveSBuZXh0IHRpY2ssIHRvIG1ha2Ugc3VyZSB3ZSdyZSBhZnRlciBhbnlcbiAgLy9zdHJlYW0gcGlwZWQgZnJvbSBoZXJlLlxuICAvL3RoaXMgaXMgb25seSBhIHByb2JsZW0gaWYgZW5kIGlzIG5vdCBlbWl0dGVkIHN5bmNocm9ub3VzbHkuXG4gIC8vYSBuaWNlciB3YXkgdG8gZG8gdGhpcyBpcyB0byBtYWtlIHN1cmUgdGhpcyBpcyB0aGUgbGFzdCBsaXN0ZW5lciBmb3IgJ2VuZCdcblxuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICBzdHJlYW0ucmVhZGFibGUgPSBmYWxzZVxuICAgIGlmKCFzdHJlYW0ud3JpdGFibGUgJiYgc3RyZWFtLmF1dG9EZXN0cm95KVxuICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN0cmVhbS5kZXN0cm95KClcbiAgICAgIH0pXG4gIH0pXG5cbiAgZnVuY3Rpb24gX2VuZCAoKSB7XG4gICAgc3RyZWFtLndyaXRhYmxlID0gZmFsc2VcbiAgICBlbmQuY2FsbChzdHJlYW0pXG4gICAgaWYoIXN0cmVhbS5yZWFkYWJsZSAmJiBzdHJlYW0uYXV0b0Rlc3Ryb3kpXG4gICAgICBzdHJlYW0uZGVzdHJveSgpXG4gIH1cblxuICBzdHJlYW0uZW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICBpZihlbmRlZCkgcmV0dXJuXG4gICAgZW5kZWQgPSB0cnVlXG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCkgc3RyZWFtLndyaXRlKGRhdGEpXG4gICAgX2VuZCgpIC8vIHdpbGwgZW1pdCBvciBxdWV1ZVxuICAgIHJldHVybiBzdHJlYW1cbiAgfVxuXG4gIHN0cmVhbS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmKGRlc3Ryb3llZCkgcmV0dXJuXG4gICAgZGVzdHJveWVkID0gdHJ1ZVxuICAgIGVuZGVkID0gdHJ1ZVxuICAgIGJ1ZmZlci5sZW5ndGggPSAwXG4gICAgc3RyZWFtLndyaXRhYmxlID0gc3RyZWFtLnJlYWRhYmxlID0gZmFsc2VcbiAgICBzdHJlYW0uZW1pdCgnY2xvc2UnKVxuICAgIHJldHVybiBzdHJlYW1cbiAgfVxuXG4gIHN0cmVhbS5wYXVzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZihzdHJlYW0ucGF1c2VkKSByZXR1cm5cbiAgICBzdHJlYW0ucGF1c2VkID0gdHJ1ZVxuICAgIHJldHVybiBzdHJlYW1cbiAgfVxuXG4gIHN0cmVhbS5yZXN1bWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYoc3RyZWFtLnBhdXNlZCkge1xuICAgICAgc3RyZWFtLnBhdXNlZCA9IGZhbHNlXG4gICAgICBzdHJlYW0uZW1pdCgncmVzdW1lJylcbiAgICB9XG4gICAgZHJhaW4oKVxuICAgIC8vbWF5IGhhdmUgYmVjb21lIHBhdXNlZCBhZ2FpbixcbiAgICAvL2FzIGRyYWluIGVtaXRzICdkYXRhJy5cbiAgICBpZighc3RyZWFtLnBhdXNlZClcbiAgICAgIHN0cmVhbS5lbWl0KCdkcmFpbicpXG4gICAgcmV0dXJuIHN0cmVhbVxuICB9XG4gIHJldHVybiBzdHJlYW1cbn1cblxuIiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07IiwiXG4vKipcbiAqIE1vZHVsZSBleHBvcnRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZGVwcmVjYXRlO1xuXG4vKipcbiAqIE1hcmsgdGhhdCBhIG1ldGhvZCBzaG91bGQgbm90IGJlIHVzZWQuXG4gKiBSZXR1cm5zIGEgbW9kaWZpZWQgZnVuY3Rpb24gd2hpY2ggd2FybnMgb25jZSBieSBkZWZhdWx0LlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2Uubm9EZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBpdCBpcyBhIG5vLW9wLlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2UudGhyb3dEZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBkZXByZWNhdGVkIGZ1bmN0aW9uc1xuICogd2lsbCB0aHJvdyBhbiBFcnJvciB3aGVuIGludm9rZWQuXG4gKlxuICogSWYgYGxvY2FsU3RvcmFnZS50cmFjZURlcHJlY2F0aW9uID0gdHJ1ZWAgaXMgc2V0LCB0aGVuIGRlcHJlY2F0ZWQgZnVuY3Rpb25zXG4gKiB3aWxsIGludm9rZSBgY29uc29sZS50cmFjZSgpYCBpbnN0ZWFkIG9mIGBjb25zb2xlLmVycm9yKClgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIC0gdGhlIGZ1bmN0aW9uIHRvIGRlcHJlY2F0ZVxuICogQHBhcmFtIHtTdHJpbmd9IG1zZyAtIHRoZSBzdHJpbmcgdG8gcHJpbnQgdG8gdGhlIGNvbnNvbGUgd2hlbiBgZm5gIGlzIGludm9rZWRcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gYSBuZXcgXCJkZXByZWNhdGVkXCIgdmVyc2lvbiBvZiBgZm5gXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIGRlcHJlY2F0ZSAoZm4sIG1zZykge1xuICBpZiAoY29uZmlnKCdub0RlcHJlY2F0aW9uJykpIHtcbiAgICByZXR1cm4gZm47XG4gIH1cblxuICB2YXIgd2FybmVkID0gZmFsc2U7XG4gIGZ1bmN0aW9uIGRlcHJlY2F0ZWQoKSB7XG4gICAgaWYgKCF3YXJuZWQpIHtcbiAgICAgIGlmIChjb25maWcoJ3Rocm93RGVwcmVjYXRpb24nKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICAgIH0gZWxzZSBpZiAoY29uZmlnKCd0cmFjZURlcHJlY2F0aW9uJykpIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKG1zZyk7XG4gICAgICB9XG4gICAgICB3YXJuZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIHJldHVybiBkZXByZWNhdGVkO1xufVxuXG4vKipcbiAqIENoZWNrcyBgbG9jYWxTdG9yYWdlYCBmb3IgYm9vbGVhbiB2YWx1ZXMgZm9yIHRoZSBnaXZlbiBgbmFtZWAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm5zIHtCb29sZWFufVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gY29uZmlnIChuYW1lKSB7XG4gIC8vIGFjY2Vzc2luZyBnbG9iYWwubG9jYWxTdG9yYWdlIGNhbiB0cmlnZ2VyIGEgRE9NRXhjZXB0aW9uIGluIHNhbmRib3hlZCBpZnJhbWVzXG4gIHRyeSB7XG4gICAgaWYgKCFnbG9iYWwubG9jYWxTdG9yYWdlKSByZXR1cm4gZmFsc2U7XG4gIH0gY2F0Y2ggKF8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHZhbCA9IGdsb2JhbC5sb2NhbFN0b3JhZ2VbbmFtZV07XG4gIGlmIChudWxsID09IHZhbCkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gU3RyaW5nKHZhbCkudG9Mb3dlckNhc2UoKSA9PT0gJ3RydWUnO1xufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbmV4cG9ydHMuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcbmV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheVxuZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gZnJvbUJ5dGVBcnJheVxuXG52YXIgbG9va3VwID0gW11cbnZhciByZXZMb29rdXAgPSBbXVxudmFyIEFyciA9IHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyA/IFVpbnQ4QXJyYXkgOiBBcnJheVxuXG52YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgbG9va3VwW2ldID0gY29kZVtpXVxuICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbn1cblxuLy8gU3VwcG9ydCBkZWNvZGluZyBVUkwtc2FmZSBiYXNlNjQgc3RyaW5ncywgYXMgTm9kZS5qcyBkb2VzLlxuLy8gU2VlOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CYXNlNjQjVVJMX2FwcGxpY2F0aW9uc1xucmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG5yZXZMb29rdXBbJ18nLmNoYXJDb2RlQXQoMCldID0gNjNcblxuZnVuY3Rpb24gZ2V0TGVucyAoYjY0KSB7XG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIFRyaW0gb2ZmIGV4dHJhIGJ5dGVzIGFmdGVyIHBsYWNlaG9sZGVyIGJ5dGVzIGFyZSBmb3VuZFxuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iZWF0Z2FtbWl0L2Jhc2U2NC1qcy9pc3N1ZXMvNDJcbiAgdmFyIHZhbGlkTGVuID0gYjY0LmluZGV4T2YoJz0nKVxuICBpZiAodmFsaWRMZW4gPT09IC0xKSB2YWxpZExlbiA9IGxlblxuXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSB2YWxpZExlbiA9PT0gbGVuXG4gICAgPyAwXG4gICAgOiA0IC0gKHZhbGlkTGVuICUgNClcblxuICByZXR1cm4gW3ZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW5dXG59XG5cbi8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoYjY0KSB7XG4gIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpXG4gIHZhciB2YWxpZExlbiA9IGxlbnNbMF1cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IGxlbnNbMV1cbiAgcmV0dXJuICgodmFsaWRMZW4gKyBwbGFjZUhvbGRlcnNMZW4pICogMyAvIDQpIC0gcGxhY2VIb2xkZXJzTGVuXG59XG5cbmZ1bmN0aW9uIF9ieXRlTGVuZ3RoIChiNjQsIHZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW4pIHtcbiAgcmV0dXJuICgodmFsaWRMZW4gKyBwbGFjZUhvbGRlcnNMZW4pICogMyAvIDQpIC0gcGxhY2VIb2xkZXJzTGVuXG59XG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVucyA9IGdldExlbnMoYjY0KVxuICB2YXIgdmFsaWRMZW4gPSBsZW5zWzBdXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSBsZW5zWzFdXG5cbiAgdmFyIGFyciA9IG5ldyBBcnIoX2J5dGVMZW5ndGgoYjY0LCB2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuKSlcblxuICB2YXIgY3VyQnl0ZSA9IDBcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIHZhciBsZW4gPSBwbGFjZUhvbGRlcnNMZW4gPiAwXG4gICAgPyB2YWxpZExlbiAtIDRcbiAgICA6IHZhbGlkTGVuXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxOCkgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDEyKSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPDwgNikgfFxuICAgICAgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAzKV1cbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gMTYpICYgMHhGRlxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDIpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMikgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldID4+IDQpXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICBpZiAocGxhY2VIb2xkZXJzTGVuID09PSAxKSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDEwKSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgNCkgfFxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildID4+IDIpXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuICByZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICtcbiAgICBsb29rdXBbbnVtID4+IDEyICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICtcbiAgICBsb29rdXBbbnVtICYgMHgzRl1cbn1cblxuZnVuY3Rpb24gZW5jb2RlQ2h1bmsgKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gIHZhciB0bXBcbiAgdmFyIG91dHB1dCA9IFtdXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAzKSB7XG4gICAgdG1wID1cbiAgICAgICgodWludDhbaV0gPDwgMTYpICYgMHhGRjAwMDApICtcbiAgICAgICgodWludDhbaSArIDFdIDw8IDgpICYgMHhGRjAwKSArXG4gICAgICAodWludDhbaSArIDJdICYgMHhGRilcbiAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSlcbiAgfVxuICByZXR1cm4gb3V0cHV0LmpvaW4oJycpXG59XG5cbmZ1bmN0aW9uIGZyb21CeXRlQXJyYXkgKHVpbnQ4KSB7XG4gIHZhciB0bXBcbiAgdmFyIGxlbiA9IHVpbnQ4Lmxlbmd0aFxuICB2YXIgZXh0cmFCeXRlcyA9IGxlbiAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgdmFyIHBhcnRzID0gW11cbiAgdmFyIG1heENodW5rTGVuZ3RoID0gMTYzODMgLy8gbXVzdCBiZSBtdWx0aXBsZSBvZiAzXG5cbiAgLy8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuICBmb3IgKHZhciBpID0gMCwgbGVuMiA9IGxlbiAtIGV4dHJhQnl0ZXM7IGkgPCBsZW4yOyBpICs9IG1heENodW5rTGVuZ3RoKSB7XG4gICAgcGFydHMucHVzaChlbmNvZGVDaHVuayhcbiAgICAgIHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aClcbiAgICApKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgcGFydHMucHVzaChcbiAgICAgIGxvb2t1cFt0bXAgPj4gMl0gK1xuICAgICAgbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXSArXG4gICAgICAnPT0nXG4gICAgKVxuICB9IGVsc2UgaWYgKGV4dHJhQnl0ZXMgPT09IDIpIHtcbiAgICB0bXAgPSAodWludDhbbGVuIC0gMl0gPDwgOCkgKyB1aW50OFtsZW4gLSAxXVxuICAgIHBhcnRzLnB1c2goXG4gICAgICBsb29rdXBbdG1wID4+IDEwXSArXG4gICAgICBsb29rdXBbKHRtcCA+PiA0KSAmIDB4M0ZdICtcbiAgICAgIGxvb2t1cFsodG1wIDw8IDIpICYgMHgzRl0gK1xuICAgICAgJz0nXG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcblxudmFyIEtfTUFYX0xFTkdUSCA9IDB4N2ZmZmZmZmZcbmV4cG9ydHMua01heExlbmd0aCA9IEtfTUFYX0xFTkdUSFxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBQcmludCB3YXJuaW5nIGFuZCByZWNvbW1lbmQgdXNpbmcgYGJ1ZmZlcmAgdjQueCB3aGljaCBoYXMgYW4gT2JqZWN0XG4gKiAgICAgICAgICAgICAgIGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBXZSByZXBvcnQgdGhhdCB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBpZiB0aGUgYXJlIG5vdCBzdWJjbGFzc2FibGVcbiAqIHVzaW5nIF9fcHJvdG9fXy4gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWBcbiAqIChTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOCkuIElFIDEwIGxhY2tzIHN1cHBvcnRcbiAqIGZvciBfX3Byb3RvX18gYW5kIGhhcyBhIGJ1Z2d5IHR5cGVkIGFycmF5IGltcGxlbWVudGF0aW9uLlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiB0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuICBjb25zb2xlLmVycm9yKFxuICAgICdUaGlzIGJyb3dzZXIgbGFja3MgdHlwZWQgYXJyYXkgKFVpbnQ4QXJyYXkpIHN1cHBvcnQgd2hpY2ggaXMgcmVxdWlyZWQgYnkgJyArXG4gICAgJ2BidWZmZXJgIHY1LnguIFVzZSBgYnVmZmVyYCB2NC54IGlmIHlvdSByZXF1aXJlIG9sZCBicm93c2VyIHN1cHBvcnQuJ1xuICApXG59XG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgLy8gQ2FuIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkP1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5fX3Byb3RvX18gPSB7IF9fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsIGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfSB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDJcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIucHJvdG90eXBlLCAncGFyZW50Jywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0aGlzKSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHJldHVybiB0aGlzLmJ1ZmZlclxuICB9XG59KVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLnByb3RvdHlwZSwgJ29mZnNldCcsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGhpcykpIHJldHVybiB1bmRlZmluZWRcbiAgICByZXR1cm4gdGhpcy5ieXRlT2Zmc2V0XG4gIH1cbn0pXG5cbmZ1bmN0aW9uIGNyZWF0ZUJ1ZmZlciAobGVuZ3RoKSB7XG4gIGlmIChsZW5ndGggPiBLX01BWF9MRU5HVEgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVGhlIHZhbHVlIFwiJyArIGxlbmd0aCArICdcIiBpcyBpbnZhbGlkIGZvciBvcHRpb24gXCJzaXplXCInKVxuICB9XG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIHZhciBidWYgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gIGJ1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBidWZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuXG5mdW5jdGlvbiBCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodHlwZW9mIGVuY29kaW5nT3JPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAnVGhlIFwic3RyaW5nXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4gUmVjZWl2ZWQgdHlwZSBudW1iZXInXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiBhbGxvY1Vuc2FmZShhcmcpXG4gIH1cbiAgcmV0dXJuIGZyb20oYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG5pZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgIT0gbnVsbCAmJlxuICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLCBTeW1ib2wuc3BlY2llcywge1xuICAgIHZhbHVlOiBudWxsLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICB3cml0YWJsZTogZmFsc2VcbiAgfSlcbn1cblxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbmZ1bmN0aW9uIGZyb20gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUxpa2UodmFsdWUpXG4gIH1cblxuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHRocm93IFR5cGVFcnJvcihcbiAgICAgICdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCAnICtcbiAgICAgICdvciBBcnJheS1saWtlIE9iamVjdC4gUmVjZWl2ZWQgdHlwZSAnICsgKHR5cGVvZiB2YWx1ZSlcbiAgICApXG4gIH1cblxuICBpZiAoaXNJbnN0YW5jZSh2YWx1ZSwgQXJyYXlCdWZmZXIpIHx8XG4gICAgICAodmFsdWUgJiYgaXNJbnN0YW5jZSh2YWx1ZS5idWZmZXIsIEFycmF5QnVmZmVyKSkpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAnVGhlIFwidmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBvZiB0eXBlIG51bWJlci4gUmVjZWl2ZWQgdHlwZSBudW1iZXInXG4gICAgKVxuICB9XG5cbiAgdmFyIHZhbHVlT2YgPSB2YWx1ZS52YWx1ZU9mICYmIHZhbHVlLnZhbHVlT2YoKVxuICBpZiAodmFsdWVPZiAhPSBudWxsICYmIHZhbHVlT2YgIT09IHZhbHVlKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHZhbHVlT2YsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIHZhciBiID0gZnJvbU9iamVjdCh2YWx1ZSlcbiAgaWYgKGIpIHJldHVybiBiXG5cbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1ByaW1pdGl2ZSAhPSBudWxsICYmXG4gICAgICB0eXBlb2YgdmFsdWVbU3ltYm9sLnRvUHJpbWl0aXZlXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBCdWZmZXIuZnJvbShcbiAgICAgIHZhbHVlW1N5bWJvbC50b1ByaW1pdGl2ZV0oJ3N0cmluZycpLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGhcbiAgICApXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCAnICtcbiAgICAnb3IgQXJyYXktbGlrZSBPYmplY3QuIFJlY2VpdmVkIHR5cGUgJyArICh0eXBlb2YgdmFsdWUpXG4gIClcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbSh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBOb3RlOiBDaGFuZ2UgcHJvdG90eXBlICphZnRlciogQnVmZmVyLmZyb20gaXMgZGVmaW5lZCB0byB3b3JrYXJvdW5kIENocm9tZSBidWc6XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzE0OFxuQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVGhlIHZhbHVlIFwiJyArIHNpemUgKyAnXCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwic2l6ZVwiJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAoc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXR0ZWQgYXMgYSBzdGFydCBvZmZzZXQuXG4gICAgcmV0dXJuIHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZydcbiAgICAgID8gY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbCwgZW5jb2RpbmcpXG4gICAgICA6IGNyZWF0ZUJ1ZmZlcihzaXplKS5maWxsKGZpbGwpXG4gIH1cbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqIGFsbG9jKHNpemVbLCBmaWxsWywgZW5jb2RpbmddXSlcbiAqKi9cbkJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICByZXR1cm4gYWxsb2Moc2l6ZSwgZmlsbCwgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGFsbG9jVW5zYWZlIChzaXplKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplIDwgMCA/IDAgOiBjaGVja2VkKHNpemUpIHwgMClcbn1cblxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIEJ1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIFNsb3dCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlU2xvdyA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgfVxuXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbmd0aClcblxuICB2YXIgYWN0dWFsID0gYnVmLndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG5cbiAgaWYgKGFjdHVhbCAhPT0gbGVuZ3RoKSB7XG4gICAgLy8gV3JpdGluZyBhIGhleCBzdHJpbmcsIGZvciBleGFtcGxlLCB0aGF0IGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVycyB3aWxsXG4gICAgLy8gY2F1c2UgZXZlcnl0aGluZyBhZnRlciB0aGUgZmlyc3QgaW52YWxpZCBjaGFyYWN0ZXIgdG8gYmUgaWdub3JlZC4gKGUuZy5cbiAgICAvLyAnYWJ4eGNkJyB3aWxsIGJlIHRyZWF0ZWQgYXMgJ2FiJylcbiAgICBidWYgPSBidWYuc2xpY2UoMCwgYWN0dWFsKVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlIChhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgYnVmW2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoYnl0ZU9mZnNldCA8IDAgfHwgYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJvZmZzZXRcIiBpcyBvdXRzaWRlIG9mIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0ICsgKGxlbmd0aCB8fCAwKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcImxlbmd0aFwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICB2YXIgYnVmXG4gIGlmIChieXRlT2Zmc2V0ID09PSB1bmRlZmluZWQgJiYgbGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBidWYgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICBidWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKG9iaikge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICB2YXIgbGVuID0gY2hlY2tlZChvYmoubGVuZ3RoKSB8IDBcbiAgICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbilcblxuICAgIGlmIChidWYubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gYnVmXG4gICAgfVxuXG4gICAgb2JqLmNvcHkoYnVmLCAwLCAwLCBsZW4pXG4gICAgcmV0dXJuIGJ1ZlxuICB9XG5cbiAgaWYgKG9iai5sZW5ndGggIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICh0eXBlb2Ygb2JqLmxlbmd0aCAhPT0gJ251bWJlcicgfHwgbnVtYmVySXNOYU4ob2JqLmxlbmd0aCkpIHtcbiAgICAgIHJldHVybiBjcmVhdGVCdWZmZXIoMClcbiAgICB9XG4gICAgcmV0dXJuIGZyb21BcnJheUxpa2Uob2JqKVxuICB9XG5cbiAgaWYgKG9iai50eXBlID09PSAnQnVmZmVyJyAmJiBBcnJheS5pc0FycmF5KG9iai5kYXRhKSkge1xuICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKG9iai5kYXRhKVxuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBLX01BWF9MRU5HVEhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0gS19NQVhfTEVOR1RIKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIEtfTUFYX0xFTkdUSC50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKCtsZW5ndGggIT0gbGVuZ3RoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG4gICAgbGVuZ3RoID0gMFxuICB9XG4gIHJldHVybiBCdWZmZXIuYWxsb2MoK2xlbmd0aClcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuIGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlciA9PT0gdHJ1ZSAmJlxuICAgIGIgIT09IEJ1ZmZlci5wcm90b3R5cGUgLy8gc28gQnVmZmVyLmlzQnVmZmVyKEJ1ZmZlci5wcm90b3R5cGUpIHdpbGwgYmUgZmFsc2Vcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmIChpc0luc3RhbmNlKGEsIFVpbnQ4QXJyYXkpKSBhID0gQnVmZmVyLmZyb20oYSwgYS5vZmZzZXQsIGEuYnl0ZUxlbmd0aClcbiAgaWYgKGlzSW5zdGFuY2UoYiwgVWludDhBcnJheSkpIGIgPSBCdWZmZXIuZnJvbShiLCBiLm9mZnNldCwgYi5ieXRlTGVuZ3RoKVxuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICdUaGUgXCJidWYxXCIsIFwiYnVmMlwiIGFyZ3VtZW50cyBtdXN0IGJlIG9uZSBvZiB0eXBlIEJ1ZmZlciBvciBVaW50OEFycmF5J1xuICAgIClcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHggPSBhW2ldXG4gICAgICB5ID0gYltpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnbGF0aW4xJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkobGlzdCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5hbGxvYygwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgYnVmID0gbGlzdFtpXVxuICAgIGlmIChpc0luc3RhbmNlKGJ1ZiwgVWludDhBcnJheSkpIHtcbiAgICAgIGJ1ZiA9IEJ1ZmZlci5mcm9tKGJ1ZilcbiAgICB9XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9XG4gICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgcG9zICs9IGJ1Zi5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmZmVyXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5sZW5ndGhcbiAgfVxuICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHN0cmluZykgfHwgaXNJbnN0YW5jZShzdHJpbmcsIEFycmF5QnVmZmVyKSkge1xuICAgIHJldHVybiBzdHJpbmcuYnl0ZUxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAnVGhlIFwic3RyaW5nXCIgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgb3IgQXJyYXlCdWZmZXIuICcgK1xuICAgICAgJ1JlY2VpdmVkIHR5cGUgJyArIHR5cGVvZiBzdHJpbmdcbiAgICApXG4gIH1cblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbXVzdE1hdGNoID0gKGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSA9PT0gdHJ1ZSlcbiAgaWYgKCFtdXN0TWF0Y2ggJiYgbGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB7XG4gICAgICAgICAgcmV0dXJuIG11c3RNYXRjaCA/IC0xIDogdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgfVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICAvLyBObyBuZWVkIHRvIHZlcmlmeSB0aGF0IFwidGhpcy5sZW5ndGggPD0gTUFYX1VJTlQzMlwiIHNpbmNlIGl0J3MgYSByZWFkLW9ubHlcbiAgLy8gcHJvcGVydHkgb2YgYSB0eXBlZCBhcnJheS5cblxuICAvLyBUaGlzIGJlaGF2ZXMgbmVpdGhlciBsaWtlIFN0cmluZyBub3IgVWludDhBcnJheSBpbiB0aGF0IHdlIHNldCBzdGFydC9lbmRcbiAgLy8gdG8gdGhlaXIgdXBwZXIvbG93ZXIgYm91bmRzIGlmIHRoZSB2YWx1ZSBwYXNzZWQgaXMgb3V0IG9mIHJhbmdlLlxuICAvLyB1bmRlZmluZWQgaXMgaGFuZGxlZCBzcGVjaWFsbHkgYXMgcGVyIEVDTUEtMjYyIDZ0aCBFZGl0aW9uLFxuICAvLyBTZWN0aW9uIDEzLjMuMy43IFJ1bnRpbWUgU2VtYW50aWNzOiBLZXllZEJpbmRpbmdJbml0aWFsaXphdGlvbi5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQgfHwgc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgLy8gUmV0dXJuIGVhcmx5IGlmIHN0YXJ0ID4gdGhpcy5sZW5ndGguIERvbmUgaGVyZSB0byBwcmV2ZW50IHBvdGVudGlhbCB1aW50MzJcbiAgLy8gY29lcmNpb24gZmFpbCBiZWxvdy5cbiAgaWYgKHN0YXJ0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoZW5kIDw9IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIC8vIEZvcmNlIGNvZXJzaW9uIHRvIHVpbnQzMi4gVGhpcyB3aWxsIGFsc28gY29lcmNlIGZhbHNleS9OYU4gdmFsdWVzIHRvIDAuXG4gIGVuZCA+Pj49IDBcbiAgc3RhcnQgPj4+PSAwXG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoaXMgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCAoYW5kIHRoZSBgaXMtYnVmZmVyYCBucG0gcGFja2FnZSlcbi8vIHRvIGRldGVjdCBhIEJ1ZmZlciBpbnN0YW5jZS4gSXQncyBub3QgcG9zc2libGUgdG8gdXNlIGBpbnN0YW5jZW9mIEJ1ZmZlcmBcbi8vIHJlbGlhYmx5IGluIGEgYnJvd3NlcmlmeSBjb250ZXh0IGJlY2F1c2UgdGhlcmUgY291bGQgYmUgbXVsdGlwbGUgZGlmZmVyZW50XG4vLyBjb3BpZXMgb2YgdGhlICdidWZmZXInIHBhY2thZ2UgaW4gdXNlLiBUaGlzIG1ldGhvZCB3b3JrcyBldmVuIGZvciBCdWZmZXJcbi8vIGluc3RhbmNlcyB0aGF0IHdlcmUgY3JlYXRlZCBmcm9tIGFub3RoZXIgY29weSBvZiB0aGUgYGJ1ZmZlcmAgcGFja2FnZS5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvaXNzdWVzLzE1NFxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbmZ1bmN0aW9uIHN3YXAgKGIsIG4sIG0pIHtcbiAgdmFyIGkgPSBiW25dXG4gIGJbbl0gPSBiW21dXG4gIGJbbV0gPSBpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDE2ID0gZnVuY3Rpb24gc3dhcDE2ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSAyICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAxNi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAzMiA9IGZ1bmN0aW9uIHN3YXAzMiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMzItYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDMpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDIpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwNjQgPSBmdW5jdGlvbiBzd2FwNjQgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDggIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDY0LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDgpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyA3KVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyA2KVxuICAgIHN3YXAodGhpcywgaSArIDIsIGkgKyA1KVxuICAgIHN3YXAodGhpcywgaSArIDMsIGkgKyA0KVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0xvY2FsZVN0cmluZyA9IEJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmdcblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5yZXBsYWNlKC8oLnsyfSkvZywgJyQxICcpLnRyaW0oKVxuICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKHRhcmdldCwgc3RhcnQsIGVuZCwgdGhpc1N0YXJ0LCB0aGlzRW5kKSB7XG4gIGlmIChpc0luc3RhbmNlKHRhcmdldCwgVWludDhBcnJheSkpIHtcbiAgICB0YXJnZXQgPSBCdWZmZXIuZnJvbSh0YXJnZXQsIHRhcmdldC5vZmZzZXQsIHRhcmdldC5ieXRlTGVuZ3RoKVxuICB9XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgJ1RoZSBcInRhcmdldFwiIGFyZ3VtZW50IG11c3QgYmUgb25lIG9mIHR5cGUgQnVmZmVyIG9yIFVpbnQ4QXJyYXkuICcgK1xuICAgICAgJ1JlY2VpdmVkIHR5cGUgJyArICh0eXBlb2YgdGFyZ2V0KVxuICAgIClcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5kID0gdGFyZ2V0ID8gdGFyZ2V0Lmxlbmd0aCA6IDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzU3RhcnQgPSAwXG4gIH1cbiAgaWYgKHRoaXNFbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNFbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBlbmQgPiB0YXJnZXQubGVuZ3RoIHx8IHRoaXNTdGFydCA8IDAgfHwgdGhpc0VuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ291dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQgJiYgc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuXG4gIHN0YXJ0ID4+Pj0gMFxuICBlbmQgPj4+PSAwXG4gIHRoaXNTdGFydCA+Pj49IDBcbiAgdGhpc0VuZCA+Pj49IDBcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0KSByZXR1cm4gMFxuXG4gIHZhciB4ID0gdGhpc0VuZCAtIHRoaXNTdGFydFxuICB2YXIgeSA9IGVuZCAtIHN0YXJ0XG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuXG4gIHZhciB0aGlzQ29weSA9IHRoaXMuc2xpY2UodGhpc1N0YXJ0LCB0aGlzRW5kKVxuICB2YXIgdGFyZ2V0Q29weSA9IHRhcmdldC5zbGljZShzdGFydCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAodGhpc0NvcHlbaV0gIT09IHRhcmdldENvcHlbaV0pIHtcbiAgICAgIHggPSB0aGlzQ29weVtpXVxuICAgICAgeSA9IHRhcmdldENvcHlbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG4vLyBGaW5kcyBlaXRoZXIgdGhlIGZpcnN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA+PSBgYnl0ZU9mZnNldGAsXG4vLyBPUiB0aGUgbGFzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPD0gYGJ5dGVPZmZzZXRgLlxuLy9cbi8vIEFyZ3VtZW50czpcbi8vIC0gYnVmZmVyIC0gYSBCdWZmZXIgdG8gc2VhcmNoXG4vLyAtIHZhbCAtIGEgc3RyaW5nLCBCdWZmZXIsIG9yIG51bWJlclxuLy8gLSBieXRlT2Zmc2V0IC0gYW4gaW5kZXggaW50byBgYnVmZmVyYDsgd2lsbCBiZSBjbGFtcGVkIHRvIGFuIGludDMyXG4vLyAtIGVuY29kaW5nIC0gYW4gb3B0aW9uYWwgZW5jb2RpbmcsIHJlbGV2YW50IGlzIHZhbCBpcyBhIHN0cmluZ1xuLy8gLSBkaXIgLSB0cnVlIGZvciBpbmRleE9mLCBmYWxzZSBmb3IgbGFzdEluZGV4T2ZcbmZ1bmN0aW9uIGJpZGlyZWN0aW9uYWxJbmRleE9mIChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICAvLyBFbXB0eSBidWZmZXIgbWVhbnMgbm8gbWF0Y2hcbiAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHJldHVybiAtMVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0XG4gIGlmICh0eXBlb2YgYnl0ZU9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGJ5dGVPZmZzZXRcbiAgICBieXRlT2Zmc2V0ID0gMFxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSB7XG4gICAgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIHtcbiAgICBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgfVxuICBieXRlT2Zmc2V0ID0gK2J5dGVPZmZzZXQgLy8gQ29lcmNlIHRvIE51bWJlci5cbiAgaWYgKG51bWJlcklzTmFOKGJ5dGVPZmZzZXQpKSB7XG4gICAgLy8gYnl0ZU9mZnNldDogaXQgaXQncyB1bmRlZmluZWQsIG51bGwsIE5hTiwgXCJmb29cIiwgZXRjLCBzZWFyY2ggd2hvbGUgYnVmZmVyXG4gICAgYnl0ZU9mZnNldCA9IGRpciA/IDAgOiAoYnVmZmVyLmxlbmd0aCAtIDEpXG4gIH1cblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldDogbmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldFxuICBpZiAoYnl0ZU9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgaWYgKGRpcikgcmV0dXJuIC0xXG4gICAgZWxzZSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIDFcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgMCkge1xuICAgIGlmIChkaXIpIGJ5dGVPZmZzZXQgPSAwXG4gICAgZWxzZSByZXR1cm4gLTFcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSB2YWxcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIC8vIEZpbmFsbHksIHNlYXJjaCBlaXRoZXIgaW5kZXhPZiAoaWYgZGlyIGlzIHRydWUpIG9yIGxhc3RJbmRleE9mXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIC8vIFNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nL2J1ZmZlciBhbHdheXMgZmFpbHNcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAweEZGIC8vIFNlYXJjaCBmb3IgYSBieXRlIHZhbHVlIFswLTI1NV1cbiAgICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgWyB2YWwgXSwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgdmFyIGluZGV4U2l6ZSA9IDFcbiAgdmFyIGFyckxlbmd0aCA9IGFyci5sZW5ndGhcbiAgdmFyIHZhbExlbmd0aCA9IHZhbC5sZW5ndGhcblxuICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKGVuY29kaW5nID09PSAndWNzMicgfHwgZW5jb2RpbmcgPT09ICd1Y3MtMicgfHxcbiAgICAgICAgZW5jb2RpbmcgPT09ICd1dGYxNmxlJyB8fCBlbmNvZGluZyA9PT0gJ3V0Zi0xNmxlJykge1xuICAgICAgaWYgKGFyci5sZW5ndGggPCAyIHx8IHZhbC5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiAtMVxuICAgICAgfVxuICAgICAgaW5kZXhTaXplID0gMlxuICAgICAgYXJyTGVuZ3RoIC89IDJcbiAgICAgIHZhbExlbmd0aCAvPSAyXG4gICAgICBieXRlT2Zmc2V0IC89IDJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChidWYsIGkpIHtcbiAgICBpZiAoaW5kZXhTaXplID09PSAxKSB7XG4gICAgICByZXR1cm4gYnVmW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBidWYucmVhZFVJbnQxNkJFKGkgKiBpbmRleFNpemUpXG4gICAgfVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGRpcikge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpIDwgYXJyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChyZWFkKGFyciwgaSkgPT09IHJlYWQodmFsLCBmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleCkpIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWxMZW5ndGgpIHJldHVybiBmb3VuZEluZGV4ICogaW5kZXhTaXplXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChieXRlT2Zmc2V0ICsgdmFsTGVuZ3RoID4gYXJyTGVuZ3RoKSBieXRlT2Zmc2V0ID0gYXJyTGVuZ3RoIC0gdmFsTGVuZ3RoXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBmb3VuZCA9IHRydWVcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHJlYWQoYXJyLCBpICsgaikgIT09IHJlYWQodmFsLCBqKSkge1xuICAgICAgICAgIGZvdW5kID0gZmFsc2VcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZm91bmQpIHJldHVybiBpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5jbHVkZXMgPSBmdW5jdGlvbiBpbmNsdWRlcyAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gdGhpcy5pbmRleE9mKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpICE9PSAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCB0cnVlKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmxhc3RJbmRleE9mID0gZnVuY3Rpb24gbGFzdEluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGZhbHNlKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKG51bWJlcklzTmFOKHBhcnNlZCkpIHJldHVybiBpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBsYXRpbjFXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoID4+PiAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBsYXRpbjFTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgKGJ5dGVzW2kgKyAxXSAqIDI1NikpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImJ1ZmZlclwiIGFyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCAoOCAqIGJ5dGVMZW5ndGgpIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSAtIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgKyAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2FyZ3VtZW50IHNob3VsZCBiZSBhIEJ1ZmZlcicpXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5jb3B5V2l0aGluID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gVXNlIGJ1aWx0LWluIHdoZW4gYXZhaWxhYmxlLCBtaXNzaW5nIGZyb20gSUUxMVxuICAgIHRoaXMuY29weVdpdGhpbih0YXJnZXRTdGFydCwgc3RhcnQsIGVuZClcbiAgfSBlbHNlIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAodmFyIGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKChlbmNvZGluZyA9PT0gJ3V0ZjgnICYmIGNvZGUgPCAxMjgpIHx8XG4gICAgICAgICAgZW5jb2RpbmcgPT09ICdsYXRpbjEnKSB7XG4gICAgICAgIC8vIEZhc3QgcGF0aDogSWYgYHZhbGAgZml0cyBpbnRvIGEgc2luZ2xlIGJ5dGUsIHVzZSB0aGF0IG51bWVyaWMgdmFsdWUuXG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfVxuXG4gIC8vIEludmFsaWQgcmFuZ2VzIGFyZSBub3Qgc2V0IHRvIGEgZGVmYXVsdCwgc28gY2FuIHJhbmdlIGNoZWNrIGVhcmx5LlxuICBpZiAoc3RhcnQgPCAwIHx8IHRoaXMubGVuZ3RoIDwgc3RhcnQgfHwgdGhpcy5sZW5ndGggPCBlbmQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCF2YWwpIHZhbCA9IDBcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICB0aGlzW2ldID0gdmFsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5pc0J1ZmZlcih2YWwpXG4gICAgICA/IHZhbFxuICAgICAgOiBCdWZmZXIuZnJvbSh2YWwsIGVuY29kaW5nKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBpZiAobGVuID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgdmFsdWUgXCInICsgdmFsICtcbiAgICAgICAgJ1wiIGlzIGludmFsaWQgZm9yIGFyZ3VtZW50IFwidmFsdWVcIicpXG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBlbmQgLSBzdGFydDsgKytpKSB7XG4gICAgICB0aGlzW2kgKyBzdGFydF0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teKy8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgdGFrZXMgZXF1YWwgc2lnbnMgYXMgZW5kIG9mIHRoZSBCYXNlNjQgZW5jb2RpbmdcbiAgc3RyID0gc3RyLnNwbGl0KCc9JylbMF1cbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0ci50cmltKCkucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG4vLyBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IG9iamVjdHMgZnJvbSBvdGhlciBjb250ZXh0cyAoaS5lLiBpZnJhbWVzKSBkbyBub3QgcGFzc1xuLy8gdGhlIGBpbnN0YW5jZW9mYCBjaGVjayBidXQgdGhleSBzaG91bGQgYmUgdHJlYXRlZCBhcyBvZiB0aGF0IHR5cGUuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL2lzc3Vlcy8xNjZcbmZ1bmN0aW9uIGlzSW5zdGFuY2UgKG9iaiwgdHlwZSkge1xuICByZXR1cm4gb2JqIGluc3RhbmNlb2YgdHlwZSB8fFxuICAgIChvYmogIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IgIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IubmFtZSAhPSBudWxsICYmXG4gICAgICBvYmouY29uc3RydWN0b3IubmFtZSA9PT0gdHlwZS5uYW1lKVxufVxuZnVuY3Rpb24gbnVtYmVySXNOYU4gKG9iaikge1xuICAvLyBGb3IgSUUxMSBzdXBwb3J0XG4gIHJldHVybiBvYmogIT09IG9iaiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXNlbGYtY29tcGFyZVxufVxuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBvYmplY3RDcmVhdGUgPSBPYmplY3QuY3JlYXRlIHx8IG9iamVjdENyZWF0ZVBvbHlmaWxsXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IG9iamVjdEtleXNQb2x5ZmlsbFxudmFyIGJpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYmluZCB8fCBmdW5jdGlvbkJpbmRQb2x5ZmlsbFxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcywgJ19ldmVudHMnKSkge1xuICAgIHRoaXMuX2V2ZW50cyA9IG9iamVjdENyZWF0ZShudWxsKTtcbiAgICB0aGlzLl9ldmVudHNDb3VudCA9IDA7XG4gIH1cblxuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG52YXIgZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG52YXIgaGFzRGVmaW5lUHJvcGVydHk7XG50cnkge1xuICB2YXIgbyA9IHt9O1xuICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgJ3gnLCB7IHZhbHVlOiAwIH0pO1xuICBoYXNEZWZpbmVQcm9wZXJ0eSA9IG8ueCA9PT0gMDtcbn0gY2F0Y2ggKGVycikgeyBoYXNEZWZpbmVQcm9wZXJ0eSA9IGZhbHNlIH1cbmlmIChoYXNEZWZpbmVQcm9wZXJ0eSkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRXZlbnRFbWl0dGVyLCAnZGVmYXVsdE1heExpc3RlbmVycycsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24oYXJnKSB7XG4gICAgICAvLyBjaGVjayB3aGV0aGVyIHRoZSBpbnB1dCBpcyBhIHBvc2l0aXZlIG51bWJlciAod2hvc2UgdmFsdWUgaXMgemVybyBvclxuICAgICAgLy8gZ3JlYXRlciBhbmQgbm90IGEgTmFOKS5cbiAgICAgIGlmICh0eXBlb2YgYXJnICE9PSAnbnVtYmVyJyB8fCBhcmcgPCAwIHx8IGFyZyAhPT0gYXJnKVxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImRlZmF1bHRNYXhMaXN0ZW5lcnNcIiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gICAgICBkZWZhdWx0TWF4TGlzdGVuZXJzID0gYXJnO1xuICAgIH1cbiAgfSk7XG59IGVsc2Uge1xuICBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XG59XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uIHNldE1heExpc3RlbmVycyhuKSB7XG4gIGlmICh0eXBlb2YgbiAhPT0gJ251bWJlcicgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJuXCIgYXJndW1lbnQgbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbmZ1bmN0aW9uICRnZXRNYXhMaXN0ZW5lcnModGhhdCkge1xuICBpZiAodGhhdC5fbWF4TGlzdGVuZXJzID09PSB1bmRlZmluZWQpXG4gICAgcmV0dXJuIEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICByZXR1cm4gdGhhdC5fbWF4TGlzdGVuZXJzO1xufVxuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmdldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uIGdldE1heExpc3RlbmVycygpIHtcbiAgcmV0dXJuICRnZXRNYXhMaXN0ZW5lcnModGhpcyk7XG59O1xuXG4vLyBUaGVzZSBzdGFuZGFsb25lIGVtaXQqIGZ1bmN0aW9ucyBhcmUgdXNlZCB0byBvcHRpbWl6ZSBjYWxsaW5nIG9mIGV2ZW50XG4vLyBoYW5kbGVycyBmb3IgZmFzdCBjYXNlcyBiZWNhdXNlIGVtaXQoKSBpdHNlbGYgb2Z0ZW4gaGFzIGEgdmFyaWFibGUgbnVtYmVyIG9mXG4vLyBhcmd1bWVudHMgYW5kIGNhbiBiZSBkZW9wdGltaXplZCBiZWNhdXNlIG9mIHRoYXQuIFRoZXNlIGZ1bmN0aW9ucyBhbHdheXMgaGF2ZVxuLy8gdGhlIHNhbWUgbnVtYmVyIG9mIGFyZ3VtZW50cyBhbmQgdGh1cyBkbyBub3QgZ2V0IGRlb3B0aW1pemVkLCBzbyB0aGUgY29kZVxuLy8gaW5zaWRlIHRoZW0gY2FuIGV4ZWN1dGUgZmFzdGVyLlxuZnVuY3Rpb24gZW1pdE5vbmUoaGFuZGxlciwgaXNGbiwgc2VsZikge1xuICBpZiAoaXNGbilcbiAgICBoYW5kbGVyLmNhbGwoc2VsZik7XG4gIGVsc2Uge1xuICAgIHZhciBsZW4gPSBoYW5kbGVyLmxlbmd0aDtcbiAgICB2YXIgbGlzdGVuZXJzID0gYXJyYXlDbG9uZShoYW5kbGVyLCBsZW4pO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpXG4gICAgICBsaXN0ZW5lcnNbaV0uY2FsbChzZWxmKTtcbiAgfVxufVxuZnVuY3Rpb24gZW1pdE9uZShoYW5kbGVyLCBpc0ZuLCBzZWxmLCBhcmcxKSB7XG4gIGlmIChpc0ZuKVxuICAgIGhhbmRsZXIuY2FsbChzZWxmLCBhcmcxKTtcbiAgZWxzZSB7XG4gICAgdmFyIGxlbiA9IGhhbmRsZXIubGVuZ3RoO1xuICAgIHZhciBsaXN0ZW5lcnMgPSBhcnJheUNsb25lKGhhbmRsZXIsIGxlbik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSlcbiAgICAgIGxpc3RlbmVyc1tpXS5jYWxsKHNlbGYsIGFyZzEpO1xuICB9XG59XG5mdW5jdGlvbiBlbWl0VHdvKGhhbmRsZXIsIGlzRm4sIHNlbGYsIGFyZzEsIGFyZzIpIHtcbiAgaWYgKGlzRm4pXG4gICAgaGFuZGxlci5jYWxsKHNlbGYsIGFyZzEsIGFyZzIpO1xuICBlbHNlIHtcbiAgICB2YXIgbGVuID0gaGFuZGxlci5sZW5ndGg7XG4gICAgdmFyIGxpc3RlbmVycyA9IGFycmF5Q2xvbmUoaGFuZGxlciwgbGVuKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKVxuICAgICAgbGlzdGVuZXJzW2ldLmNhbGwoc2VsZiwgYXJnMSwgYXJnMik7XG4gIH1cbn1cbmZ1bmN0aW9uIGVtaXRUaHJlZShoYW5kbGVyLCBpc0ZuLCBzZWxmLCBhcmcxLCBhcmcyLCBhcmczKSB7XG4gIGlmIChpc0ZuKVxuICAgIGhhbmRsZXIuY2FsbChzZWxmLCBhcmcxLCBhcmcyLCBhcmczKTtcbiAgZWxzZSB7XG4gICAgdmFyIGxlbiA9IGhhbmRsZXIubGVuZ3RoO1xuICAgIHZhciBsaXN0ZW5lcnMgPSBhcnJheUNsb25lKGhhbmRsZXIsIGxlbik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSlcbiAgICAgIGxpc3RlbmVyc1tpXS5jYWxsKHNlbGYsIGFyZzEsIGFyZzIsIGFyZzMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXRNYW55KGhhbmRsZXIsIGlzRm4sIHNlbGYsIGFyZ3MpIHtcbiAgaWYgKGlzRm4pXG4gICAgaGFuZGxlci5hcHBseShzZWxmLCBhcmdzKTtcbiAgZWxzZSB7XG4gICAgdmFyIGxlbiA9IGhhbmRsZXIubGVuZ3RoO1xuICAgIHZhciBsaXN0ZW5lcnMgPSBhcnJheUNsb25lKGhhbmRsZXIsIGxlbik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSlcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseShzZWxmLCBhcmdzKTtcbiAgfVxufVxuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiBlbWl0KHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGV2ZW50cztcbiAgdmFyIGRvRXJyb3IgPSAodHlwZSA9PT0gJ2Vycm9yJyk7XG5cbiAgZXZlbnRzID0gdGhpcy5fZXZlbnRzO1xuICBpZiAoZXZlbnRzKVxuICAgIGRvRXJyb3IgPSAoZG9FcnJvciAmJiBldmVudHMuZXJyb3IgPT0gbnVsbCk7XG4gIGVsc2UgaWYgKCFkb0Vycm9yKVxuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmIChkb0Vycm9yKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKVxuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBdCBsZWFzdCBnaXZlIHNvbWUga2luZCBvZiBjb250ZXh0IHRvIHRoZSB1c2VyXG4gICAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdVbmhhbmRsZWQgXCJlcnJvclwiIGV2ZW50LiAoJyArIGVyICsgJyknKTtcbiAgICAgIGVyci5jb250ZXh0ID0gZXI7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGhhbmRsZXIgPSBldmVudHNbdHlwZV07XG5cbiAgaWYgKCFoYW5kbGVyKVxuICAgIHJldHVybiBmYWxzZTtcblxuICB2YXIgaXNGbiA9IHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nO1xuICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICBzd2l0Y2ggKGxlbikge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgIGNhc2UgMTpcbiAgICAgIGVtaXROb25lKGhhbmRsZXIsIGlzRm4sIHRoaXMpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAyOlxuICAgICAgZW1pdE9uZShoYW5kbGVyLCBpc0ZuLCB0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAzOlxuICAgICAgZW1pdFR3byhoYW5kbGVyLCBpc0ZuLCB0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDQ6XG4gICAgICBlbWl0VGhyZWUoaGFuZGxlciwgaXNGbiwgdGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0sIGFyZ3VtZW50c1szXSk7XG4gICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgIGRlZmF1bHQ6XG4gICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGVtaXRNYW55KGhhbmRsZXIsIGlzRm4sIHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5mdW5jdGlvbiBfYWRkTGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBsaXN0ZW5lciwgcHJlcGVuZCkge1xuICB2YXIgbTtcbiAgdmFyIGV2ZW50cztcbiAgdmFyIGV4aXN0aW5nO1xuXG4gIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0ZW5lclwiIGFyZ3VtZW50IG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGV2ZW50cyA9IHRhcmdldC5fZXZlbnRzO1xuICBpZiAoIWV2ZW50cykge1xuICAgIGV2ZW50cyA9IHRhcmdldC5fZXZlbnRzID0gb2JqZWN0Q3JlYXRlKG51bGwpO1xuICAgIHRhcmdldC5fZXZlbnRzQ291bnQgPSAwO1xuICB9IGVsc2Uge1xuICAgIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gICAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICAgIGlmIChldmVudHMubmV3TGlzdGVuZXIpIHtcbiAgICAgIHRhcmdldC5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgPyBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICAgICAgLy8gUmUtYXNzaWduIGBldmVudHNgIGJlY2F1c2UgYSBuZXdMaXN0ZW5lciBoYW5kbGVyIGNvdWxkIGhhdmUgY2F1c2VkIHRoZVxuICAgICAgLy8gdGhpcy5fZXZlbnRzIHRvIGJlIGFzc2lnbmVkIHRvIGEgbmV3IG9iamVjdFxuICAgICAgZXZlbnRzID0gdGFyZ2V0Ll9ldmVudHM7XG4gICAgfVxuICAgIGV4aXN0aW5nID0gZXZlbnRzW3R5cGVdO1xuICB9XG5cbiAgaWYgKCFleGlzdGluZykge1xuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIGV4aXN0aW5nID0gZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gICAgKyt0YXJnZXQuX2V2ZW50c0NvdW50O1xuICB9IGVsc2Uge1xuICAgIGlmICh0eXBlb2YgZXhpc3RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgICAgZXhpc3RpbmcgPSBldmVudHNbdHlwZV0gPVxuICAgICAgICAgIHByZXBlbmQgPyBbbGlzdGVuZXIsIGV4aXN0aW5nXSA6IFtleGlzdGluZywgbGlzdGVuZXJdO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgICBpZiAocHJlcGVuZCkge1xuICAgICAgICBleGlzdGluZy51bnNoaWZ0KGxpc3RlbmVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGV4aXN0aW5nLnB1c2gobGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gICAgaWYgKCFleGlzdGluZy53YXJuZWQpIHtcbiAgICAgIG0gPSAkZ2V0TWF4TGlzdGVuZXJzKHRhcmdldCk7XG4gICAgICBpZiAobSAmJiBtID4gMCAmJiBleGlzdGluZy5sZW5ndGggPiBtKSB7XG4gICAgICAgIGV4aXN0aW5nLndhcm5lZCA9IHRydWU7XG4gICAgICAgIHZhciB3ID0gbmV3IEVycm9yKCdQb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5IGxlYWsgZGV0ZWN0ZWQuICcgK1xuICAgICAgICAgICAgZXhpc3RpbmcubGVuZ3RoICsgJyBcIicgKyBTdHJpbmcodHlwZSkgKyAnXCIgbGlzdGVuZXJzICcgK1xuICAgICAgICAgICAgJ2FkZGVkLiBVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byAnICtcbiAgICAgICAgICAgICdpbmNyZWFzZSBsaW1pdC4nKTtcbiAgICAgICAgdy5uYW1lID0gJ01heExpc3RlbmVyc0V4Y2VlZGVkV2FybmluZyc7XG4gICAgICAgIHcuZW1pdHRlciA9IHRhcmdldDtcbiAgICAgICAgdy50eXBlID0gdHlwZTtcbiAgICAgICAgdy5jb3VudCA9IGV4aXN0aW5nLmxlbmd0aDtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlID09PSAnb2JqZWN0JyAmJiBjb25zb2xlLndhcm4pIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJyVzOiAlcycsIHcubmFtZSwgdy5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YXJnZXQ7XG59XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbiBhZGRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcikge1xuICByZXR1cm4gX2FkZExpc3RlbmVyKHRoaXMsIHR5cGUsIGxpc3RlbmVyLCBmYWxzZSk7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5wcmVwZW5kTGlzdGVuZXIgPVxuICAgIGZ1bmN0aW9uIHByZXBlbmRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcikge1xuICAgICAgcmV0dXJuIF9hZGRMaXN0ZW5lcih0aGlzLCB0eXBlLCBsaXN0ZW5lciwgdHJ1ZSk7XG4gICAgfTtcblxuZnVuY3Rpb24gb25jZVdyYXBwZXIoKSB7XG4gIGlmICghdGhpcy5maXJlZCkge1xuICAgIHRoaXMudGFyZ2V0LnJlbW92ZUxpc3RlbmVyKHRoaXMudHlwZSwgdGhpcy53cmFwRm4pO1xuICAgIHRoaXMuZmlyZWQgPSB0cnVlO1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICByZXR1cm4gdGhpcy5saXN0ZW5lci5jYWxsKHRoaXMudGFyZ2V0KTtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgcmV0dXJuIHRoaXMubGlzdGVuZXIuY2FsbCh0aGlzLnRhcmdldCwgYXJndW1lbnRzWzBdKTtcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgcmV0dXJuIHRoaXMubGlzdGVuZXIuY2FsbCh0aGlzLnRhcmdldCwgYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0pO1xuICAgICAgY2FzZSAzOlxuICAgICAgICByZXR1cm4gdGhpcy5saXN0ZW5lci5jYWxsKHRoaXMudGFyZ2V0LCBhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSxcbiAgICAgICAgICAgIGFyZ3VtZW50c1syXSk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgKytpKVxuICAgICAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIHRoaXMubGlzdGVuZXIuYXBwbHkodGhpcy50YXJnZXQsIGFyZ3MpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBfb25jZVdyYXAodGFyZ2V0LCB0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgc3RhdGUgPSB7IGZpcmVkOiBmYWxzZSwgd3JhcEZuOiB1bmRlZmluZWQsIHRhcmdldDogdGFyZ2V0LCB0eXBlOiB0eXBlLCBsaXN0ZW5lcjogbGlzdGVuZXIgfTtcbiAgdmFyIHdyYXBwZWQgPSBiaW5kLmNhbGwob25jZVdyYXBwZXIsIHN0YXRlKTtcbiAgd3JhcHBlZC5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICBzdGF0ZS53cmFwRm4gPSB3cmFwcGVkO1xuICByZXR1cm4gd3JhcHBlZDtcbn1cblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24gb25jZSh0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKVxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdGVuZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgdGhpcy5vbih0eXBlLCBfb25jZVdyYXAodGhpcywgdHlwZSwgbGlzdGVuZXIpKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnByZXBlbmRPbmNlTGlzdGVuZXIgPVxuICAgIGZ1bmN0aW9uIHByZXBlbmRPbmNlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXIpIHtcbiAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdGVuZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICAgIHRoaXMucHJlcGVuZExpc3RlbmVyKHR5cGUsIF9vbmNlV3JhcCh0aGlzLCB0eXBlLCBsaXN0ZW5lcikpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuLy8gRW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmIGFuZCBvbmx5IGlmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPVxuICAgIGZ1bmN0aW9uIHJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgICB2YXIgbGlzdCwgZXZlbnRzLCBwb3NpdGlvbiwgaSwgb3JpZ2luYWxMaXN0ZW5lcjtcblxuICAgICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0ZW5lclwiIGFyZ3VtZW50IG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gICAgICBldmVudHMgPSB0aGlzLl9ldmVudHM7XG4gICAgICBpZiAoIWV2ZW50cylcbiAgICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICAgIGxpc3QgPSBldmVudHNbdHlwZV07XG4gICAgICBpZiAoIWxpc3QpXG4gICAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHwgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKC0tdGhpcy5fZXZlbnRzQ291bnQgPT09IDApXG4gICAgICAgICAgdGhpcy5fZXZlbnRzID0gb2JqZWN0Q3JlYXRlKG51bGwpO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgZXZlbnRzW3R5cGVdO1xuICAgICAgICAgIGlmIChldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdC5saXN0ZW5lciB8fCBsaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGxpc3QgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcG9zaXRpb24gPSAtMTtcblxuICAgICAgICBmb3IgKGkgPSBsaXN0Lmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8IGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XG4gICAgICAgICAgICBvcmlnaW5hbExpc3RlbmVyID0gbGlzdFtpXS5saXN0ZW5lcjtcbiAgICAgICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICAgICAgaWYgKHBvc2l0aW9uID09PSAwKVxuICAgICAgICAgIGxpc3Quc2hpZnQoKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHNwbGljZU9uZShsaXN0LCBwb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKVxuICAgICAgICAgIGV2ZW50c1t0eXBlXSA9IGxpc3RbMF07XG5cbiAgICAgICAgaWYgKGV2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgb3JpZ2luYWxMaXN0ZW5lciB8fCBsaXN0ZW5lcik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID1cbiAgICBmdW5jdGlvbiByZW1vdmVBbGxMaXN0ZW5lcnModHlwZSkge1xuICAgICAgdmFyIGxpc3RlbmVycywgZXZlbnRzLCBpO1xuXG4gICAgICBldmVudHMgPSB0aGlzLl9ldmVudHM7XG4gICAgICBpZiAoIWV2ZW50cylcbiAgICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICAgIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgICAgIGlmICghZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5fZXZlbnRzID0gb2JqZWN0Q3JlYXRlKG51bGwpO1xuICAgICAgICAgIHRoaXMuX2V2ZW50c0NvdW50ID0gMDtcbiAgICAgICAgfSBlbHNlIGlmIChldmVudHNbdHlwZV0pIHtcbiAgICAgICAgICBpZiAoLS10aGlzLl9ldmVudHNDb3VudCA9PT0gMClcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50cyA9IG9iamVjdENyZWF0ZShudWxsKTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBkZWxldGUgZXZlbnRzW3R5cGVdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuXG4gICAgICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHZhciBrZXlzID0gb2JqZWN0S2V5cyhldmVudHMpO1xuICAgICAgICB2YXIga2V5O1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICAgICAgdGhpcy5fZXZlbnRzID0gb2JqZWN0Q3JlYXRlKG51bGwpO1xuICAgICAgICB0aGlzLl9ldmVudHNDb3VudCA9IDA7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuXG4gICAgICBsaXN0ZW5lcnMgPSBldmVudHNbdHlwZV07XG5cbiAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgICAgIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgICAgIC8vIExJRk8gb3JkZXJcbiAgICAgICAgZm9yIChpID0gbGlzdGVuZXJzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbmZ1bmN0aW9uIF9saXN0ZW5lcnModGFyZ2V0LCB0eXBlLCB1bndyYXApIHtcbiAgdmFyIGV2ZW50cyA9IHRhcmdldC5fZXZlbnRzO1xuXG4gIGlmICghZXZlbnRzKVxuICAgIHJldHVybiBbXTtcblxuICB2YXIgZXZsaXN0ZW5lciA9IGV2ZW50c1t0eXBlXTtcbiAgaWYgKCFldmxpc3RlbmVyKVxuICAgIHJldHVybiBbXTtcblxuICBpZiAodHlwZW9mIGV2bGlzdGVuZXIgPT09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHVud3JhcCA/IFtldmxpc3RlbmVyLmxpc3RlbmVyIHx8IGV2bGlzdGVuZXJdIDogW2V2bGlzdGVuZXJdO1xuXG4gIHJldHVybiB1bndyYXAgPyB1bndyYXBMaXN0ZW5lcnMoZXZsaXN0ZW5lcikgOiBhcnJheUNsb25lKGV2bGlzdGVuZXIsIGV2bGlzdGVuZXIubGVuZ3RoKTtcbn1cblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbiBsaXN0ZW5lcnModHlwZSkge1xuICByZXR1cm4gX2xpc3RlbmVycyh0aGlzLCB0eXBlLCB0cnVlKTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmF3TGlzdGVuZXJzID0gZnVuY3Rpb24gcmF3TGlzdGVuZXJzKHR5cGUpIHtcbiAgcmV0dXJuIF9saXN0ZW5lcnModGhpcywgdHlwZSwgZmFsc2UpO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIGlmICh0eXBlb2YgZW1pdHRlci5saXN0ZW5lckNvdW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbGlzdGVuZXJDb3VudC5jYWxsKGVtaXR0ZXIsIHR5cGUpO1xuICB9XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBsaXN0ZW5lckNvdW50O1xuZnVuY3Rpb24gbGlzdGVuZXJDb3VudCh0eXBlKSB7XG4gIHZhciBldmVudHMgPSB0aGlzLl9ldmVudHM7XG5cbiAgaWYgKGV2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKHR5cGVvZiBldmxpc3RlbmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gMTtcbiAgICB9IGVsc2UgaWYgKGV2bGlzdGVuZXIpIHtcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gMDtcbn1cblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5ldmVudE5hbWVzID0gZnVuY3Rpb24gZXZlbnROYW1lcygpIHtcbiAgcmV0dXJuIHRoaXMuX2V2ZW50c0NvdW50ID4gMCA/IFJlZmxlY3Qub3duS2V5cyh0aGlzLl9ldmVudHMpIDogW107XG59O1xuXG4vLyBBYm91dCAxLjV4IGZhc3RlciB0aGFuIHRoZSB0d28tYXJnIHZlcnNpb24gb2YgQXJyYXkjc3BsaWNlKCkuXG5mdW5jdGlvbiBzcGxpY2VPbmUobGlzdCwgaW5kZXgpIHtcbiAgZm9yICh2YXIgaSA9IGluZGV4LCBrID0gaSArIDEsIG4gPSBsaXN0Lmxlbmd0aDsgayA8IG47IGkgKz0gMSwgayArPSAxKVxuICAgIGxpc3RbaV0gPSBsaXN0W2tdO1xuICBsaXN0LnBvcCgpO1xufVxuXG5mdW5jdGlvbiBhcnJheUNsb25lKGFyciwgbikge1xuICB2YXIgY29weSA9IG5ldyBBcnJheShuKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyArK2kpXG4gICAgY29weVtpXSA9IGFycltpXTtcbiAgcmV0dXJuIGNvcHk7XG59XG5cbmZ1bmN0aW9uIHVud3JhcExpc3RlbmVycyhhcnIpIHtcbiAgdmFyIHJldCA9IG5ldyBBcnJheShhcnIubGVuZ3RoKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXQubGVuZ3RoOyArK2kpIHtcbiAgICByZXRbaV0gPSBhcnJbaV0ubGlzdGVuZXIgfHwgYXJyW2ldO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIG9iamVjdENyZWF0ZVBvbHlmaWxsKHByb3RvKSB7XG4gIHZhciBGID0gZnVuY3Rpb24oKSB7fTtcbiAgRi5wcm90b3R5cGUgPSBwcm90bztcbiAgcmV0dXJuIG5ldyBGO1xufVxuZnVuY3Rpb24gb2JqZWN0S2V5c1BvbHlmaWxsKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrIGluIG9iaikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGspKSB7XG4gICAga2V5cy5wdXNoKGspO1xuICB9XG4gIHJldHVybiBrO1xufVxuZnVuY3Rpb24gZnVuY3Rpb25CaW5kUG9seWZpbGwoY29udGV4dCkge1xuICB2YXIgZm4gPSB0aGlzO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBmbi5hcHBseShjb250ZXh0LCBhcmd1bWVudHMpO1xuICB9O1xufVxuIiwidmFyIHRlc3QgPSByZXF1aXJlKCd0YXBlJyksXG4gICAgZHJpdmVyID0gcmVxdWlyZSgnLi4vJyk7XG5cbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbigpe1xuICAgIGRyaXZlci5pbml0KHtcbiAgICAgICAgcnVuRGVsYXk6IDEwLFxuICAgICAgICBrZXlQcmVzc0RlbGF5OiAxXG4gICAgfSk7XG5cbiAgICB0ZXN0KCdkbyBzdHVmZicsIGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgdC5wbGFuKDMpO1xuXG4gICAgICAgIGRyaXZlcigpXG4gICAgICAgICAgICAuY2xpY2soJ0kgYW0gYSBidXR0b24nKVxuICAgICAgICAgICAgLmZvY3VzKCd0ZXN0IGlucHV0JywgJ2ZpZWxkJylcbiAgICAgICAgICAgIC5wcmVzc0tleSgnMScpXG4gICAgICAgICAgICAud2FpdCgyMDApXG4gICAgICAgICAgICAucHJlc3NLZXkoJ2EnKVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzdWx0LCBjYWxsYmFjayl7XG4gICAgICAgICAgICAgICAgdC5lcXVhbChyZXN1bHQudGFnTmFtZSwgJ0lOUFVUJywgJ1Jlc3VsdCBpcyBmb2N1c2VkIGlucHV0Jyk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2xpY2soJ0kgYW0gYSBidXR0b24nKVxuICAgICAgICAgICAgLmJsdXIoKVxuICAgICAgICAgICAgLmdvKGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpIHtcblxuICAgICAgICAgICAgICAgIHQubm90T2soZXJyb3IsICdzaG91bGQgbm90IGVycm9yJyk7XG4gICAgICAgICAgICAgICAgdC5vayhyZXN1bHQsICdnb3QgYSByZXN1bHQnKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndGVzdCBwbGFjZWhvbGRlcicsIGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgZHJpdmVyKClcbiAgICAgICAgICAgIC5mb2N1cygnaW5wdXQgd2l0aCBwbGFjZWhvbGRlcicpXG4gICAgICAgICAgICAucHJlc3NLZXlzKCd0ZXN0IHZhbHVlJylcbiAgICAgICAgICAgIC5nbyhmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdC5wbGFuKDIpO1xuXG4gICAgICAgICAgICAgICAgdC5ub3RPayhlcnJvciwgJ3Nob3VsZCBub3QgZXJyb3InKTtcbiAgICAgICAgICAgICAgICB0Lm9rKHJlc3VsdCwgJ2dvdCBhIHJlc3VsdCcpO1xuICAgICAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCd0ZXN0IHJlZ2V4JywgZnVuY3Rpb24odCkge1xuICAgICAgICBkcml2ZXIoKVxuICAgICAgICAgICAgLmZvY3VzKC8uKnRlc3QuKi9pKVxuICAgICAgICAgICAgLnByZXNzS2V5cygndGVzdCB2YWx1ZScpXG4gICAgICAgICAgICAuZ28oZnVuY3Rpb24oZXJyb3IsIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHQucGxhbigyKTtcblxuICAgICAgICAgICAgICAgIHQubm90T2soZXJyb3IsICdzaG91bGQgbm90IGVycm9yJyk7XG4gICAgICAgICAgICAgICAgdC5vayhyZXN1bHQsICdnb3QgYSByZXN1bHQnKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndGVzdCBidXR0b24gdmFsdWUnLCBmdW5jdGlvbih0KSB7XG4gICAgICAgIGRyaXZlcigpXG4gICAgICAgICAgICAuY2xpY2soJ2kgbmVlZCBhIGNsaWNrJylcbiAgICAgICAgICAgIC5nbyhmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdC5wbGFuKDMpO1xuXG4gICAgICAgICAgICAgICAgdC5ub3RPayhlcnJvciwgJ3Nob3VsZCBub3QgZXJyb3InKTtcbiAgICAgICAgICAgICAgICB0LmVxdWFsKHJlc3VsdC50YWdOYW1lLCAnQlVUVE9OJywgJ2dvdCBhIGJ1dHRvbicpO1xuICAgICAgICAgICAgICAgIHQuZXF1YWwocmVzdWx0LnZhbHVlLCAnaSBuZWVkIGEgY2xpY2snLCAnZ290IGNvcnJlY3QgYnV0dG9uJyk7XG4gICAgICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRlc3QoJ3Rlc3QgYXJpYS1sYWJlbCcsIGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgZHJpdmVyKClcbiAgICAgICAgICAgIC5jbGljaygnY2xpY2sgbWUnKVxuICAgICAgICAgICAgLmdvKGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICB0LnBsYW4oMyk7XG5cbiAgICAgICAgICAgICAgICB0Lm5vdE9rKGVycm9yLCAnc2hvdWxkIG5vdCBlcnJvcicpO1xuICAgICAgICAgICAgICAgIHQuZXF1YWwocmVzdWx0LnRhZ05hbWUsICdCVVRUT04nLCAnZ290IGEgYnV0dG9uJyk7XG4gICAgICAgICAgICAgICAgdC5lcXVhbChyZXN1bHQuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksICdjbGljayBtZScsICdnb3QgY29ycmVjdCBidXR0b24nKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndGVzdCBhcmlhIHJvbGUgYnV0dG9uJywgZnVuY3Rpb24odCkge1xuICAgICAgICBkcml2ZXIoKVxuICAgICAgICAgICAgLmNsaWNrKCdJXFwnbSBsaWtlIGEgYnV0dG9uJylcbiAgICAgICAgICAgIC5nbyhmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdC5wbGFuKDMpO1xuXG4gICAgICAgICAgICAgICAgdC5ub3RPayhlcnJvciwgJ3Nob3VsZCBub3QgZXJyb3InKTtcbiAgICAgICAgICAgICAgICB0LmVxdWFsKHJlc3VsdC50YWdOYW1lLCAnTEFCRUwnLCAnZ290IGEgXCJidXR0b25cIicpO1xuICAgICAgICAgICAgICAgIHQuZXF1YWwocmVzdWx0LmdldEF0dHJpYnV0ZSgncm9sZScpLCAnYnV0dG9uJywgJ2dvdCBjb3JyZWN0IFwiYnV0dG9uXCInKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgndGVzdCBhcmlhIHJvbGUgbm9uLWJ1dHRvbiB0ZXh0JywgZnVuY3Rpb24odCkge1xuICAgICAgICBkcml2ZXIoKVxuICAgICAgICAgICAgLmZpbmRVaSgnSVxcJ20gbGlrZSBhIGJ1dHRvbicsICdsYWJlbCcpXG4gICAgICAgICAgICAuZ28oZnVuY3Rpb24oZXJyb3IsIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHQucGxhbigzKTtcblxuICAgICAgICAgICAgICAgIHQubm90T2soZXJyb3IsICdzaG91bGQgbm90IGVycm9yJyk7XG4gICAgICAgICAgICAgICAgdC5lcXVhbChyZXN1bHQudGFnTmFtZSwgJ0xBQkVMJywgJ2dvdCBhIFwiYnV0dG9uXCInKTtcbiAgICAgICAgICAgICAgICB0Lm5vdEVxdWFsKHJlc3VsdC5nZXRBdHRyaWJ1dGUoJ3JvbGUnKSwgJ2J1dHRvbicsICdnb3QgY29ycmVjdCBcImJ1dHRvblwiJyk7XG4gICAgICAgICAgICB9KTtcbiAgICB9KTtcbn07XG4iXX0=
