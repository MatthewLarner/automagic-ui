var predator = require('predator');
var scrollIntoView = require('scroll-into-view');
var types = require('./elementTypes');

// List of selectors ordered by their likeliness to be the target of text/click/value selection
var textWeighting = ['h1', 'h2', 'h3', 'h4', 'label', 'p', 'a', 'button', '[role=button]'];
var clickWeighting = ['button', '[role=button]', 'input', 'a', 'h1', 'h2', 'h3', 'h4', 'i', 'label'];
var valueWeighting = ['input', 'textarea', 'select', '[contenteditable]', 'label'];

var noElementOfType = 'no elements of type ',
    documentScope,
    windowScope,
    runDelay,
    keyPressDelay,
    initialised;

var nonTextInputs = ['date', 'range', 'select'];

function _pressKey(key, fullValue, done) {
    var element = this.currentContext.activeElement;

    if(arguments.length < 3){
        done = fullValue;
        fullValue = element.value + key;
    }


    var keydownEvent = new windowScope.KeyboardEvent('keydown'),
        keyupEvent = new windowScope.KeyboardEvent('keyup'),
        keypressEvent = new windowScope.KeyboardEvent('keypress');
        inputEvent = new windowScope.KeyboardEvent('input');

    var method = 'initKeyboardEvent' in keydownEvent ? 'initKeyboardEvent' : 'initKeyEvent';

    keydownEvent[method]('keydown', true, true, windowScope, key, 3, true, false, true, false, false);
    keypressEvent[method]('keypress', true, true, windowScope, key, 3, true, false, true, false, false);
    inputEvent[method]('input', true, true, windowScope, key, 3, true, false, true, false, false);
    keyupEvent[method]('keyup', true, true, windowScope, key, 3, true, false, true, false, false);

    element.dispatchEvent(keydownEvent);
    element.value = fullValue;
    element.dispatchEvent(keypressEvent);
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(keyupEvent);

    done(null, element);
}

