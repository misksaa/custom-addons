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
    "name": "HMS Spreadsheet Dashboard", 
    "summary": "HMS Spreadsheet Dashboard for users. Separte deashboard detials for doctor, receptionist and admin user so they can get thier related infrmation and statistics from single view",
    "description": """HMS Spreadsheet Dashboard for users. Separte deashboard detials for doctor, receptionist and admin user so they can get thier related infrmation and statistics from single view.
        Hospital Management System hospital dashboard physician dashboard admin dashboard ACS HMS
    """, 
    'version': '1.0.1',
    'category': 'Medical',
    'author': 'Almighty Consulting Solutions Pvt. Ltd.',
    'support': 'info@almightycs.com',
    'website': 'https://www.almightycs.com',
    'license': 'OPL-1',
    "depends": ["acs_hms"],
    "data": [
        "data/data.xml",
    ],
    'images': [
        'static/description/acs_hms_spreadsheet_dashboard_almightycs_odoo.gif',
    ],
    'application': False,
    'sequence': 2,
    'price': 10,
    'currency': 'USD',
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: