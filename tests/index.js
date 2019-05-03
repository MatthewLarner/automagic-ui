var test = require('tape'),
    driver = require('../');

window.onload = function(){

    var output = document.createElement('pre');
    output.classList.add('output');
    document.body.appendChild(output);
    originalLog = console.log;
    console.log = function(){
        originalLog.apply(this, arguments);
        output.textContent += Array.from(arguments).join() + '\n';
        output.scrollTop = output.scrollHeight;
    };

    driver.init({
        runDelay: 1,
        keyPressDelay: 1
    });

    test('do stuff', function(t) {
        t.plan(3);

        driver()
            .click('I am a button')
            .focus('test input', 'field')
            .pressKey('1')
            .wait(200)
            .pressKey('a')
            .check(function(result, callback){
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

    test('can find fields with labels with [for] attribute', function(t) {
        t.plan(3);

        driver()
            .findUi('Some field', 'field')
            .go(function(error, result) {
                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'INPUT', 'got correct result');
                t.equal(result.parentElement.previousElementSibling.textContent, 'Some Field', 'got correct label');
            });
    });

    test('can find elements with text in sub-elements', function(t) {
        t.plan(2);

        driver()
            .findUi('My test page')
            .go(function(error, result) {
                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'DIV', 'got correct result');
            });
    });

    test('cant find hidden elements', function(t) {
        t.plan(5);

        driver()
            .findUi('out of scroll viewport')
            .go(function(error, result) {
                t.ok(error, 'out of scroll viewport - should error');
            });

        driver()
            .scrollTo('out of scroll viewport')
            .findUi('out of scroll viewport')
            .go(function(error, result) {
                t.notOk(error, 'out of scroll viewport - should not error');
            });

        driver()
            .findUi('out of browser viewport')
            .go(function(error, result) {
                t.ok(error, 'out of browser viewport - should error');
            });

        driver()
            .findUi('display none')
            .go(function(error, result) {
                t.ok(error, 'display none - should error');
            });

        driver()
            .findUi('visibility hiden')
            .go(function(error, result) {
                t.ok(error, 'visibility hiden - should error');
            });
    });

    test('click and focus', function(t) {
        t.plan(2);

        driver()
            .click('Icon button')
            .go(function(error, result) {
                t.notOk(error, 'should not error');
                t.equal(document.activeElement.tagName, 'BUTTON');
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

    test('alt-text', function(t) {
        driver()
            .findUi('cool image')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'IMG', 'got correct result');
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

    test('test button value', function(t) {
        driver()
            .click('i need a click')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a button');
                t.equal(result.value, 'i need a click', 'got correct button');
            });
    });

    test('test aria-label', function(t) {
        driver()
            .click('click me')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a button');
                t.equal(result.getAttribute('aria-label'), 'click me', 'got correct button');
            });
    });

    test('test aria role button', function(t) {
        driver()
            .click('I\'m like a button')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'LABEL', 'got a "button"');
                t.equal(result.getAttribute('role'), 'button', 'got correct "button"');
            });
    });

    test('test aria role non-button text', function(t) {
        driver()
            .findUi('I\'m like a button', 'label')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'LABEL', 'got a label');
                t.notEqual(result.getAttribute('role'), 'button', 'got correct "button"');
            });
    });

    test('test direct child textContent', function(t) {
        driver()
            .findUi('Direct Text')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'H1', 'got a "H1"');
                t.equal(result.textContent, 'Decendent Text Direct Text', 'got correct "H1"');
            });
    });

    test('test clear', function(t) {
        driver()
            .clear('test input')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.value, '', 'value was correctly cleared');
            });
    });

    test('test changeValue without type', function(t) {
        driver()
            .clear('test input')
            .blur()
            .changeValue('test input', 'new value')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.value, 'new value', 'value was correctly changed');
            });
    });

    test('wait for', function(t) {
        driver()
            .click('I make UI eventually')
            .waitFor('New Async UI')
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'H1', 'got a "H1"');
                t.equal(result.textContent, 'New Async UI');
            });
    });

    test('in - row', function(t) {
        driver()
            .in('bar', 'row', subDriver =>
                subDriver.findUi('action')
            )
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a "button"');
                t.equal(result.getAttribute('class'), 'action2');
            });
    });

    test('in - cell', function(t) {
        driver()
            .in('Foo 2', 'cell', subDriver =>
                subDriver.findUi('Bar 2')
            )
            .go(function(error, result) {
                t.plan(4);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'SPAN', 'got a "span"');
                t.equal(result.textContent, 'Bar 2');
                t.equal(result.parentElement.textContent, 'Foo 2 Bar 2');
            });
    });

    test('in - cell with adjacent', function(t) {
        driver()
            .in('Foo 2 Bar 2', 'cell', subDriver =>
                subDriver.findUi('Bar 2')
            )
            .go(function(error, result) {
                t.plan(4);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'SPAN', 'got a "span"');
                t.equal(result.textContent, 'Bar 2');
                t.equal(result.parentElement.textContent, 'Foo 2 Bar 2');
            });
    });

    test('in - section', function(t) {
        driver()
            .in('Cool content', 'section', subDriver =>
                subDriver.findUi('Hello', 'button')
            )
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a "button"');
                t.ok(result.parentElement.matches('.coolContentSection'), 'Correct section');
            });
    });

    test('in - article', function(t) {
        driver()
            .in('Cool content', 'article', subDriver =>
                subDriver.findUi('Hello', 'button')
            )
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a "button"');
                t.ok(result.parentElement.matches('.coolContentArticle'), 'Correct article');
            });
    });

    test('if - exists', function(t) {
        driver()
            .if('I make UI', subDriver =>
                subDriver.click('I Make UI')
            )
            .go(function(error, result) {
                t.plan(3);

                t.notOk(error, 'should not error');
                t.equal(result.tagName, 'BUTTON', 'got a "button"');
                t.equal(result.textContent, 'I make UI');
            });
    });

    test('if - doesnt exist', function(t) {
        driver()
            .if('Not a thing', subDriver =>
                subDriver.click('Not a thing')
            )
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.notOk(result, 'Element did not exist');
            });
    });

    test('changeValue, decimals', function(t) {
        driver()
            .changeValue('number field', '1.23')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.value, '1.23');
            });
    });

    test('changeValue, date field', function(t) {
        var today = new Date();
        today.setMilliseconds(0);
        today.setSeconds(0);
        today.setMinutes(0);
        today.setUTCHours(0);

        driver()
            .changeValue('date field', today)
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(new Date(result.value).getTime(), today.getTime());
            });
    });

    test('changeValue, date field, string date', function(t) {
        var today = '2020-04-06'

        driver()
            .changeValue('date field', today)
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(new Date(result.value).getTime(), new Date(today).getTime());
            });
    });

    test('changeValue, range field', function(t) {
        driver()
            .changeValue('range field', 30)
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.value, '30');
            });
    });

    test('changeValue, select field', function(t) {
        driver()
            .changeValue('select field', 'Bar')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.value, 'bar');
            });
    });

    test('changeValue, select field, aria-label', function(t) {
        driver()
            .changeValue('select field', 'Fooble')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.value, 'foo');
            });
    });

    test('changeValue, contenteditable', function(t) {
        driver()
            .changeValue('Rich text editor', 'Some text')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.textContent, 'Some text');
            });
    });

    test('changeValue, contenteditable, rich value', function(t) {
        driver()
            .changeValue('Rich text editor', `
                <h1>Some text</h1>
                <p>
                    <ul>
                        <li>Item 1</li>
                        <li>Item 2</li>
                    </ul>
                </p>
            `)
            .go(function(error, result) {
                t.plan(4);

                t.notOk(error, 'should not error');
                t.ok(result.textContent.includes('Some text'));
                t.ok(result.textContent.includes('Item 1'));
                t.ok(result.textContent.includes('Item 2'));
            });
    });

    test('click checkbox', function(t) {
        driver()
            .click('checkbox')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.equal(result.value, 'on');
            });
    });

    test('changeValue, correct events', function(t) {
        var firstInput = document.querySelector('.firstInput');
        var eventsFired = [];

        firstInput.addEventListener('keypress', function() {
            eventsFired.push('keypress');
        });
        firstInput.addEventListener('input', function() {
            eventsFired.push('input');
        });
        firstInput.addEventListener('keyup', function() {
            eventsFired.push('keyup');
        });
        firstInput.addEventListener('keydown', function() {
            eventsFired.push('keydown');
        });

        driver()
            .changeValue('test input', 'a')
            .go(function(error, result) {
                t.plan(2);

                t.notOk(error, 'should not error');
                t.deepEqual(eventsFired, [
                    'keydown',
                    'keypress',
                    'input',
                    'keyup'
                ]);
            });
    });
};
