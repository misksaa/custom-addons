{
    'name': 'Test Addon',
    'version': '18.0.1.0.0',
    'summary': 'A simple test addon for Odoo 18',
    'description': """
Test Addon
==========
This module adds a 'Test' menu to the Odoo backend.
    """,
    'category': 'Tools',
    'author': 'Your Name',
    'depends': ['base'],
    'data': [
        'views/test_menus.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
