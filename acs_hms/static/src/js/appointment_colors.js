odoo.define('acs_hms.appointment_colors', [], function () {
    "use strict";

    var stateMapping = {
        'cancelled': 'cancel',
        'posponed': 'postponed',
        'call_back': 'call_to_back',
        'in_consultation': 'consultation',
        'basic_7_floor': 'basic_7_floor',
        'basic_7th_floor': 'basic_7_floor',
        'pause': 'pause',
        'to_invoice': 'to_invoice',
        'gig_insurance': 'gig_insurance',
        'billed': 'billed',
        'done': 'done',
        'blocked': 'blocked',
        'follow_up': 'follow_up',
        'feels_good': 'feels_good',
        'no_answer': 'no_answer',
        'confirm': 'confirm',
        'booked': 'booked',
        'arrived': 'arrived',
        'waiting': 'waiting',
        'treatment': 'treatment',
        'draft': 'draft'
    };

    function applyAppointmentColors() {
        try {
            var stateCells = document.querySelectorAll('.o_list_view td.o_badge_cell[name="state"]');
            for (var i = 0; i < stateCells.length; i++) {
                var stateCell = stateCells[i];
                var badge = stateCell.querySelector('.badge');
                var stateText = '';

                if (badge) {
                    stateText = badge.textContent || badge.innerText;
                } else {
                    stateText = stateCell.textContent || stateCell.innerText;
                    badge = document.createElement('span');
                    badge.className = 'badge acs-state-badge';
                    badge.textContent = stateText;
                    stateCell.innerHTML = '';
                    stateCell.appendChild(badge);
                }

                stateText = stateText.trim().toLowerCase().replace(/\s+/g, '_');
                if (stateText && badge) {
                    var finalState = stateMapping[stateText] || stateText;
                    badge.setAttribute('data-state', finalState);
                    badge.classList.add('acs-state-badge');
                }
            }
        } catch (error) {
            // Error handling without console log
        }
    }

    function applyStatusBarColors() {
        try {
            document.querySelectorAll('.o_statusbar_status button').forEach(function(button) {
                button.classList.remove('acs-statusbar-active');
            });

            var activeButton = document.querySelector('.o_statusbar_status .o_arrow_button_current');

            if (activeButton) {
                var stateText = activeButton.textContent.trim().toLowerCase().replace(/\s+/g, '_');

                if (stateText) {
                    var finalState = stateMapping[stateText] || stateText;
                    activeButton.setAttribute('data-state', finalState);
                    activeButton.classList.add('acs-statusbar-active');
                }
            }
        } catch (error) {
            // Error handling without console log
        }
    }

    function initializeAll() {
        applyAppointmentColors();
        applyStatusBarColors();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initializeAll, 100);
            setTimeout(initializeAll, 500);
            setTimeout(initializeAll, 1000);
        });
    } else {
        setTimeout(initializeAll, 100);
        setTimeout(initializeAll, 500);
        setTimeout(initializeAll, 1000);
    }

    setInterval(function() {
        applyAppointmentColors();
        applyStatusBarColors();
    }, 2000);

    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                setTimeout(function() {
                    applyAppointmentColors();
                    applyStatusBarColors();
                }, 100);
            }
        });
    });

    setTimeout(function() {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }, 2000);
});