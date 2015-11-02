# predator

Finds the exposed box, if there is on, of a child DOM element.

Usefull if you want to check if an element is visible to the user, and how much of it.

## usage

    npm install predator

Then

    var predator = require('predator');

    var box = predator(someElement);

    ->

    {
        top: offset from top of screen
        left: offset from left of screen
        right: right edge offset from left of screen
        bottom: bottom edge offset from top of screen
        height: height of the exposed region
        width: width of the exposed region
        hidden: true if the element is completely obscured from view
        original: the original result of child.getBoundingClientRect()
    }

## performance

predator should be fast enough to use in a render loop, even on mobile devices.