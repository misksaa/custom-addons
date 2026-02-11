/** @odoo-module **/
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import BaseCalendarController from "./calendar_controller";
import { AppointmentFormPopup } from "./appointment_form_popup";

class WeekCalendarController extends BaseCalendarController {
    static template = "CalendarByAssignee.WeekView";
    static components = {
        AppointmentFormPopup,
    };
    static props = ["*"];

    setup() {
        super.setup();

        this.onSearchSuggestionSelect = this.onSearchSuggestionSelect.bind(this);

        this.state.weekDays = this.generateWeekDays();
        this.state.currentWeekLabel = this.getCurrentWeekLabel();
    }

    getCurrentWeekLabel = () => {
        const startOfWeek = this.state.weekDays[0].fullDate;
        const endOfWeek = this.state.weekDays[6].fullDate;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const startStr = startOfWeek.getDate() + ' ' + monthNames[startOfWeek.getMonth()];
        const endStr = endOfWeek.getDate() + ' ' + monthNames[endOfWeek.getMonth()] + ' ' + endOfWeek.getFullYear();

        const label = 'Week ' + startStr + ' - ' + endStr;
        return label;
    }

    onSearchSuggestionSelect(suggestion) {
        if (!this.state || !this.state.searchField) return;

        let termValue = '';

        switch (this.state.searchField) {
            case 'physician':
                termValue = suggestion.name;
                break;
            case 'patient':
                termValue = suggestion.name;
                break;
            case 'appointment':
                termValue = suggestion.name;
                break;
            case 'cabin':
                termValue = suggestion.name;
                break;
            case 'status':
                termValue = suggestion.value;
                break;
            case 'phone':
                termValue = suggestion;
                break;
            default:
                termValue = suggestion.name || suggestion.value;
        }

        if (termValue && !this.state.searchTerms[this.state.searchField].includes(termValue)) {
            this.state.searchTerms[this.state.searchField].push(termValue);
            this.state.searchInput = '';
            this.state.showSearchSuggestions = false;

            setTimeout(() => {
                this.refreshData();
            }, 50);
        }
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

    // FIXED: تحميل الأحداث للعرض الأسبوعي بشكل صحيح
    loadEvents = async () => {
        const physicianIds = this.getPhysicianIdsForAPI();

        if (physicianIds.length === 0) {
            this.state.events = {};
            this.state.rawFilteredEvents = {};
            return;
        }

        const startDate = new Date(this.state.weekDays[0].fullDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(this.state.weekDays[6].fullDate);
        endDate.setHours(23, 59, 59, 999);

        try {
            const events = await this.orm.call(
                'hms.appointment',
                'get_calendar_events_by_assignee',
                [this.formatDateTimeForBackend(startDate), this.formatDateTimeForBackend(endDate), physicianIds]
            );

            const filteredEvents = this.filterEventsBySearch(events);
            this.state.rawFilteredEvents = filteredEvents;
            this.state.events = this.organizeWeekEventsByPhysicianAndDate(filteredEvents);

            console.log('Week events organized:', this.state.events);
        } catch (error) {
            console.error('Error loading week events:', error);
            this.state.events = {};
            this.state.rawFilteredEvents = {};
        }
    }

    // FIXED: تنظيم الأحداث للأسبوع بشكل صحيح
    organizeWeekEventsByPhysicianAndDate = (eventsData) => {
        const organized = {};
        const displayPhysicians = this.getFilteredPhysicians();

        // Initialize structure for all physicians and days
        displayPhysicians.forEach(physician => {
            organized[physician.id] = {};
            this.state.weekDays.forEach(day => {
                organized[physician.id][day.date] = {};
                // Initialize time slots for this day
                this.state.timeSlots.forEach(slot => {
                    const slotKey = this.getSlotKey(slot.hour, slot.minute);
                    organized[physician.id][day.date][slotKey] = [];
                });
            });
        });

        // Process events
        Object.entries(eventsData).forEach(([physicianId, physicianEvents]) => {
            const physicianIdInt = parseInt(physicianId);

            // Only process if this physician is in displayPhysicians
            if (displayPhysicians.find(p => p.id === physicianIdInt)) {
                physicianEvents.forEach(event => {
                    try {
                        const eventDate = this.parseDateFromBackend(event.start);
                        if (this.isValidDate(eventDate)) {
                            const eventDateStr = this.formatDateForBackend(eventDate);
                            const eventHour = eventDate.getHours();
                            const eventMinute = eventDate.getMinutes();
                            const slotKey = this.getSlotKey(eventHour, eventMinute);

                            // Add event to the correct slot
                            if (organized[physicianIdInt] &&
                                organized[physicianIdInt][eventDateStr] &&
                                organized[physicianIdInt][eventDateStr][slotKey]) {
                                organized[physicianIdInt][eventDateStr][slotKey].push(event);
                            }
                        }
                    } catch (error) {
                        console.error('Error organizing week event:', error);
                    }
                });
            }
        });

        return organized;
    }

    // Helper method to create consistent slot keys
    getSlotKey = (hour, minute) => {
        return `${hour}_${minute}`;
    }

    // FIXED: الحصول على الأحداث لفتحة زمنية محددة
    getEventsForSlot = (date, hour, minute, physicianId) => {
        const slotKey = this.getSlotKey(hour, minute);
        const events = this.state.events[physicianId]?.[date]?.[slotKey] || [];

        // Filter to ensure we only show events that actually start at this exact time
        const filteredEvents = events.filter(event => {
            try {
                const eventDate = this.parseDateFromBackend(event.start);
                return eventDate.getHours() === hour && eventDate.getMinutes() === minute;
            } catch (error) {
                return false;
            }
        });

        return filteredEvents;
    }

    // FIXED: تحديث البيانات مع تحميل config الوقت
    refreshData = async () => {
        this.state.loading = true;
        try {
            console.log('Loading week data with time configuration');
            await this.loadTimeConfig(); // تحميل إعدادات الوقت أولاً
            await this.loadEvents();
            await this.loadBreakPeriods(); // تحميل فترات الراحة
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
    }

    onPreviousWeek = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setDate(newDate.getDate() - 7);
        this.state.currentDate = newDate;
        this.state.weekDays = this.generateWeekDays(newDate);
        this.state.currentWeekLabel = this.getCurrentWeekLabel();
        this.refreshData();
    }

    onNextWeek = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setDate(newDate.getDate() + 7);
        this.state.currentDate = newDate;
        this.state.weekDays = this.generateWeekDays(newDate);
        this.state.currentWeekLabel = this.getCurrentWeekLabel();
        this.refreshData();
    }

    onToday = () => {
        this.state.currentDate = new Date();
        this.state.weekDays = this.generateWeekDays();
        this.state.currentWeekLabel = this.getCurrentWeekLabel();
        this.refreshData();
    }

    onDayHeaderClick = (day) => {
        const selectedDate = new Date(day.fullDate);
        localStorage.setItem('selected_calendar_date', selectedDate.toISOString());
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_day');
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

export const weekCalendarView = {
    ...listView,
    Controller: WeekCalendarController,
};

registry.category("views").add("week_calendar_view", weekCalendarView);