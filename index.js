var predator = require('predator');

var types = {
        'button': ['button', 'a'],
        'label': ['label', 'span', 'div'],
        'heading': ['h1', 'h2', 'h3', 'h4'],
        'image': ['img', 'svg'],
        'field': ['input']
    },
    noelementOfType = 'no elements of type ';

function executeKeyPress(key, element, done) {
    element.value += key;

    var keydownEvent = new window.KeyboardEvent('keydown'),
        keyupEvent = new window.KeyboardEvent('keyup'),
        keypressEvent = new window.KeyboardEvent('keypress');

    var method = 'initKeyboardEvent' in keydownEvent ? 'initKeyboardEvent' : 'initKeyEvent';

    keydownEvent[method]('keydown', true, true, window, key, 3, true, false, true, false, false);
    keyupEvent[method]('keyup', true, true, window, key, 3, true, false, true, false, false);
    keypressEvent[method]('keypress', true, true, window, key, 3, true, false, true, false, false);

    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keyupEvent);
    element.dispatchEvent(keypressEvent);

    done(null, element);
}

function findUi(selectors) {
    return document.querySelectorAll(selectors);
}

function executeNavigate(location, previousElement, done) {
    var callbackTimer;

    function handleWindowError(error) {
        clearTimeout(callbackTimer);

        done(error);
        window.removeEventListener('error', handleWindowError);
    }

    window.addEventListener('error', handleWindowError);
    window.location = location;

    callbackTimer = setTimeout(done, 150);
}

function _findUi(value, type, previousElement, done) {
    var elementTypes = types[type];

    if(!elementTypes) {
        return done(new Error(type + ' is not a valid ui type'));
    }

    var elements = findUi(elementTypes);

    if(!elements.length) {
        return done(new Error(noelementOfType + type));
    } else {
        var element;

        for(var i = 0; i < elements.length; i++) {
            var currentElement = elements[i];

            if((currentElement.textContent.toLowerCase() === value.toLowerCase() || currentElement.title.toLowerCase() === value.toLowerCase()) && !predator(currentElement).hidden) {
                element = currentElement;
                break;
            }
        }

        if(!element) {
            return done(new Error(noelementOfType + type + ' with value of ' + value));
        }

        done(null, element);
    }
}

function executeSetValue(value, element, done) {
    element.value = value;

    done(null, element);
}

function executeWait(time, previousElement, done) {
    setTimeout(done.bind(this, null, previousElement), time || 0);
}

function _click(value, type, previousElement, done) {
    var rect = previousElement.getBoundingClientRect(),
        clickElement = document.elementFromPoint(rect.left, rect.top),
        elementInClickElement = ~Array.prototype.indexOf.call(clickElement.children, previousElement);

    if
    (!elementInClickElement && (clickElement !== previousElement)) {
        return done(new Error('no clickable element with type ' + type + ' and value of ' + value));
    }

    previousElement.click();
    done(null, previousElement);
}

function _focus(value, type, previousElement, done) {
    previousElement.focus();

    done(null, previousElement);
}

function _blur(value, type, previousElement, done) {
    previousElement.blur();

    done(null, previousElement);
}

function execute(task, value, type, previousElement, done) {
    if(!value && previousElement) {
        return task(value, type, previousElement, done);
    }

    _findUi(value, type, previousElement, function(error, element) {
        if(error) {
            return done(error);
        }

        task(value, type, element, done);
    });
}

function runTasks(tasks, previousElement, callback) {
    if(tasks.length) {
        tasks.shift()(previousElement, function(error, result) {
            if(error) {
                return callback(error);
            } else {
                if(tasks.length === 0) {
                    callback(null, result);
                } else {
                    runTasks(tasks, result, callback);
                }
            }
        });
    }
}

function driveUi(){
    var tasks = [];

    var driverFunctions = {
        navigate: function(location){
            tasks.push(executeNavigate.bind(driverFunctions, location));
            return driverFunctions;
        },
        findUi: function(value, type){
            tasks.push(execute.bind(driverFunctions, _findUi, value, type));

            return driverFunctions;
        },
        focus: function(value, type) {
            tasks.push(execute.bind(driverFunctions, _focus, value, type));

            return driverFunctions;
        },
        blur: function(value, type) {
            tasks.push(execute.bind(driverFunctions, _blur, value, type));

            return driverFunctions;
        },
        click: function(value, type){
            tasks.push(execute.bind(driverFunctions, _click, value, type));

            return driverFunctions;
        },
        keyPress: function(value) {
            tasks.push(executeKeyPress.bind(driverFunctions, value));

            return driverFunctions;
        },
        setValue: function(value) {
            tasks.push(executeSetValue.bind(driverFunctions, value));

            return driverFunctions;
        },
        wait: function(time) {
            tasks.push(executeWait.bind(driverFunctions, time));

            return driverFunctions;
        },
        go: function(callback) {
            if(tasks.length) {
                runTasks(tasks, null, callback);
            } else {
                callback(new Error('No tasks defined'));
            }
        },
        do: function(driver){
            tasks.push(driver.go);
            return driverFunctions;
        }
    };

    return driverFunctions;
}


module.exports = driveUi;
