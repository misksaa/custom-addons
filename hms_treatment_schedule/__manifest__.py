# -*- coding: utf-8 -*-
{
    "name": "HMS Treatment Schedule",
    "version": "18.0.1.0.0",
    "category": "Healthcare",
    "summary": "Treatment Schedule Management with Custom Calendar View",
    "description": """
        Treatment Schedule Management Module for Healthcare.

        Features:
        - Treatment Schedule management with patient records
        - Custom JavaScript Calendar-like view for scheduling
        - Session types management (8 weeks support)
        - Integration with appointments
        - Professional report generation
    """,
    "author": "HMS Team",
    "website": "https://www.website.com",
    "depends": ["base", "acs_hms", "product", "web"],
    "data": [
        "security/ir.model.access.csv",
        "views/hms_treatment_schedule_views.xml",
        "views/hms_patient_inherit.xml",
        "views/hms_appointment_inherit.xml",
        "report/report_paperformat.xml",
        "report/report_action.xml",
        "report/report_treatment_schedule.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "hms_treatment_schedule/static/src/js/treatment_schedule_controller.js",
            "hms_treatment_schedule/static/src/js/treatment_schedule_view.js",
            "hms_treatment_schedule/static/src/js/session_form_popup.js",
            "hms_treatment_schedule/static/src/xml/treatment_schedule_view.xml",
            "hms_treatment_schedule/static/src/xml/session_form_popup.xml",
            "hms_treatment_schedule/static/src/scss/treatment_schedule_styles.scss",
        ],
    },
    "installable": True,
    "auto_install": False,
    "application": True,
    "license": "LGPL-3",
}