/** @odoo-module **/
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import BaseCalendarController from "./calendar_controller";
import { AppointmentFormPopup } from "./appointment_form_popup";
import { BulkAppointmentPopup } from "./bulk_appointment_popup";

class DayCalendarController extends BaseCalendarController {
    static template = "CalendarByAssignee.DayView";
    static components = {
        AppointmentFormPopup,
        BulkAppointmentPopup,
    };
    static props = ["*"]; // Allow all props without validation

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

        // SPANNING: Initialize organized events for spanning
        this.state.organizedSpanningEvents = {};

        // BULK APPOINTMENT: Initialize bulk popup state
        this.state.showBulkAppointmentPopup = false;
    }

    // BULK APPOINTMENT: Open/Close methods
    openBulkAppointmentPopup = () => {
        this.state.showBulkAppointmentPopup = true;
    }

    closeBulkAppointmentPopup = () => {
        this.state.showBulkAppointmentPopup = false;
    }

    refreshAfterBulkPopup = async () => {
        await this.refreshData();
    }

    getCurrentDateLabel = () => {
        const date = this.state.currentDate;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const label = dayNames[date.getDay()] + ', ' + monthNames[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
        return label;
    }

    // FIXED: Ensure this method properly calls the mixin method
    onSearchSuggestionClick(suggestion) {
        // Call the mixin method directly
        searchMixin.onSearchSuggestionClick.call(this, suggestion);
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
            const selected = this.state.physicians.filter(physician =>
                this.state.selectedPhysicianIds.includes(physician.id)
            );
            return selected;
        }

        return this.state.physicians;
    }

    // SPANNING: Load events - Each appointment appears ONLY ONCE in its START slot
    loadEvents = async () => {
        const physicianIds = this.getPhysicianIdsForAPI();

        if (physicianIds.length === 0) {
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
                'get_calendar_events_by_assignee',
                [this.formatDateTimeForBackend(startDate), this.formatDateTimeForBackend(endDate), physicianIds]
            );

            const filteredEvents = this.filterEventsBySearch(events);
            this.state.rawFilteredEvents = filteredEvents;

            // SPANNING: Organize events for spanning display
            this.state.organizedSpanningEvents = this.organizeEventsForSpanning(filteredEvents);

            // Also keep old structure for compatibility
            this.state.events = this.organizeEventsByPhysicianAndTimeSlot(filteredEvents);

        } catch (error) {
            console.error('Error loading day events:', error);
            this.state.events = {};
            this.state.rawFilteredEvents = {};
            this.state.organizedSpanningEvents = {};
        }
    }

    // SPANNING: Organize events for spanning - events only appear in their START slot
    organizeEventsForSpanning = (eventsData) => {
        const organized = {};
        const slotHeight = 50; // Height of each 30-minute slot in pixels

        Object.keys(eventsData).forEach(physicianId => {
            const physicianIdInt = parseInt(physicianId);
            organized[physicianIdInt] = {};

            // Initialize all time slots
            this.state.timeSlots.forEach(slot => {
                const slotKey = `${slot.hour}_${slot.minute}`;
                organized[physicianIdInt][slotKey] = [];
            });

            const physicianEvents = eventsData[physicianId];
            physicianEvents.forEach(event => {
                try {
                    const eventStart = this.parseDateFromBackend(event.start);
                    const eventEnd = this.parseDateFromBackend(event.stop);

                    if (!this.isValidDate(eventStart) || !this.isValidDate(eventEnd)) return;

                    const startHour = eventStart.getHours();
                    const startMinute = eventStart.getMinutes();

                    // Round start minute to slot (0 or 30)
                    const roundedStartMinute = startMinute < 30 ? 0 : 30;
                    const startSlotKey = `${startHour}_${roundedStartMinute}`;

                    // Calculate duration in slots (each slot = 30 minutes)
                    const durationMs = eventEnd - eventStart;
                    const durationMinutes = durationMs / (1000 * 60);
                    const durationSlots = Math.max(1, Math.ceil(durationMinutes / 30));

                    // Calculate height based on duration
                    const eventHeight = durationSlots * slotHeight - 4; // -4 for margins

                    // Create event with spanning info
                    const spanningEvent = {
                        ...event,
                        _spanningInfo: {
                            durationSlots: durationSlots,
                            durationMinutes: durationMinutes,
                            height: eventHeight,
                            startSlotKey: startSlotKey
                        }
                    };

                    // Add event ONLY to its START slot
                    if (organized[physicianIdInt] && organized[physicianIdInt][startSlotKey] !== undefined) {
                        // Check for duplicates
                        const existingIds = organized[physicianIdInt][startSlotKey].map(e => e.id);
                        if (!existingIds.includes(event.id)) {
                            organized[physicianIdInt][startSlotKey].push(spanningEvent);
                        }
                    }
                } catch (error) {
                    console.error('Error organizing spanning event:', error);
                }
            });
        });

        console.log('Organized spanning events for physician:', organized);
        return organized;
    }

    // Keep old method for compatibility
    organizeEventsByPhysicianAndTimeSlot = (eventsData) => {
        const organized = {};

        Object.keys(eventsData).forEach(physicianId => {
            const physicianIdInt = parseInt(physicianId);
            organized[physicianIdInt] = {};

            // Initialize all time slots based on time configuration
            this.state.timeSlots.forEach(slot => {
                const slotKey = `${slot.hour}_${slot.minute}`;
                organized[physicianIdInt][slotKey] = [];
            });

            const physicianEvents = eventsData[physicianId];
            physicianEvents.forEach(event => {
                try {
                    const eventDate = this.parseDateFromBackend(event.start);

                    if (this.isValidDate(eventDate)) {
                        const eventStartHour = eventDate.getHours();
                        const eventStartMinute = eventDate.getMinutes();

                        // Round to nearest 30 minutes for slot matching
                        const roundedMinute = eventStartMinute < 30 ? 0 : 30;
                        const slotKey = `${eventStartHour}_${roundedMinute}`;

                        // Add event only to its start slot (no duplicates)
                        if (organized[physicianIdInt] && organized[physicianIdInt][slotKey]) {
                            const existingEvent = organized[physicianIdInt][slotKey].find(e => e.id === event.id);
                            if (!existingEvent) {
                                organized[physicianIdInt][slotKey].push(event);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error organizing event:', error);
                }
            });
        });

        return organized;
    }

    // SPANNING: Get events for specific time slot - events only appear in START slot
    getEventsForSlot = (physicianId, hour, minute = 0) => {
        const roundedMinute = minute < 30 ? 0 : 30;
        const slotKey = `${hour}_${roundedMinute}`;
        return this.state.organizedSpanningEvents[physicianId]?.[slotKey] || [];
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

    // NEW: Calculate event style for side-by-side display
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

        return `${baseStyle} ${widthStyle} ${heightStyle} position: absolute; top: 1px; overflow: hidden; z-index: 10;`;
    }

    getEventDisplayInfo = (event) => {
        return this.getEventPopupInfo(event);
    }

    // Keep old spanning style method for compatibility
    getEventSpanningStyle = (event) => {
        const baseStyle = this.getEventStyle(event);

        if (event._spanningInfo) {
            const height = event._spanningInfo.height;
            return `${baseStyle} height: ${height}px; min-height: ${height}px; overflow: hidden; position: absolute; left: 2px; right: 2px; top: 1px; z-index: 10;`;
        }

        return baseStyle;
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

    // TIME CONFIGURATION: Enhanced refresh to include time config
    refreshData = async () => {
        this.state.loading = true;
        try {
            console.log('Loading day data with time configuration');
            await this.loadTimeConfig(); // TIME CONFIGURATION: Load time config
            await this.loadEvents();
            await this.loadBreakPeriods(); // Load break periods
        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
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

export const dayCalendarView = {
    ...listView,
    Controller: DayCalendarController,
};

registry.category("views").add("day_calendar_view", dayCalendarView);
