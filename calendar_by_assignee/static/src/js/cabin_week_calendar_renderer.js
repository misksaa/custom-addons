/** @odoo-module **/
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import BaseCalendarController from "./calendar_controller";
import { AppointmentFormPopup } from "./appointment_form_popup";

class CabinWeekCalendarController extends BaseCalendarController {
    static template = "CalendarByAssignee.CabinWeekView";
    static components = {
        AppointmentFormPopup,
    };

    setup() {
        super.setup();

        this.onSearchSuggestionSelect = this.onSearchSuggestionSelect.bind(this);

        const storedDate = localStorage.getItem('selected_calendar_date');
        if (storedDate) {
            const selectedDate = new Date(storedDate);
            if (this.isValidDate(selectedDate)) {
                this.state.currentDate = selectedDate;
                localStorage.removeItem('selected_calendar_date');
            }
        }

        // FIXED: إنشاء weekDays أولاً قبل currentWeekLabel
        this.state.weekDays = this.getWeekDays(this.state.currentDate);
        this.state.currentWeekLabel = this.getCurrentWeekLabel();
        this.state.rawFilteredEvents = {};
        this.state.events = {};
    }

    async willStart() {
        super.willStart();
        // Load data when component starts
        await this.initializeData();
    }

    getCurrentWeekLabel = () => {
        const weekStart = new Date(this.state.currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        if (weekStart.getMonth() === weekEnd.getMonth()) {
            return `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
        } else {
            return `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
        }
    }

    getWeekDays = (date) => {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const days = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + i);

            days.push({
                date: this.formatDateForBackend(dayDate),
                day: dayDate.getDate(),
                month: monthNames[dayDate.getMonth()],
                name: dayNames[dayDate.getDay()],
                shortName: dayNames[dayDate.getDay()].substring(0, 3),
                fullDate: dayDate
            });
        }
        return days;
    }

    // Handle search suggestion selection
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

    getFilteredCabins = () => {
        const hasSearch = this.hasActiveSearch();

        if (!hasSearch) {
            let cabinsToShow = this.state.cabins || [];

            if (this.state.selectedCabinIds.length > 0) {
                cabinsToShow = cabinsToShow.filter(cabin =>
                    this.state.selectedCabinIds.includes(cabin.id)
                );
            }

            return cabinsToShow;
        }

        let filteredCabins = this.state.cabins || [];

        if (this.state.selectedCabinIds.length > 0) {
            filteredCabins = filteredCabins.filter(cabin =>
                this.state.selectedCabinIds.includes(cabin.id)
            );
        }

        if (this.state.rawFilteredEvents && Object.keys(this.state.rawFilteredEvents).length > 0) {
            const cabinIdsWithEvents = Object.keys(this.state.rawFilteredEvents).map(id => parseInt(id));
            filteredCabins = filteredCabins.filter(cabin =>
                cabinIdsWithEvents.includes(cabin.id)
            );
        } else {
            return [];
        }

        return filteredCabins;
    }

    initializeData = async () => {
        this.state.cabins = await this.loadCabins();
        this.state.physicians = await this.loadPhysicians();

        this.setupSearchState();
        await this.refreshData();
    }

    // Refresh data including events
    refreshData = async () => {
        this.state.loading = true;
        try {
            await this.loadTimeConfig();
            await this.loadEvents();
            await this.loadCabinBreakPeriods();
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
    }

    // Load events for cabin week view
    loadEvents = async () => {
        const cabinIds = this.getCabinIdsForAPI();
        const physicianIds = this.getPhysicianIdsForAPI();

        if (cabinIds.length === 0) {
            this.state.events = {};
            this.state.rawFilteredEvents = {};
            return;
        }

        const weekStart = new Date(this.state.currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        weekEnd.setHours(23, 59, 59, 999);

        try {
            const events = await this.orm.call(
                'hms.appointment',
                'get_calendar_events_by_cabin_and_physician',
                [this.formatDateTimeForBackend(weekStart), this.formatDateTimeForBackend(weekEnd), cabinIds, physicianIds]
            );

            const filteredEvents = this.filterEventsBySearch(events);
            this.state.rawFilteredEvents = filteredEvents;
            this.state.events = this.organizeWeekEventsByCabinAndDate(filteredEvents);

        } catch (error) {
            this.state.events = {};
            this.state.rawFilteredEvents = {};
        }
    }

    // Organize week events by cabin and date
    organizeWeekEventsByCabinAndDate = (eventsData) => {
        const organized = {};
        const displayCabins = this.getFilteredCabins();

        // Initialize structure
        displayCabins.forEach(cabin => {
            organized[cabin.id] = {};
            this.state.weekDays.forEach(day => {
                organized[cabin.id][day.date] = {};
                this.state.timeSlots.forEach(slot => {
                    const slotKey = `${slot.hour}_${slot.minute}`;
                    organized[cabin.id][day.date][slotKey] = [];
                });
            });
        });

        Object.entries(eventsData).forEach(([cabinId, cabinEvents]) => {
            const cabinIdInt = parseInt(cabinId);
            if (displayCabins.find(c => c.id === cabinIdInt)) {
                cabinEvents.forEach(event => {
                    try {
                        const eventDate = this.parseDateFromBackend(event.start);
                        if (this.isValidDate(eventDate)) {
                            const eventDateStr = this.formatDateForBackend(eventDate);
                            const eventHour = eventDate.getHours();
                            const eventMinute = eventDate.getMinutes();
                            const slotKey = `${eventHour}_${eventMinute}`;

                            if (organized[cabinIdInt] &&
                                organized[cabinIdInt][eventDateStr] &&
                                organized[cabinIdInt][eventDateStr][slotKey] !== undefined) {
                                organized[cabinIdInt][eventDateStr][slotKey].push(event);
                            }
                        }
                    } catch (error) {
                        console.error('Error organizing event:', error);
                    }
                });
            }
        });

        return organized;
    }

    // Get events for specific day and time slot
    getEventsForSlot = (cabinId, date, hour, minute = 0) => {
        const slotKey = `${hour}_${minute}`;
        const events = this.state.events[cabinId]?.[date]?.[slotKey] || [];
        return events;
    }

    onPreviousWeek = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setDate(newDate.getDate() - 7);
        this.state.currentDate = newDate;
        this.state.currentWeekLabel = this.getCurrentWeekLabel();
        this.state.weekDays = this.getWeekDays(this.state.currentDate);
        this.refreshData();
    }

    onNextWeek = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setDate(newDate.getDate() + 7);
        this.state.currentDate = newDate;
        this.state.currentWeekLabel = this.getCurrentWeekLabel();
        this.state.weekDays = this.getWeekDays(this.state.currentDate);
        this.refreshData();
    }

    onDayHeaderClick = (day) => {
        localStorage.setItem('selected_calendar_date', day.fullDate.toISOString());
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_cabin_day');
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

export const cabinWeekCalendarView = {
    ...listView,
    Controller: CabinWeekCalendarController,
};

registry.category("views").add("cabin_week_calendar_view", cabinWeekCalendarView);