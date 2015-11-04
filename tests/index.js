var test = require('tape'),
    driver = require('../');

window.onload = function(){
    test('do stuff', function(t) {
        driver()
            .click('I am a button', 'button')
            .focus('test input', 'field')
            .keyPress('1')
            .wait(200)
            .keyPress('a')
            .blur()
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.ok(result, 'got a result');
            });
    });
};