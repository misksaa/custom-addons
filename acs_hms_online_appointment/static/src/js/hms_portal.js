/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.AcsAppointmentBy = publicWidget.Widget.extend({
    selector: '.acs_appointment',
    events: Object.assign({}, {
        "click input[name='appoitment_by']": '_acsUpdateAppointmentBy',
    }),

    async start() {
        await this._super(...arguments);
        this.$("input[name='appoitment_by']").trigger('click');
    },

    _acsUpdateAppointmentBy: function (ev) {
         var appoitment_by = $(ev.currentTarget);
        var $physician_datas = appoitment_by.parents().find('#acs_physician_datas');
        var $department_datas = appoitment_by.parents().find('#acs_department_datas');
        if (appoitment_by.val()=='department') {
            $physician_datas.addClass('acs_hide');
            $department_datas.removeClass('acs_hide');
            var departments = appoitment_by.parents().find('.appoint_department_panel');
            if (departments.length) {
                departments[0].click();
            }
        } else {
            $department_datas.addClass('acs_hide');
            $physician_datas.removeClass('acs_hide');
            var physicians = appoitment_by.parents().find('.appoint_person_panel');
            if (physicians.length) {
                physicians[0].click();
            }
        }
    },
});

publicWidget.registry.AcsRecordSearch = publicWidget.Widget.extend({
    selector: '#AcsRecordSearch',
    events: Object.assign({}, {
        'keyup': '_acsSearchRecords',
    }),

    _acsSearchRecords() {
        var input, filter, records, rec, i, txtValue;
        input = document.getElementById("AcsRecordSearch");
        filter = input.value.toUpperCase();
        records = document.getElementsByClassName("acs_physician_block");
        for (i = 0; i < records.length; i++) {
            rec = records[i].getElementsByClassName("acs_physician_name")[0];
            txtValue = rec.textContent || rec.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                records[i].style.display = "";
            } else {
                records[i].style.display = "none";
            }
            const physicians = $(this).parents().find('.appoint_person_panel:visible');
            if (physicians.length) {
                physicians[0].click();
            }
        }
        const search_input = document.getElementById("AcsRecordSearch");
        search_input.focus(); 
    },
});

export default {
    AcsRecordSearch: publicWidget.registry.AcsRecordSearch,
    AcsAppointmentBy: publicWidget.registry.AcsAppointmentBy,
};