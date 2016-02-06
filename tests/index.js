var test = require('tape'),
    driver = require('../');

window.onload = function(){
    driver.init({
        runDelay: 750
    });

    test('do stuff', function(t) {
        driver()
            .click('I am a button')
            .focus('test input', 'field')
            .pressKey('1')
            .wait(2000)
            .pressKey('a')
            .click('I am a button')
            .blur()
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.ok(result, 'got a result');
            });
    });
};
