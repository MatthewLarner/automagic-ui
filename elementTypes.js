module.exports = {
    'button': ['button', 'a', 'input[type=button]', '[role=button]', '[tabindex]'],
    'link': ['a', 'button', 'input[type=button]', '[role=button]'],
    'label': [
        'label:not(a):not(button):not([type=button]):not([role=button])',
        'span:not(a):not(button):not([type=button]):not([role=button])',
        'td:not(a):not(button):not([type=button]):not([role=button])',
        ':not(a):not(button):not([type=button]):not([role=button])'
    ],
    'heading': ['[role=heading]', 'h1', 'h2', 'h3', 'h4'],
    'image': ['img', 'svg', '[role=img]'],
    'field': ['input', 'textarea', 'select', 'label', '[role=textbox]', '[contenteditable]'],
    'section': ['section'],
    'row': ['tr', '[role=row]'],
    'cell': ['td', 'th', '[role=cell]'],
    'item': ['li', '[role=listitem]'],
    'article': ['[role=article]'],
    'region': ['[role=region]'],
    'dialog': ['[role=dialog]'],
    'list': ['ul', 'ol', '[role=list]'],
    'navigation': ['[role=navigation]'],
    'all': ['*'],
    'text': ['*']
};