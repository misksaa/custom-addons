# -*- coding: utf-8 -*-
#╔══════════════════════════════════════════════════════════════════╗
#║                                                                  ║
#║                ╔═══╦╗       ╔╗  ╔╗     ╔═══╦═══╗                 ║
#║                ║╔═╗║║       ║║ ╔╝╚╗    ║╔═╗║╔═╗║                 ║
#║                ║║ ║║║╔╗╔╦╦══╣╚═╬╗╔╬╗ ╔╗║║ ╚╣╚══╗                 ║
#║                ║╚═╝║║║╚╝╠╣╔╗║╔╗║║║║║ ║║║║ ╔╬══╗║                 ║
#║                ║╔═╗║╚╣║║║║╚╝║║║║║╚╣╚═╝║║╚═╝║╚═╝║                 ║
#║                ╚╝ ╚╩═╩╩╩╩╩═╗╠╝╚╝╚═╩═╗╔╝╚═══╩═══╝                 ║
#║                          ╔═╝║     ╔═╝║                           ║
#║                          ╚══╝     ╚══╝                           ║
#║               SOFTWARE DEVELOPED AND SUPPORTED BY                ║
#║          ALMIGHTY CONSULTING SOLUTIONS PRIVATE LIMITED           ║
#║                   COPYRIGHT (C) 2016 - TODAY                     ║
#║                   https://www.almightycs.com                     ║
#║                                                                  ║
#╚══════════════════════════════════════════════════════════════════╝
{
    'name' : 'HMS Portal User Image',
    'summary': 'Added option to add image from the portal view for users by AlmightyCS',
    'version': '1.0.1',
    'category' : 'Extra Tools',
    'depends' : ['portal'],
    'author': 'Almighty Consulting Solutions Pvt. Ltd.',
    'website': 'http://www.almightycs.com',
    'license': 'OPL-1',
    'description': """Added option to set user image from the portal view by AlmightyCS""",
    'data': [
        'views/template.xml',
    ],
    'images': [
        'static/description/acs_portal_user_image_almightycs_odoo_cover.jpg',
    ],
    'installable': True,
    'application': False,
    'sequence': 2,
    'price': 21,
    'currency': 'USD',
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: