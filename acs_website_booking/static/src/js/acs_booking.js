/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";

publicWidget.registry.AcsBookingDatePicker = publicWidget.Widget.extend({
    selector: '#ACSBookingDatePicker',

    async start() {
        await this._super(...arguments);
        this._acsLoadPicker();
    },

    _acsLoadPicker() {
        var slot_date_input = $("input[name='slot_date']");
        var last_date = $("input[name='last_date']");
        
        var disable_dates = $("input[name='disable_dates']");

        function DisableDates(date) {
            var string = jQuery.datepicker.formatDate('yy-mm-dd', date);
            return [disable_dates.val().indexOf(string) == -1];
        }
    
        var languages = document.getElementsByClassName("js_change_lang active");
        if (languages.length > 0) { 
            var lang = languages[0].getAttribute('data-url_code', '');
            if (lang.startsWith('es')) {        
                $.datepicker.regional['es'] = {
                    closeText: 'Cerrar',
                    prevText: '< Ant',
                    nextText: 'Sig >',
                    currentText: 'Hoy',
                    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    monthNamesShort: ['Ene','Feb','Mar','Abr', 'May','Jun','Jul','Ago','Sep', 'Oct','Nov','Dic'],
                    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
                    dayNamesShort: ['Dom','Lun','Mar','Mié','Juv','Vie','Sáb'],
                    dayNamesMin: ['Do','Lu','Ma','Mi','Ju','Vi','Sá'],
                    weekHeader: 'Sm',
                    dateFormat: 'yy-mm-dd',
                    firstDay: 1,
                    isRTL: false,
                    showMonthAfterYear: false,
                    yearSuffix: ''
                };
                $.datepicker.setDefaults($.datepicker.regional['es']);
            }
        }


        $("#ACSBookingDatePicker").datepicker({
            numberOfMonths: 1,
            format: 'yyyy-mm-dd',
            beforeShowDay: DisableDates, 
            onSelect: function(date) {
                slot_date_input.val(date);
                var records = document.getElementsByClassName("acs_booking_slot");
                var i;
                var slot_to_show = false;
                var acs_no_slots = document.getElementsByClassName("acs_no_slots");
                for (i = 0; i < records.length; i++) {
                    var rec_date = records[i].getAttribute('data-date');
                    if (date==rec_date) {
                        records[i].style.display = "";
                        slot_to_show = true;
                    } else {
                        records[i].style.display = "none";
                    }
                }
                if (slot_to_show==true) {
                    acs_no_slots[0].style.display = "none";
                } else {
                    acs_no_slots[0].style.display = "";
                }
            },
            minDate: new Date(),
            maxDate: new Date(last_date.val()),
            selectWeek: true,
            inline: true,
        });

        $('.ui-datepicker-current-day').click();
        slot_date_input.val(new Date());
    },
});

publicWidget.registry.AcsSlotSeleted = publicWidget.Widget.extend({
    selector: '.acs_booking_slot',
    events: Object.assign({}, {
        "click": '_acsSelectclickedSlot',
    }),

    _acsSelectclickedSlot: function (ev) {
        $('.acs_booking_slot').click(function() {
            var schedule_slot_input = $("input[name='schedule_slot_id']");
            var acs_slot_selected = document.getElementsByClassName("acs_slot_selected")[0];
            var acs_slot_not_selected = document.getElementsByClassName("acs_slot_not_selected")[0];
            var $each_appointment_slot = $(this).parents().find('.acs_booking_slot');
            $each_appointment_slot.removeClass('acs_active')
            
            if ($(this).hasClass('acs_active') == true) {
                $(this).removeClass('acs_active');            
                schedule_slot_input.val('');
                if (typeof acs_slot_selected !== 'undefined') {
                    acs_slot_selected.style.display = "none";
                }
                if (typeof acs_slot_not_selected !== 'undefined') {
                    acs_slot_not_selected.style.display = "";
                }
            } else {
                $(this).addClass('acs_active');
                var slotline_id = $(this).data('slotline-id');
                schedule_slot_input.val(slotline_id);
                if (typeof acs_slot_selected !== 'undefined') {
                    acs_slot_selected.style.display = "";
                }
                if (typeof acs_slot_not_selected !== 'undefined') {
                    acs_slot_not_selected.style.display = "none";
                }
            }
        });
    },
});

export default {
    AcsBookingDatePicker: publicWidget.registry.AcsBookingDatePicker,
    AcsSlotSeleted: publicWidget.registry.AcsSlotSeleted,
};