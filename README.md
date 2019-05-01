# automagic-ui
Automagic ui driver for web interfaces

User interface integration tests are notoriously brittle.

automagic-ui attempts to ease the pain by providing a descriptive  api for user interactions.

## Usage

```javascript
var driver = require('automagic-ui');

driver.init({
    // Scope to a different document or window such as inside an iframe
    documentScope: // defaults to document
    windowScope: // defaults to window

    // Set a delay before executing commands, also sets a default for driver.wait
    runDelay: // defaults to 0

    // Set a delay between key-presses
    keyPressDelay: // defaults to 50
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

Target elements by RegExp

```javascript

driver()
    .findUi(/Welcome .*/)
    .go(function(error, result) {
        // Welcome message for some user found
    })
```

## Philosophy

automagic-ui acts like a human tester, you described things like you would describe them to a human.
If automagic-ui can't test your UI, your UI might have some usability issues, especially for users that
are sight-limited.

### Why can't I use class/id/attribute selectors?

Muliple reasons:

 - Users cant see DOM attributes, you woudln't say "Click .foo[bar=3] > *:first-child" to a person.
 - The DOM structure of your application is not coupled to it's usability. When tests use dom-selectors to assert things, they break when the implementation changes, and they often continue to pass even when the UI is broken. If you set a button to `display: none`, a person cannot click it, but your tests will still pass.
 - If you can't target an element by semantic labels, you need to improve your application.

## API

### navigate(location)

Set's window.url to location.

### findUi(semanticLabel[, type, returnArray])

Find and return some UI that semantically matches `semanticLabel` where `semanticLabel` can be the elements `text`, `title`, `placeholder`, `aria-label`, `value`, or `alt` if the element is an `IMG`.

Elements will then be filtered by `type` where `type` is one of:
 - button: `<button>, <a>, ...`
 - label: `<label>, <span>, ...`
 - heading: `[role=heading], <h1>, <h2>, ...`
 - image: `<img>, <svg>, [role=img] ...`
 - field: `<input>, <textarea>, <select>, <label>`
 - ...
 - text: Anything.
 - all: Anything.

A list of all the types can be found at [elementTypes.js](./elementTypes.js)

By default, returns the best-match element, but you can get all of the ordered elements  by passing `true` for `returnArray`

### getLocation()

Get's window.location

### focus(semanticLabel[, type])

Do `findUi(semanticLabel[, type])` and `.focus()` the matched element.

### blur()

Blur the currently focused element.

### click(value, type)

 - Do `findUi(semanticLabel[, type])`
 - Sort by likelyness that the element would be the recipient of a click:
    (Weighting here)[https://github.com/MatthewLarner/automagic-ui/blob/master/index.js#L6]
 - `.click()` the matched element.

### pressKey(character)

Emulates a key-press on a keyboard.
Usually used after calling `.focus()`

### pressKeys(string)

Emulates multiple key-presses on a keyboard.
Usually used after calling `.focus()`

the delay between each keypress is [configurable during initialisation](#usage).

### changeValue(semanticLabel[, type], text)

 - Do `.focus(semanticLabel[, type])`
 - Then `.pressKeys(text)`
 - Then `.blur()`
 - Then trigger a change event on the target element for good measure.

### setValue(semanticLabel[, type], text)

 - Do `.focus(semanticLabel[, type])`
 - Then set `element.value = text`

### getValue(semanticLabel[, type], text)

 - Do `.focus(semanticLabel[, type])`
 - Then get `element.value` if it has a `value` property or otherwise `element.textContent`

### wait(time)

Waits for `time`

### do(driver)

execute all the actions from another `driver`

### check(action)

Do some custom action.

`action` will be called with `action(lastResult, callback)`

### if(semanticLabel[, type], addSubTasks)

Caution! This function is not inteded to be used for any case other than UI's that are specifically built with random interface elements, such as those used in security flows. It is not recommended that you use it to predict state based on the presence of UI.

 - Do `findUi(semanticLabel[, type])`
 - Ff the UI could not be found, skip the rest
 - Create a new driver
 - Then call `addSubTasks(newDriver)`
 - Then execute that driver.

### in(semanticLabel[, type], addSubTasks)

 - Do `findUi(semanticLabel[, type])`
 - Then create a new driver who's context is set to the result
 - Then call `addSubTasks(newDriver)`
 - Then execute that driver.

### scrollTo(semanticLabel[, type])

 - Do `findUi(semanticLabel[, type])`
 - Scroll the resultant element into view

### waitFor(semanticLabel[, type])

### go(callback)

Execute the driver

```js
.go(function(error, result){
    if(error){
        return console.log('one of the steps failed:', error);
    }

    console.log('Successfully completed all steps. Last result was:', result);
})
```
