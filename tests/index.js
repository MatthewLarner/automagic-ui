var test = require('tape'),
    driver = require('../');

window.onload = function(){
    driver.init({
        runDelay: 750
    });

    test('do stuff', function(t) {
        t.plan(3);

        driver()
            .click('I am a button')
            .focus('test input', 'field')
            .pressKey('1')
            .wait(2000)
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
};
