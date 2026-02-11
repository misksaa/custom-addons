/** @odoo-module **/
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import BaseCalendarController from "./calendar_controller";
import { AppointmentFormPopup } from "./appointment_form_popup";

class MonthCalendarController extends BaseCalendarController {
    static template = "CalendarByAssignee.MonthView";
    static components = {
        AppointmentFormPopup,
    };
    static props = ["*"]; // السماح بجميع props بدون تحقق

    setup() {
        super.setup();

        this.state.monthDays = this.generateMonthDays();
        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.state.rawFilteredEvents = {};
    }

    getCurrentMonthLabel = () => {
        const date = this.state.currentDate;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return monthNames[date.getMonth()] + ' ' + date.getFullYear();
    }

    getFilteredPhysicians = () => {
        const hasSearch = this.hasActiveSearch();

        if (hasSearch && this.state.rawFilteredEvents) {
            const physicianIdsWithEvents = new Set();

            Object.keys(this.state.rawFilteredEvents).forEach(physicianId => {
                const physicianIdInt = parseInt(physicianId);
                const physicianEvents = this.state.rawFilteredEvents[physicianId];

                if (physicianEvents && physicianEvents.length > 0) {
                    physicianIdsWithEvents.add(physicianIdInt);
                }
            });

            const filtered = this.state.physicians.filter(physician =>
                physicianIdsWithEvents.has(physician.id)
            );
            return filtered;
        }

        if (this.state.selectedPhysicianIds.length > 0) {
            return this.state.physicians.filter(physician =>
                this.state.selectedPhysicianIds.includes(physician.id)
            );
        }

        return this.state.physicians;
    }

    // TIME CONFIGURATION: Enhanced load events for month view
    loadEvents = async () => {
        const physicianIds = this.getPhysicianIdsForAPI();

        if (physicianIds.length === 0) {
            this.state.events = {};
            this.state.rawFilteredEvents = {};
            return;
        }

        const firstDay = new Date(this.state.currentDate.getFullYear(), this.state.currentDate.getMonth(), 1);
        const lastDay = new Date(this.state.currentDate.getFullYear(), this.state.currentDate.getMonth() + 1, 0);

        const startDate = new Date(firstDay);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(lastDay);
        endDate.setHours(23, 59, 59, 999);

        try {
            const events = await this.orm.call(
                'hms.appointment',
                'get_calendar_events_by_assignee',
                [this.formatDateTimeForBackend(startDate), this.formatDateTimeForBackend(endDate), physicianIds]
            );

            const filteredEvents = this.filterEventsBySearch(events);
            this.state.rawFilteredEvents = filteredEvents;
            this.state.events = this.organizeEventsByPhysicianDateAndTimeSlot(filteredEvents);
        } catch (error) {
            this.state.events = {};
            this.state.rawFilteredEvents = {};
        }
    }

    // TIME CONFIGURATION: Organize events by physician, date and 30-minute time slot
    organizeEventsByPhysicianDateAndTimeSlot = (eventsData) => {
        const organized = {};
        const displayPhysicians = this.getFilteredPhysicians();

        displayPhysicians.forEach(physician => {
            organized[physician.id] = {};
            this.state.monthDays.forEach(day => {
                if (day.isCurrentMonth) {
                    organized[physician.id][day.date] = {};
                    // Initialize all time slots for this day
                    this.state.timeSlots.forEach(slot => {
                        const slotKey = `${slot.hour}_${slot.minute}`;
                        organized[physician.id][day.date][slotKey] = [];
                    });
                }
            });
        });

        Object.entries(eventsData).forEach(([physicianId, physicianEvents]) => {
            const physicianIdInt = parseInt(physicianId);
            if (displayPhysicians.find(p => p.id === physicianIdInt)) {
                physicianEvents.forEach(event => {
                    try {
                        const eventDate = this.parseDateFromBackend(event.start);
                        if (this.isValidDate(eventDate)) {
                            const eventDateStr = this.formatDateForBackend(eventDate);
                            const eventHour = eventDate.getHours();
                            const eventMinute = eventDate.getMinutes();

                            // Round to nearest 30-minute slot
                            const roundedMinute = eventMinute < 30 ? 0 : 30;
                            const slotKey = `${eventHour}_${roundedMinute}`;

                            if (organized[physicianIdInt] &&
                                organized[physicianIdInt][eventDateStr] &&
                                organized[physicianIdInt][eventDateStr][slotKey]) {
                                organized[physicianIdInt][eventDateStr][slotKey].push(event);
                            }
                        }
                    } catch (error) {}
                });
            }
        });

        return organized;
    }

    // TIME CONFIGURATION: Get events for specific day and time slot (30-minute precision)
    getEventsForDayAndTimeSlot = (physicianId, date, hour, minute = 0) => {
        const slotKey = `${hour}_${minute}`;
        const events = this.state.events[physicianId]?.[date]?.[slotKey] || [];
        return events;
    }

    // TIME CONFIGURATION: Enhanced refresh to include time config
    refreshData = async () => {
        this.state.loading = true;
        try {
            console.log('Loading month data with time configuration');
            await this.loadEvents();
            await this.loadTimeConfig(); // TIME CONFIGURATION: Load time config
            await this.loadBreakPeriods(); // Load break periods
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
    }

    onDayHeaderClick = (day) => {
        const selectedDate = new Date(day.fullDate);
        localStorage.setItem('selected_calendar_date', selectedDate.toISOString());
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_day');
    }

    onPreviousMonth = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        this.state.currentDate = newDate;
        this.state.monthDays = this.generateMonthDays();
        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.refreshData();
    }

    onNextMonth = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        this.state.currentDate = newDate;
        this.state.monthDays = this.generateMonthDays();
        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.refreshData();
    }

    onToday = () => {
        this.state.currentDate = new Date();
        this.state.monthDays = this.generateMonthDays();
        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.refreshData();
    }

    onSwitchToDayView = () => {
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_day');
    }
    onSwitchToWeekView = () => {
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_week');
    }
    onSwitchToMonthView = () => {
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_month');
    }
    onSwitchToCabinDayView = () => {
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_cabin_day');
    }
    onSwitchToCabinMonthView = () => {
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_cabin_month');
    }
    onSwitchToCabinWeekView = () => {
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_cabin_week');
    }
    onSwitchToBaseListView = () => {
        this.action.doAction('acs_hms.action_appointment');
    }
}

export const monthCalendarView = {
    ...listView,
    Controller: MonthCalendarController,
};

registry.category("views").add("month_calendar_view", monthCalendarView);