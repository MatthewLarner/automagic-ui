var test = require('tape'),
    driver = require('../');

window.onload = function(){
    test('do stuff', function(t) {
        driver()
            .click('I am a button')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.ok(result, 'got a result');
            });
    });
};
