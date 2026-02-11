/** @odoo-module **/
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import BaseCalendarController from "./calendar_controller";
import { AppointmentFormPopup } from "./appointment_form_popup";

class CabinDayCalendarController extends BaseCalendarController {
    static template = "CalendarByAssignee.CabinDayView";
    static components = {
        AppointmentFormPopup,
    };

    setup() {
        super.setup();

        // FIXED: Properly bind the search suggestion method
        this.onSearchSuggestionClick = this.onSearchSuggestionClick.bind(this);

        const storedDate = localStorage.getItem('selected_calendar_date');
        if (storedDate) {
            const selectedDate = new Date(storedDate);
            if (this.isValidDate(selectedDate)) {
                this.state.currentDate = selectedDate;
                localStorage.removeItem('selected_calendar_date');
            }
        }

        this.state.currentDateLabel = this.getCurrentDateLabel();
        this.state.rawFilteredEvents = {};
        this.state.events = {};

        // SPANNING: Initialize organized events for spanning
        this.state.organizedSpanningEvents = {};
    }

    async willStart() {
        super.willStart();
        // Load data when component starts
        await this.initializeData();
    }

    getCurrentDateLabel = () => {
        const date = this.state.currentDate;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const label = `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
        return label;
    }

    // FIXED: Ensure this method properly calls the mixin method
    onSearchSuggestionClick(suggestion) {
        // Call the mixin method directly
        searchMixin.onSearchSuggestionClick.call(this, suggestion);
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

    // Get cabin slot style with 30-minute precision
    getCabinSlotStyle(cabinId, hour, minute = 0) {
        const dateStr = this.formatDateForBackend(this.state.currentDate);
        const breakStyle = this.getCabinBreakPeriodStyle(cabinId, dateStr, hour, minute);

        if (breakStyle) {
            return breakStyle;
        }

        // Default alternating colors based on time slot
        const slotIndex = this.state.timeSlots.findIndex(slot =>
            slot.hour === hour && slot.minute === minute
        );
        return slotIndex % 2 === 0 ? 'background-color: #f8f9fa;' : 'background-color: white;';
    }

    // Get tooltip for cabin slot
    getCabinSlotTooltip(cabinId, hour, minute = 0) {
        const dateStr = this.formatDateForBackend(this.state.currentDate);
        return this.getCabinBreakPeriodTooltip(cabinId, dateStr, hour, minute);
    }

    initializeData = async () => {
        try {
            console.log('Initializing cabin day calendar data...');

            // Load initial data
            this.state.cabins = await this.loadCabins();
            this.state.physicians = await this.loadPhysicians();

            // Set up search state
            this.setupSearchState();

            // Load events immediately
            await this.refreshData();

            console.log('Cabin day calendar data loaded successfully');
        } catch (error) {
            console.error('Error initializing cabin day calendar:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        }
    }

    // FIXED: Enhanced refresh data to properly handle 30-minute slots
    refreshData = async () => {
        this.state.loading = true;
        try {
            console.log('Loading cabin day data with 30-minute time slots');
            await this.loadTimeConfig(); // Load time configuration first
            await this.loadEvents();
            await this.loadCabinBreakPeriods(); // Load cabin break periods
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
    }

    // FIXED: Load events - Each appointment appears ONLY ONCE in its START slot
    loadEvents = async () => {
        const cabinIds = this.getCabinIdsForAPI();
        const physicianIds = this.getPhysicianIdsForAPI();

        if (cabinIds.length === 0) {
            this.state.events = {};
            this.state.rawFilteredEvents = {};
            this.state.organizedSpanningEvents = {};
            return;
        }

        const startDate = new Date(this.state.currentDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(this.state.currentDate);
        endDate.setHours(23, 59, 59, 999);

        try {
            const events = await this.orm.call(
                'hms.appointment',
                'get_calendar_events_by_cabin_and_physician',
                [this.formatDateTimeForBackend(startDate), this.formatDateTimeForBackend(endDate), cabinIds, physicianIds]
            );

            const filteredEvents = this.filterEventsBySearch(events);
            this.state.rawFilteredEvents = filteredEvents;

            // SPANNING: Organize events for spanning display
            this.state.organizedSpanningEvents = this.organizeEventsForSpanning(filteredEvents);

            // Also keep old structure for compatibility
            this.state.events = this.organizeEventsProperly(filteredEvents);

        } catch (error) {
            this.state.events = {};
            this.state.rawFilteredEvents = {};
            this.state.organizedSpanningEvents = {};
        }
    }

    // SPANNING: Organize events for spanning - events only appear in their START slot
    organizeEventsForSpanning = (eventsData) => {
        const organized = {};
        const displayCabins = this.getFilteredCabins();
        const slotHeight = 50; // Height of each 30-minute slot in pixels

        // Initialize structure
        displayCabins.forEach(cabin => {
            organized[cabin.id] = {};
            this.state.timeSlots.forEach(slot => {
                const slotKey = this.getSlotKey(slot.hour, slot.minute);
                organized[cabin.id][slotKey] = [];
            });
        });

        Object.entries(eventsData).forEach(([cabinId, cabinEvents]) => {
            const cabinIdInt = parseInt(cabinId);
            if (!displayCabins.find(c => c.id === cabinIdInt)) return;

            cabinEvents.forEach(event => {
                try {
                    const eventStart = this.parseDateFromBackend(event.start);
                    const eventEnd = this.parseDateFromBackend(event.stop);

                    if (!this.isValidDate(eventStart) || !this.isValidDate(eventEnd)) return;

                    const startHour = eventStart.getHours();
                    const startMinute = eventStart.getMinutes();

                    // Round start minute to slot (0 or 30)
                    const roundedStartMinute = startMinute < 30 ? 0 : 30;
                    const startSlotKey = this.getSlotKey(startHour, roundedStartMinute);

                    // Calculate duration in slots (each slot = 30 minutes)
                    const durationMs = eventEnd - eventStart;
                    const durationMinutes = durationMs / (1000 * 60);

                    // FIX: Ensure we calculate duration in slots correctly
                    const durationSlots = Math.max(1, Math.ceil(durationMinutes / 30));

                    // Calculate height based on duration
                    const eventHeight = durationSlots * slotHeight - 2; // -2 for minimal margins

                    // Create event with spanning info
                    const spanningEvent = {
                        ...event,
                        _spanningInfo: {
                            durationSlots: durationSlots,
                            durationMinutes: durationMinutes,
                            height: eventHeight,
                            startSlotKey: startSlotKey,
                            startHour: startHour,
                            startMinute: startMinute,
                            roundedStartMinute: roundedStartMinute
                        }
                    };

                    // Add event ONLY to its START slot
                    if (organized[cabinIdInt] && organized[cabinIdInt][startSlotKey] !== undefined) {
                        // Check for duplicates
                        const existingIds = organized[cabinIdInt][startSlotKey].map(e => e.id);
                        if (!existingIds.includes(event.id)) {
                            organized[cabinIdInt][startSlotKey].push(spanningEvent);
                        }
                    }
                } catch (error) {
                    console.error('Error organizing spanning event:', error);
                }
            });
        });

        console.log('Organized spanning events for cabin:', organized);
        return organized;
    }

    // Keep old method for compatibility
    organizeEventsProperly = (eventsData) => {
        const organized = {};
        const displayCabins = this.getFilteredCabins();

        // Initialize structure with time slots from configuration
        displayCabins.forEach(cabin => {
            organized[cabin.id] = {};
            this.state.timeSlots.forEach(slot => {
                const slotKey = this.getSlotKey(slot.hour, slot.minute);
                organized[cabin.id][slotKey] = [];
            });
        });

        Object.entries(eventsData).forEach(([cabinId, cabinEvents]) => {
            const cabinIdInt = parseInt(cabinId);
            if (displayCabins.find(c => c.id === cabinIdInt)) {
                cabinEvents.forEach(event => {
                    try {
                        const eventDate = this.parseDateFromBackend(event.start);
                        if (this.isValidDate(eventDate)) {
                            const eventHour = eventDate.getHours();
                            const eventMinute = eventDate.getMinutes();

                            // Round to slot
                            const roundedMinute = eventMinute < 30 ? 0 : 30;
                            const slotKey = this.getSlotKey(eventHour, roundedMinute);

                            if (organized[cabinIdInt] && organized[cabinIdInt][slotKey] !== undefined) {
                                const existingEventIds = organized[cabinIdInt][slotKey].map(e => e.id);
                                if (!existingEventIds.includes(event.id)) {
                                    organized[cabinIdInt][slotKey].push(event);
                                }
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

    // Helper method to create consistent slot keys
    getSlotKey = (hour, minute) => {
        return `${hour}_${minute}`;
    }

    // SPANNING: Get events for slot with spanning info - events only appear in START slot
    getEventsForSlot = (cabinId, hour, minute = 0) => {
        const roundedMinute = minute < 30 ? 0 : 30;
        const slotKey = this.getSlotKey(hour, roundedMinute);
        const events = this.state.organizedSpanningEvents[cabinId]?.[slotKey] || [];

        // Filter events that actually start in this exact slot
        return events.filter(event => {
            if (!event._spanningInfo) return false;
            return event._spanningInfo.startHour === hour && event._spanningInfo.roundedStartMinute === roundedMinute;
        });
    }

    // NEW: Calculate event width based on number of events in slot
    getEventWidthStyle = (event, totalEventsInSlot, eventIndex) => {
        if (totalEventsInSlot <= 0) return 'width: 100%;';

        // Calculate percentage width based on number of events
        const widthPercentage = 100 / totalEventsInSlot;

        // Calculate left position based on index
        const leftPosition = widthPercentage * eventIndex;

        return `width: ${widthPercentage}%; left: ${leftPosition}%;`;
    }

    // NEW: Get combined style for event (spanning + width)
    getEventCombinedStyle = (event, slotEvents) => {
        const baseStyle = this.getEventStyle(event);
        const eventIndex = slotEvents.findIndex(e => e.id === event.id);
        const totalEvents = slotEvents.length;

        // Get width and position style
        const widthStyle = this.getEventWidthStyle(event, totalEvents, eventIndex);

        // Get height from spanning info
        let heightStyle = '';
        if (event._spanningInfo) {
            const height = event._spanningInfo.height;
            heightStyle = `height: ${height}px; min-height: ${height}px;`;
        }

        return `${baseStyle} ${widthStyle} ${heightStyle} position: absolute; top: 0; z-index: 10;`;
    }

    // New method to format patient information for display
    getEventPatientDisplay = (event) => {
        if (event.patient_name) {
            return event.patient_name;
        }
        return 'No Patient';
    }

    // New method to format patient code for display
    getEventPatientCodeDisplay = (event) => {
        if (event.patient_code && event.patient_code.trim()) {
            return event.patient_code;
        }
        return '';
    }

    // New method to format doctor information for display
    getEventDoctorDisplay = (event) => {
        if (event.doctor_name) {
            return event.doctor_name;
        }
        return 'No Doctor';
    }

    // New method to format patient phone for display
    getEventPatientPhoneDisplay = (event) => {
        if (event.patient_mobile && event.patient_mobile.trim()) {
            return event.patient_mobile;
        } else if (event.patient_phone && event.patient_phone.trim()) {
            return event.patient_phone;
        }
        return '';
    }

    onPreviousDay = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setDate(newDate.getDate() - 1);
        this.state.currentDate = newDate;
        this.state.currentDateLabel = this.getCurrentDateLabel();
        this.refreshData();
    }

    onNextDay = () => {
        const newDate = new Date(this.state.currentDate);
        newDate.setDate(newDate.getDate() + 1);
        this.state.currentDate = newDate;
        this.state.currentDateLabel = this.getCurrentDateLabel();
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

export const cabinDayCalendarView = {
    ...listView,
    Controller: CabinDayCalendarController,
};

registry.category("views").add("cabin_day_calendar_view", cabinDayCalendarView);