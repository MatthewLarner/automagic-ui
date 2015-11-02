var predator = require('predator');

var types = {
        'button': ['button', 'a'],
        'label': ['label', 'span', 'div']
    },
    noelementOfType = 'no elements of type ';


function findUi(selectors) {
    return document.querySelectorAll(selectors);
}

function executeFindUi(value, type, assertVisibility, done) {
    window.predator = predator;
    if(!done) {
        done = assertVisibility;
    }

    var elementTypes = types[type];

    if(!elementTypes) {
        return done(new Error(type + ' is not a valid ui type'));
    }

    var elements = findUi(elementTypes);

    if(!elements.length) {
        return done(new Error(noelementOfType + type));
    } else {
        elements = Array.prototype.filter.call(elements, function(element) {
            return ~element.innerText.toLowerCase()
                        .slice(0, value.length)
                        .indexOf(value.toLowerCase()) &&
                        !predator(element).hidden;
        });

        if(!elements.length) {
            return done(new Error(noelementOfType + type + ' with value of ' + value));
        }

        if(elements.length > 1) {
            return done(new Error('more than one visible element of type ' + type + ' with value of ' + value));
        }

        done(null, elements);
    }
}

function executeClick(value, type, done) {
    executeFindUi(value, type, function(error, elements) {
        if(error) {
            done(error);
        } else {
            var clickElement;

            for(var i = 0; i < elements.length; i++) {
                if (typeof elements[i].click === 'function') {
                    clickElement = elements[i];
                    break;
                }
            }

            if(!clickElement) {
                done(new Error('no clickable element with type' + type + ' and value of ' + value));
            } else {
                clickElement.click();
                done(null, clickElement + ' clicked');
            }
        }
    });
}

function executeWait(time, done) {
    setTimeout(done, time || 0);
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
            tasks.push(function(done){
                console.log(location);
            });
            return driverFunctions;
        },
        findUi: function(value, type, assertVisibility){
            tasks.push(executeFindUi.bind(null, value, type, assertVisibility));

            return driverFunctions;
        },
        click: function(value, type){
            tasks.push(executeClick.bind(null, value, type));

            return driverFunctions;
        },
        wait: function(time) {
            tasks.push(executeWait.bind(null, time));

            return driverFunctions;
        },
        go: function(callback) {
            if(tasks.length) {
                runTasks(tasks, callback);
            } else {
                callback(new Error('No tasks defined'));
            }
        }
    };

    return driverFunctions;
}


module.exports = driveUi;
