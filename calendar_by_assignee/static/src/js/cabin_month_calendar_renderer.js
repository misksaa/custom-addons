/** @odoo-module **/
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import BaseCalendarController from "./calendar_controller";
import { AppointmentFormPopup } from "./appointment_form_popup";

class CabinMonthCalendarController extends BaseCalendarController {
    static template = "CalendarByAssignee.CabinMonthView";
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

        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.state.monthDays = this.generateMonthDays();
        this.state.rawFilteredEvents = {};
        this.state.events = {};
    }

    async willStart() {
        super.willStart();
        // Load data when component starts
        await this.initializeData();
    }

    getCurrentMonthLabel = () => {
        const date = this.state.currentDate;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }

    // FIX: Add method to handle search suggestion selection
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

    // FIXED: Initialize data properly with async loading
    initializeData = async () => {
        try {
            console.log('Initializing cabin month calendar data...');

            // Load initial data
            this.state.cabins = await this.loadCabins();
            this.state.physicians = await this.loadPhysicians();

            // Set up search state
            this.setupSearchState();

            // Load time configuration first
            await this.loadTimeConfig();

            // Load events immediately
            await this.refreshData();

            console.log('Cabin month calendar data loaded successfully');
        } catch (error) {
            console.error('Error initializing cabin month calendar:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        }
    }

    // FIXED: Enhanced refresh data to properly handle time configuration
    refreshData = async () => {
        this.state.loading = true;
        try {
            console.log('Loading cabin month data with time configuration');

            // Load time configuration first (critical for time slots)
            await this.loadTimeConfig();

            // Then load events
            await this.loadEvents();

            // Load cabin break periods
            await this.loadCabinBreakPeriods();

        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
    }

    // FIXED: Load events for cabin month view - Match physician month view logic
    loadEvents = async () => {
        const cabinIds = this.getCabinIdsForAPI();
        const physicianIds = this.getPhysicianIdsForAPI();

        if (cabinIds.length === 0) {
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
            console.log('Loading cabin month events:', {
                startDate: this.formatDateTimeForBackend(startDate),
                endDate: this.formatDateTimeForBackend(endDate),
                cabinIds: cabinIds,
                physicianIds: physicianIds
            });

            const events = await this.orm.call(
                'hms.appointment',
                'get_calendar_events_by_cabin_and_physician',
                [this.formatDateTimeForBackend(startDate), this.formatDateTimeForBackend(endDate), cabinIds, physicianIds]
            );

            console.log('Raw cabin month events loaded:', events);

            const filteredEvents = this.filterEventsBySearch(events);
            this.state.rawFilteredEvents = filteredEvents;
            this.state.events = this.organizeEventsByCabinDateAndTimeSlot(filteredEvents);

            console.log('Organized cabin month events:', this.state.events);

        } catch (error) {
            console.error('Error loading cabin month events:', error);
            this.state.events = {};
            this.state.rawFilteredEvents = {};
        }
    }

    // FIXED: Organize events by cabin, date and 30-minute time slot - Match physician month view
    organizeEventsByCabinDateAndTimeSlot = (eventsData) => {
        const organized = {};
        const displayCabins = this.getFilteredCabins();

        // IMPORTANT: Ensure time slots are loaded
        if (!this.state.timeSlots || this.state.timeSlots.length === 0) {
            console.warn('Time slots not loaded yet, generating default slots');
            this.state.timeSlots = this.generateTimeSlots();
        }

        console.log('Organizing events with time slots:', this.state.timeSlots.length);

        // Initialize structure with time slots from configuration
        displayCabins.forEach(cabin => {
            organized[cabin.id] = {};
            this.state.monthDays.forEach(day => {
                if (day.isCurrentMonth) {
                    organized[cabin.id][day.date] = {};
                    // Initialize all time slots for this day
                    this.state.timeSlots.forEach(slot => {
                        const slotKey = `${slot.hour}_${slot.minute}`;
                        organized[cabin.id][day.date][slotKey] = [];
                    });
                }
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

                            // Round to nearest 30-minute slot
                            const roundedMinute = eventMinute < 30 ? 0 : 30;
                            const slotKey = `${eventHour}_${roundedMinute}`;

                            if (organized[cabinIdInt] &&
                                organized[cabinIdInt][eventDateStr] &&
                                organized[cabinIdInt][eventDateStr][slotKey]) {
                                organized[cabinIdInt][eventDateStr][slotKey].push(event);
                            }
                        }
                    } catch (error) {
                        console.error('Error organizing cabin month event:', error);
                    }
                });
            }
        });

        return organized;
    }

    // FIXED: Get events for specific day and time slot (30-minute precision) - Match physician month view
    getEventsForDayAndTimeSlot = (cabinId, date, hour, minute = 0) => {
        const slotKey = `${hour}_${minute}`;
        const events = this.state.events[cabinId]?.[date]?.[slotKey] || [];
        return events;
    }

    onPreviousMonth = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        this.state.currentDate = newDate;
        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.state.monthDays = this.generateMonthDays();
        this.refreshData();
    }

    onNextMonth = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        this.state.currentDate = newDate;
        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.state.monthDays = this.generateMonthDays();
        this.refreshData();
    }

    onToday = () => {
        this.state.currentDate = new Date();
        this.state.monthDays = this.generateMonthDays();
        this.state.currentMonthLabel = this.getCurrentMonthLabel();
        this.refreshData();
    }

    onDayHeaderClick = (day) => {
        const selectedDate = new Date(day.fullDate);
        localStorage.setItem('selected_calendar_date', selectedDate.toISOString());
        this.action.doAction('calendar_by_assignee.action_appointment_calendar_cabin_day');
    }

    // Helper method to get event short title for display
    getEventShortTitle(event) {
        if (event.name) {
            return event.name.length > 15 ? event.name.substring(0, 15) + '...' : event.name;
        }
        return 'Appointment';
    }

    // Navigation methods
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

export const cabinMonthCalendarView = {
    ...listView,
    Controller: CabinMonthCalendarController,
};

registry.category("views").add("cabin_month_calendar_view", cabinMonthCalendarView);