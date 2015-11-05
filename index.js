var predator = require('predator');

var types = {
        'button': ['button', 'a'],
        'label': ['label', 'span', 'div'],
        'heading': ['h1', 'h2', 'h3', 'h4'],
        'image': ['img', 'svg'],
        'field': ['input']
    },
    noelementOfType = 'no elements of type ';

function _keyPress(key, done) {
    var element = document.activeElement;

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

function _navigate(location, previousElement, done) {
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

function _findUi(value, type, done) {
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

function _setValue(value, element, done) {
    element.value = value;

    done(null, element);
}

function _wait(time, done) {
    setTimeout(done, time || 0);
}

function _click(element, done) {
    var rect = element.getBoundingClientRect(),
        clickElement = document.elementFromPoint(rect.left, rect.top),
        elementInClickElement = ~Array.prototype.indexOf.call(clickElement.children, element);
    if
    (!elementInClickElement && (clickElement !== element)) {
        return done(new Error('no clickable element found'));
    }

    element.click();
    
    done(null, element);
}

function _focus(element, done) {
    element.focus();

    done(null, element);
}

function _blur(done) {
    var element = document.activeElement;
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
    var tasks = [];

    var driverFunctions = {
        navigate: function(location){
            tasks.push(_navigate.bind(driverFunctions, location));
            return driverFunctions;
        },
        findUi: function(value, type){
            tasks.push(_findUi.bind(driverFunctions, _findUi, value, type));

            return driverFunctions;
        },
        focus: function(value, type) {
            tasks.push(execute.bind(driverFunctions, _focus, value, type));

            return driverFunctions;
        },
        blur: function() {
            tasks.push(_blur.bind(driverFunctions));

            return driverFunctions;
        },
        click: function(value, type){
            tasks.push(execute.bind(driverFunctions, _click, value, type));

            return driverFunctions;
        },
        keyPress: function(value) {
            tasks.push(_keyPress.bind(driverFunctions, value));

            return driverFunctions;
        },
        setValue: function(value) {
            tasks.push(_setValue.bind(driverFunctions, value));

            return driverFunctions;
        },
        wait: function(time) {
            tasks.push(_wait.bind(driverFunctions, time));

            return driverFunctions;
        },
        go: function(callback) {
            if(tasks.length) {
                runTasks(tasks, callback);
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
