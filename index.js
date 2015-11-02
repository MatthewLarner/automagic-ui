var predator = require('predator');

var types = {
        'button': ['button', 'a'],
        'label': ['label', 'span', 'div']
    },
    noelementOfType = 'no elements of type ';


function findUi(selectors) {
    return document.querySelectorAll(selectors);
}

function executeFindUi(value, type, done) {
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

            if(currentElement.textContent.toLowerCase() === value.toLowerCase() && !predator(currentElement).hidden) {
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

function executeClick(value, type, done) {
    executeFindUi(value, type, function(error, element) {
        if(error) {
            done(error);
        } else {
            var rect = element.getBoundingClientRect();

            var clickElement = document.elementFromPoint(rect.left, rect.top);
            clickElement = (clickElement.textContent.toLowerCase() === value.toLowerCase()) && clickElement;

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
                console.log(location, done);
            });
            return driverFunctions;
        },
        findUi: function(value, type){
            tasks.push(executeFindUi.bind(null, value, type));

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