function _pressKeys(keys, done) {
    var state = this;

    function pressNextKey(keyIndex, callback){
        var nextKey = String(keys).charAt(keyIndex);

        if(nextKey === ''){
            return callback(null, state.currentContext.activeElement);
        }

        _pressKey.call(state, nextKey, keys.slice(0, keyIndex + 1), function() {
            setTimeout(function(){
                pressNextKey(keyIndex + 1, callback);
            }, state.keyPressDelay);
        });
    }

    pressNextKey(0, done)
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

function getElementVisibleText(element, ignoreViewport, domQueries){
    return Array.from(element.childNodes).map(node => {
        if(node.nodeType !== 3){
            return getElementVisibleText(node, ignoreViewport, domQueries);
        }

        if(
            node.textContent &&
            domQueries.isVisible(element) &&
            (ignoreViewport || !domQueries.isObscured(element))
        ) {
            return node.textContent;
        }

        return '';
    })
    .flat()
    .join('');
}

function matchAttributes(element, value){
    if(
        checkMatchValue(element.getAttribute('title'), value) ||
        checkMatchValue(element.getAttribute('placeholder'), value) ||
        checkMatchValue(element.getAttribute('aria-label'), value) ||
        element.tagName === 'IMG' && checkMatchValue(element.getAttribute('alt'), value) ||
        checkMatchValue(element.value, value)
    ) {
        return 1;
    }
}

function matchTextContent(element, value, ignoreViewport, domQueries){
    if(
        checkMatchValue(element.textContent, value) &&
        checkMatchValue(getElementVisibleText(element, ignoreViewport, domQueries), value)
    ){
        return 1;
    }
}

function matchBesideLabels(element, value, ignoreViewport, domQueries){
    if(
        element.previousElementSibling &&
        element.previousElementSibling.matches(types.label.join()) &&
        checkMatchValue(getElementVisibleText(element.previousElementSibling, ignoreViewport, domQueries), value)
    ) {
        return 4;
    }
}

function isTextNode(node){
    return node.nodeType === 3;
}

function matchDirectChildTextNodes(element, value, ignoreViewport, domQueries){
    if(!ignoreViewport && domQueries.isObscured(element)){
        return
    }

    var directChildText = Array.from(element.childNodes)
        .filter(isTextNode)
        .map(textNode => textNode.textContent)
        .join('');

    if(checkMatchValue(directChildText, value)){
        return  2;
    }
}

function matchDecendentLabels(element, value, ignoreViewport, domQueries){
    if(
        findMatchingElements(
            value,
            Array.from(element.childNodes).filter(node =>
                node.matches &&
                node.matches(types.label.join())
            ),
            ignoreViewport,
            domQueries
        ).length
    ){
        return 3
    }
}

function matchLabelFor(element, value, ignoreViewport, domQueries){
    var name = element.getAttribute('name');

    if(
        name &&
        findMatchingElements(
            value,
            document.querySelectorAll('label[for="' + name + '"]'),
            ignoreViewport,
            domQueries
        ).length
    ){
        return 3
    }
}

function createCachedDomQueries(){
    var isObscuredCache = new WeakMap();
    var isVisibleCache = new WeakMap();

    function isObscured(element){
        if(isObscuredCache.has(element)){
            return isObscuredCache.get(element);
        }

        isObscuredCache.set(element, predator(element).hidden);
        return isObscured(element);
    }

    function isVisible(element){
        if(isVisibleCache.has(element)){
            return isVisibleCache.get(element)
        }

        if(element.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        var style = window.getComputedStyle(element);
        isVisibleCache.set(element, style.visibility !== 'hidden' && style.display !== 'none');
        return isVisible(element);
    }

    return {
        isObscured,
        isVisible
    }
}

function matchElementValue(element, value, ignoreViewport, domQueries) {
    if(!domQueries){
        domQueries = createCachedDomQueries();
    }

    return (
        // This check is fast, so we optimize by checking it first
        matchAttributes(element, value) ||
        domQueries.isVisible(element) &&
        (
            matchTextContent(element, value, ignoreViewport, domQueries) ||
            matchDirectChildTextNodes(element, value, ignoreViewport, domQueries) ||
            matchLabelFor(element, value, ignoreViewport, domQueries) ||
            matchDecendentLabels(element, value, ignoreViewport, domQueries) ||
            matchBesideLabels(element, value, ignoreViewport, domQueries)
        )
    );
}

function findMatchingElements(value, elementsList, ignoreViewport, domQueries) {
    if(!domQueries){
        domQueries = createCachedDomQueries();
    }

    return Array.prototype.slice.call(elementsList)
        .map(function(element) {
            var weighting = matchElementValue(element, value, ignoreViewport, domQueries);
            if(weighting){
                return [weighting, element]
            };
        })
        .filter(result => result)
        .sort((a, b) => a[0] - b[0])
        .map(result => result [1]);
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

function _findAllUi(value, type, ignoreViewport, done){
    if(!type){
        type = 'all';
    }

    var elementTypes = types[type];


    if(!elementTypes) {
        return done(new Error(type + ' is not a valid ui type'));
    }

    var elements = Array.from(this.currentContext.querySelectorAll(elementTypes))

    if(!elements.length) {
        return done(new Error(noElementOfType + type));
    }

    var results = findMatchingElements(value, elements, ignoreViewport)
        .sort(function(a, b){
            var aTypeIndex = elementTypes.findIndex(type => a.matches(type));
            var bTypeIndex = elementTypes.findIndex(type => b.matches(type));
            aTypeIndex = aTypeIndex < 0 ? Infinity : aTypeIndex;
            bTypeIndex = bTypeIndex < 0 ? Infinity : bTypeIndex;
            return aTypeIndex - bTypeIndex;
        })
        .sort(function(a, b){
            return a.contains(b) ? 1 : b.contains(a) ? -1 : 0;
        })

    done(null, results);
}

function _findUi(value, type, returnArray, done) {
    if(!done) {
        done = returnArray;
        returnArray = false;
    }

    _findAllUi.call(this, value, type, false, function(error, elements){
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
            clickElement = (
                    currentContext.ownerDocument || // If context is a Node
                    currentContext // If context is a Document
                )
                .elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
            clickElementInElement = element.contains(clickElement),
            elementInClickElement = clickElement.contains(element);

        if(clickElementInElement || elementInClickElement || clickElement === element){
            return clickElement;
        }
    }
}

function executeClick(value, type, done) {
    var state = this;
    _findUi.call(state, value, type, true, function(error, elements) {
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

        // Find closest button-like decendant
        while(
            element &&
            (!element.matches || !element.matches(types.button.concat('input').join()))
        ){
            element = element.parentNode;
        }

        if(element){
            element.focus();
        }

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

function _changeContenteditableValue(element, text, done){
    element.innerHTML = text;
    done(null, element);
}

function _changeInputValue(element, value, done){
    var inputEvent = new windowScope.KeyboardEvent('input');
    var method = 'initKeyboardEvent' in inputEvent ? 'initKeyboardEvent' : 'initKeyEvent';

    inputEvent[method]('input', true, true, windowScope, null, 3, true, false, true, false, false);
    element.value = value;

    element.dispatchEvent(inputEvent);
    element.blur();

    var changeEvent = document.createEvent('HTMLEvents');
    changeEvent.initEvent('change', false, true);
    element.dispatchEvent(changeEvent);

    done(null, element);
}

function encodeDateValue(date){
    date = new Date(date);
    var value = null;

    if(date && !isNaN(date)){
        value = [
            date.getFullYear(),
            ('0' + (date.getMonth() + 1)).slice(-2),
            ('0' + date.getDate()).slice(-2)
        ].join('-');
    }

    return value;
}

function encodeSelectValue(label, element){
    var selectedOption = Array.from(element.querySelectorAll('option'))
        .find(option => matchElementValue(option, label, true));

    return selectedOption ? selectedOption.value : label;
}

var typeEncoders = {
    date: encodeDateValue,
    'select-one': encodeSelectValue
};

function changeNonTextInput(element, text, done){
    if(element.hasAttribute('contenteditable')){
        return _changeContenteditableValue(element, text, done)
    }

    var value = null;

    if(element.type in typeEncoders){
        value = typeEncoders[element.type](text, element);
    } else {
        value = text;
    }
    return _changeInputValue(element, value, done);
}

function _changeValue(value, type, text, done) {
    var state = this;

    _focus.call(state, value, type, function(error, element) {
        if(error){
            return done(error);
        }

        if(
            element.nodeName === 'INPUT' && ~nonTextInputs.indexOf(element.type) ||
            element.nodeName === 'SELECT' ||
            element.hasAttribute('contenteditable')
        ){
            return changeNonTextInput(element, text, done);
        }

        _pressKeys.call(state, text, function(error){
            if(error){
                return done(error);
            }

            element.blur();

            var changeEvent = document.createEvent('HTMLEvents');
            changeEvent.initEvent('change', false, true);
            element.dispatchEvent(changeEvent);

            done(null, element);
        });
    });
}

function _clear(value, type, done){
    var context = this;
    _focus.call(context, value, type, function(error, element) {
        var element = context.currentContext.activeElement;
        element.value = null;
        done(null, element);
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

function _blur(done) {
    var element = this.currentContext.activeElement;
    element.blur();

    done(null, element);
}

function _scrollTo(value, type, done){
    _findAllUi.call(this, value, type, true, function(error, elements) {
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

function _waitFor(value, type, timeout, done){
    var context = this;
    var startTime = Date.now();

    if(!timeout){
        timeout = 3000;
    }

    function retry(){
        if(Date.now() - startTime > timeout){
            return done(new Error('Timeout finding ' + value));
        }

        _findUi.call(context, value, type, true, function(error, elements){
            if(error){
                window.requestAnimationFrame(() => retry(), 10);
                return;
            }

            done(null, elements[0]);
        });
    }

    retry();
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
        clear: function(value, type) {
            return addTask(_clear.bind(state, value, type));
        },
        changeValue: function(value, type, text) {
            if(arguments.length < 3){
                done = text;
                text = type;
                type = null;
            }
            return addTask(_changeValue.bind(state, value, type, text));
        },
        setValue: function(value, type, text) {
            if(arguments.length < 3){
                done = text;
                text = type;
                type = null;
            }
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
        if: function(value, type, addSubTasks){
            if(arguments.length < 3) {
                addSubTasks = type;
                type = null;
            }

            return addTask(function(done){
                _findUi.call(state, value, type, function(error, element){
                    if(error){
                        return done();
                    }

                    var newDriver = driveUi();

                    addSubTasks(newDriver);

                    newDriver.go(done);
                });
            });
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
        waitFor: function(value, type, timeout){
            if(arguments.length < 3){
                timeout = type;
                type = null;
            }
            return addTask(_waitFor.bind(state, value, type, timeout));
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
