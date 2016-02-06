# automagic-ui
Automagic ui driver for web interfaces

User interface integration tests are notoriously brittle.

automagic-ui attempts to ease the pain by providing a descriptive  api for user interactions.

# Usage

```javascript
var driver = require('automagic-ui');

driver.init({
    // Scope to a different document or window such as inside an iframe
    documentScope: //defaults to document
    windowScope: //defaults to window

    // Set a delay before executing commands, also sets a default for driver.wait
    runDelay: //defaults to 0
});
```

Chain some simple interactions

```javascript
driver()
    .click('I am a button')
    .pressKey('1')
    .pressKey('a')
    .click('I am a button')
    //execute the sequence of interactions
    .go(function(error, result) {
        // This would be a good place to write some tests.
        // result is the last element automagic-ui interacted with
    });
```

Create some interactions and execute them later

```javascript

function findLoginForm() {
    driver()
        .findUi('login', 'field'),
        .findUi('password', 'field'),
        .findUi('submit', 'button')
}

driver()
    .do(findLoginForm())
    .focus('login')
    .pressKeys('admin')
    .focus('password')
    .pressKeys('drowssap')
    .click('submit', 'button')
    .go(function(error, result) {
        // Check stuff
    })
```
