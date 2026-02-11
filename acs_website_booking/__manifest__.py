# -*- coding: utf-8 -*-
#╔══════════════════════════════════════════════════════════════════════╗
#║                                                                      ║
#║                  ╔═══╦╗       ╔╗  ╔╗     ╔═══╦═══╗                   ║
#║                  ║╔═╗║║       ║║ ╔╝╚╗    ║╔═╗║╔═╗║                   ║
#║                  ║║ ║║║╔╗╔╦╦══╣╚═╬╗╔╬╗ ╔╗║║ ╚╣╚══╗                   ║
#║                  ║╚═╝║║║╚╝╠╣╔╗║╔╗║║║║║ ║║║║ ╔╬══╗║                   ║
#║                  ║╔═╗║╚╣║║║║╚╝║║║║║╚╣╚═╝║║╚═╝║╚═╝║                   ║
#║                  ╚╝ ╚╩═╩╩╩╩╩═╗╠╝╚╝╚═╩═╗╔╝╚═══╩═══╝                   ║
#║                            ╔═╝║     ╔═╝║                             ║
#║                            ╚══╝     ╚══╝                             ║
#║                  SOFTWARE DEVELOPED AND SUPPORTED BY                 ║
#║                ALMIGHTY CONSULTING SOLUTIONS PVT. LTD.               ║
#║                      COPYRIGHT (C) 2016 - TODAY                      ║
#║                      https://www.almightycs.com                      ║
#║                                                                      ║
#╚══════════════════════════════════════════════════════════════════════╝
{
    'name' : 'Website Booking Management',
    'summary' : 'Allow customers to Book Appointment from website by AlmightyCS',
    'description' : """Allow customers to Book Appointment from website by AlmightyCS""",
    'version': '1.0.3',
    'category': 'Extra-Addons',
    'author': 'Almighty Consulting Solutions Pvt. Ltd.',
    'website': 'https://www.almightycs.com',
    'license': 'OPL-1',
    'depends' : ['website','hr'],
    'data' : [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/res_config_settings.xml',
        'views/schedule_view.xml',
        'views/template.xml',
        'wizard/booking_scheduler_view.xml',
        'views/menu_item.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'acs_website_booking/static/src/lib/jquery-ui.min.js',
            'acs_website_booking/static/src/lib/jquery-ui.min.css',

            'acs_website_booking/static/src/js/acs_booking.js',
            'acs_website_booking/static/src/scss/custom.scss',
        ]
    },
    'images': [
        'static/description/acs_hms_online_booking_almightycs_cover.jpg',
    ],
    'installable': True,
    'application': True,
    'sequence': 1,
    'price': 50,
    'currency': 'USD',
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: