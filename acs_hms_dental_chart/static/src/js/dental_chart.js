/** @odoo-module **/

import { whenReady } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
    
whenReady(() => {

    // Activate popover
    $(function () {
      $('[data-toggle="popover"]').popover({
        html: true,
        sanitize: false
      })
    })

    //close on focus
    $('.popover-dismiss').popover({
      trigger: 'focus'
    })

    $("#AcsProcedureRecordSearch").on('keyup', function() {
        var input, filter, records, rec, i, txtValue;
        input = document.getElementById("AcsProcedureRecordSearch");
        filter = input.value.toUpperCase();
        records = document.getElementsByClassName("acs_dental_procedure");
        for (i = 0; i < records.length; i++) {
            rec = records[i].getElementsByClassName("acs_procedure_label")[0];
            txtValue = rec.textContent || rec.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                records[i].style.display = "";
            } else {
                records[i].style.display = "none";
            }
        }
    });

});