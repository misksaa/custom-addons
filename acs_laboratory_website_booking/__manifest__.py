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
    'name' : 'Laboratory Website Booking Management',
    'summary' : 'Allow patients to Book Laboratory Appointment from website by AlmightyCS',
    'description' : """Allow patients to Book Laboratory Appointment from website by AlmightyCS""",
    'version': '1.0.2',
    'category': 'Medical',
    'author': 'Almighty Consulting Solutions Pvt. Ltd.',
    'website': 'https://www.almightycs.com',
    'license': 'OPL-1',
    'depends' : ['acs_website_booking','acs_laboratory', 'acs_hms'],
    'data' : [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/data.xml',
        'wizard/payment_link_views.xml',
        'views/hms_base_view.xml',
        'views/template.xml',
        'views/menu_item.xml',
    ],
    'images': [
        'static/description/acs_hms_online_booking_almightycs_cover.jpg',
    ],
    'installable': True,
    'application': True,
    'sequence': 1,
    'price': 100,
    'currency': 'EUR',
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: