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
            .wait(200)
            .pressKey('a')
            .click('I am a button')
            .blur()
            .go(function(error, result) {
                t.plan(2);

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
};
