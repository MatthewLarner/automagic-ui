var predator = require('predator');

// List of tagNames ordered by their likeliness to be the target of a click event
var clickableWeighting = ['button', 'a', 'label', 'h1', 'h2', 'h3', 'h4', 'i', 'span'];

var types = {
        'button': ['button', 'a'],
        'label': ['label', 'span', 'div'],
        'heading': ['h1', 'h2', 'h3', 'h4'],
        'image': ['img', 'svg'],
        'field': ['input', 'select'],
        'all': ['*']
    },
    noelementOfType = 'no elements of type ',
    documentScope,
    windowScope,
    runDelay,
    initialised;

function _pressKey(key, done) {
    var element = documentScope.activeElement;

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
    keys.split('').forEach(function(key) {
        _pressKey(key, function noop() {});
    });

    done(null, documentScope.activeElement);
}

function findUi(selectors) {
    return documentScope.querySelectorAll(selectors);
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

function matchElementValue(element, value) {
    return (
            element.textContent.toLowerCase() === value.toLowerCase() ||
            (element.title && element.title.toLowerCase() === value.toLowerCase())
        ) && !predator(element).hidden;
}

function findMatchingElements(value, type, elementsList) {
    return Array.prototype.slice.call(elementsList)
        .filter(function(element) {
            return matchElementValue(element, value);
        });
}

function _findUi(value, type, returnArray, done) {
    if(!done) {
        done = returnArray;
        returnArray = false;
    }

    var elementTypes = types[type];

    if(!elementTypes) {
        return done(new Error(type + ' is not a valid ui type'));
    }

    var elements = findUi(elementTypes);

    if(!elements.length) {
        return done(new Error(noelementOfType + type));
    }

    var result = findMatchingElements(value, type, elements);

    if(!result.length) {
        return done(new Error(noelementOfType + type + ' with value of ' + value));
    }

    done(null, returnArray ? result : result.shift());
}

function _setValue(value, element, done) {
    element.value = value;

    done(null, element);
}

function _wait(time, done) {
    setTimeout(done, time || 0);
}

function _click(element, done) {
    var rect = element.getBoundingClientRect(),
        clickElement = documentScope.elementFromPoint(rect.left, rect.top),
        elementInClickElement = ~Array.prototype.indexOf.call(clickElement.children, element);
    if
    (!elementInClickElement && (clickElement !== element)) {
        return done(new Error('no clickable element found'));
    }

    element.click();

    done(null, element);
}

function getElementClickWeight(element) {
    var index = clickableWeighting.indexOf(element.tagName.toLowerCase());
    return clickableWeighting.length - (index < 0 ? Infinity : index);
}

function executeClick(value, type, done) {
    _findUi(value, 'all', true, function(error, elements) {
        if(error) {
            return done(error);
        }

        var element = elements.sort(function(a, b) {
            return getElementClickWeight(a) < getElementClickWeight(b);
        }).shift();

        if(!element) {
            return done(new Error('could not find clickable element with value ' + value));
        }

        _click(element, done);
    });
}

function _focus(element, done) {
    element.focus();

    done(null, element);
}

function _changeValue(selector, type, value, done) {
    execute(_focus, selector, type, function(error, element) {
        _pressKeys(value, function(error){
            element.blur();

            var event = document.createEvent('HTMLEvents');

            event.initEvent('change', false, true);
            element.dispatchEvent(event);

            done(null, element);
        });
    });
}

function _blur(done) {
    var element = documentScope.activeElement;
    element.blur();

    done(null, element);
}

function execute(task, value, type, done) {
    _findUi(value, type, function(error, element) {
        if(error) {
            return done(error);
        }

        task(element, done);
    });
}

function runTasks(tasks, callback) {
    if(tasks.length) {
        tasks.shift()(function(error, result) {
            if(error) {
                return callback(error);
            } else {
                if(tasks.length === 0) {
                    callback(null, result);
                } else {
                    runTasks(tasks, callback);
                }
            }
        });
    }
}

function driveUi(){
    var tasks = [],
        driverFunctions = {};

    function addTask(task){
        tasks.push(task);

        return driverFunctions;
    }

    driverFunctions = {
        navigate: function(location){
            return addTask(_navigate.bind(driverFunctions, location));
        },
        findUi: function(value, type){
            return addTask(_findUi.bind(driverFunctions, value, type));
        },
        getLocation: function() {
            return addTask(_getLocation.bind(driverFunctions));
        },
        focus: function(value, type) {
            return addTask(execute.bind(driverFunctions, _focus, value, type));
        },
        blur: function() {
            return addTask(_blur.bind(driverFunctions));
        },
        click: function(value, type){
            return addTask(executeClick.bind(driverFunctions, value, type));
        },
        pressKey: function(value) {
            return addTask(_pressKey.bind(driverFunctions, value));
        },
        pressKeys: function(value) {
            return addTask(_pressKeys.bind(driverFunctions, value));
        },
        changeValue: function(selector, value, type) {
            return addTask(_changeValue.bind(driverFunctions, selector, value, type));
        },
        setValue: function(value) {
            return addTask(_setValue.bind(driverFunctions, value));
        },
        wait: function(time) {
            if(!arguments.length) {
                time = runDelay;
            }

            return addTask(_wait.bind(driverFunctions, time));
        },
        do: function(driver){
            return addTask(driver.go);
        },
        go: function(callback) {
            if(!initialised) {
                throw(new Error('init must becalled before calling go'));
            }

            if(tasks.length) {
                tasks.unshift(_wait.bind(driverFunctions, runDelay));
                runTasks(tasks, callback);
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

    initialised = true;
};

module.exports = driveUi;
