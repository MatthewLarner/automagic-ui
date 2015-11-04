var test = require('tape'),
    driver = require('../');

window.onload = function(){
    test('do stuff', function(t) {
        driver()
            .focus('test input', 'field')
            .keyPress('1')
            .keyPress('a')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.ok(result, 'got a result');
            });
    });
};