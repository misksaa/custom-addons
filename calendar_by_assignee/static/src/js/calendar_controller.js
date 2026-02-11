/** @odoo-module **/
import { Component, useState, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { searchMixin } from "./search_mixin";

export default class BaseCalendarController extends Component {
    static template = null;
    static props = ["*"];

    setup() {
        super.setup();

        this.action = useService("action");
        this.orm = useService("orm");
        this.notification = useService("notification");

        // Time Configuration state - initialized with defaults
        this.state = useState({
            physicians: [],
            cabins: [],
            timeSlots: [], // Will be generated after timeConfig loaded
            weekDays: [],
            monthDays: [],
            currentDate: new Date(),
            events: {},
            loading: false,
            currentDateLabel: '',
            currentWeekLabel: '',
            currentMonthLabel: '',
            draggedEvent: null,
            hoveredEvent: null,
            hoverPosition: { x: 0, y: 0 },
            physicianColors: {},
            cabinColors: {},
            showEventPopup: false,
            popupEvent: null,
            popupPosition: { x: 0, y: 0 },
            selectedPhysicianIds: [],
            selectedCabinIds: [],
            physicianSearchTerm: '',
            cabinSearchTerm: '',
            showPhysicianSuggestions: false,
            showCabinSuggestions: false,
            showAppointmentPopup: false,
            popupMode: 'create',
            currentAppointmentId: null,
            slotData: null,
            popupTimeout: null,
            // Search state will be initialized in setupSearchState
            searchField: 'physician',
            searchInput: '',
            searchTerms: {
                physician: [],
                patient: [],
                phone: [],
                appointment: [],
                cabin: [],
                status: []
            },
            searchFields: [
                { value: 'physician', label: 'Physician' },
                { value: 'patient', label: 'Patient' },
                { value: 'phone', label: 'Phone' },
                { value: 'appointment', label: 'Appointment' },
                { value: 'cabin', label: 'Cabin' },
                { value: 'status', label: 'Status' }
            ],
            showSearchSuggestions: false,
            statusOptions: [
                'draft', 'no_answer', 'call_back', 'posponed', 'confirm', 'booked',
                'arrived', 'waiting', 'treatment', 'in_consultation', 'basic_7_floor',
                'pause', 'to_invoice', 'gig_insurance', 'billed', 'done', 'cancelled',
                'blocked', 'follow_up', 'feels_good'
            ],
            patientSuggestions: [],
            appointmentSuggestions: [],
            cabinSuggestions: [],
            // Break periods for doctors (including leaves)
            breakPeriods: {}, // {physicianId: {date: [{start: '12:00', end: '14:00', type: 'break'/'leave', leaveName: 'Annual Leave'}]}}
            breakPeriodsLoaded: false,
            // Break periods for cabins (unchanged)
            cabinBreakPeriods: {}, // {cabinId: {date: [{start: '12:00', end: '14:00'}]}}
            cabinBreakPeriodsLoaded: false,
            // TIME CONFIGURATION - Add time configuration state
            timeConfig: {
                start_hour: 0,
                start_minute: 0,
                end_hour: 23,
                end_minute: 0,
                loaded: false
            }
        });

        // Bind mixin methods to this instance
        this.setupSearchState = searchMixin.setupSearchState.bind(this);
        this.hasActiveSearch = searchMixin.hasActiveSearch.bind(this);
        this.onSearchFieldChange = searchMixin.onSearchFieldChange.bind(this);
        this.onSearchInputChange = searchMixin.onSearchInputChange.bind(this);
        this.onSearchKeyPress = searchMixin.onSearchKeyPress.bind(this);
        this.addSearchTerm = searchMixin.addSearchTerm.bind(this);
        this.removeSearchTerm = searchMixin.removeSearchTerm.bind(this);
        this.clearSearch = searchMixin.clearSearch.bind(this);
        this.hideSearchSuggestions = searchMixin.hideSearchSuggestions.bind(this);
        this.loadSearchSuggestions = searchMixin.loadSearchSuggestions.bind(this);
        this.getSearchSuggestions = searchMixin.getSearchSuggestions.bind(this);
        this.onSearchSuggestionClick = searchMixin.onSearchSuggestionClick.bind(this);
        this.getCurrentSearchTerms = searchMixin.getCurrentSearchTerms.bind(this);
        this.filterEventsBySearch = searchMixin.filterEventsBySearch.bind(this);

        onWillStart(async () => {
            try {
                await this.initializeData();
            } catch (error) {
                console.error('Error in onWillStart:', error);
                this.notification.add('Error initializing calendar. Please refresh the page.', {
                    type: 'danger',
                    sticky: true
                });
            }
        });

        onWillUpdateProps(async (nextProps) => {
            await this.refreshData();
        });
    }

    // TIME CONFIGURATION: Load time configuration from backend
    async loadTimeConfig() {
        try {
            const config = await this.orm.call(
                'calendar.time.config',
                'get_current_config',
                []
            );

            console.log('✅ TIME CONFIGURATION: Loaded time config:', config);

            this.state.timeConfig = {
                ...config,
                loaded: true
            };

            // Regenerate time slots with new config
            this.state.timeSlots = this.generateTimeSlots();

            return config;
        } catch (error) {
            console.error('❌ TIME CONFIGURATION: Error loading time config:', error);
            // Set defaults if error
            this.state.timeConfig = {
                start_hour: 0,
                start_minute: 0,
                end_hour: 23,
                end_minute: 0,
                loaded: true
            };
            this.state.timeSlots = this.generateTimeSlots();
            return this.state.timeConfig;
        }
    }

    // TIME CONFIGURATION: Generate time slots based on configuration
    generateTimeSlots = () => {
        const startHour = this.state.timeConfig.start_hour || 0;
        const startMinute = this.state.timeConfig.start_minute || 0;
        const endHour = this.state.timeConfig.end_hour || 23;
        const endMinute = this.state.timeConfig.end_minute || 0;

        console.log('🕒 TIME CONFIGURATION: Generating slots from',
                   `${startHour}:${startMinute.toString().padStart(2, '0')} to`,
                   `${endHour}:${endMinute.toString().padStart(2, '0')}`);

        const slots = [];

        // Convert start and end to total minutes
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;

        // Generate slots every 30 minutes
        for (let totalMinutes = startTotalMinutes; totalMinutes <= endTotalMinutes; totalMinutes += 30) {
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            const hourFloat = hour + (minute === 30 ? 0.5 : 0);

            // Format label based on minute
            let label;
            if (minute === 0) {
                label = `${hour.toString().padStart(2, '0')}:00`;
            } else if (minute === 30) {
                label = `${hour.toString().padStart(2, '0')}:30`;
            } else {
                label = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            }

            slots.push({
                hour: hour,
                minute: minute,
                hourFloat: hourFloat, // For sorting/grouping
                displayHour: hour,
                displayMinute: minute,
                label: label,
                isHalfHour: minute === 30,
                start: new Date().setHours(hour, minute, 0, 0),
                end: new Date().setHours(hour, minute + 29, 59, 999)
            });
        }

        console.log('🕒 TIME CONFIGURATION: Generated', slots.length, 'slots');
        return slots;
    }

    // TIME CONFIGURATION: Get events for specific time slot (with 30-minute precision)
    getEventsForTimeSlot = (eventsData, targetHour, targetMinute = 0) => {
        if (!eventsData || !Array.isArray(eventsData)) return [];

        return eventsData.filter(event => {
            try {
                const eventDate = this.parseDateFromBackend(event.start);
                if (!this.isValidDate(eventDate)) return false;

                const eventHour = eventDate.getHours();
                const eventMinute = eventDate.getMinutes();

                // Round to nearest 30 minutes for slot matching
                const eventRoundedMinute = eventMinute < 30 ? 0 : 30;

                return eventHour === targetHour && eventRoundedMinute === targetMinute;
            } catch (error) {
                return false;
            }
        });
    }

    // Rest of the existing methods with TIME CONFIGURATION updates
    async loadBreakPeriods() {
        try {
            const physicianIds = this.getPhysicianIdsForAPI();

            if (physicianIds.length === 0) {
                this.state.breakPeriods = {};
                this.state.breakPeriodsLoaded = true;
                return;
            }

            // Calculate date range based on current view
            let startDate, endDate;

            if (this.state.weekDays && this.state.weekDays.length > 0) {
                // Week view
                startDate = this.state.weekDays[0].fullDate;
                endDate = this.state.weekDays[6].fullDate;
            } else if (this.state.monthDays && this.state.monthDays.length > 0) {
                // Month view
                const monthStart = this.state.monthDays.find(d => d.isCurrentMonth).fullDate;
                const monthEnd = this.state.monthDays.filter(d => d.isCurrentMonth).pop().fullDate;
                startDate = monthStart;
                endDate = monthEnd;
            } else {
                // Day view
                startDate = this.state.currentDate;
                endDate = this.state.currentDate;
            }

            // Format dates for backend
            const formattedStartDate = this.formatDateForBackend(startDate);
            const formattedEndDate = this.formatDateForBackend(endDate);

            console.log('=== Loading Physician Break & Leave Periods ===');
            console.log('Physician IDs:', physicianIds);
            console.log('Date Range:', formattedStartDate, 'to', formattedEndDate);

            const breakPeriodsData = await this.orm.call(
                'hms.physician',
                'get_break_periods_for_range',
                [physicianIds, formattedStartDate, formattedEndDate]
            );

            console.log('Physician Break & Leave Periods Data:', breakPeriodsData);

            this.state.breakPeriods = breakPeriodsData || {};
            this.state.breakPeriodsLoaded = true;
            console.log('✅ Physician break & leave periods loaded:', this.state.breakPeriods);
        } catch (error) {
            console.error('❌ Error loading physician break & leave periods:', error);
            this.state.breakPeriods = {};
            this.state.breakPeriodsLoaded = true;
        }
    }

    async loadCabinBreakPeriods() {
        try {
            const cabinIds = this.getCabinIdsForAPI();

            if (cabinIds.length === 0) {
                this.state.cabinBreakPeriods = {};
                this.state.cabinBreakPeriodsLoaded = true;
                return;
            }

            // Calculate date range based on current view
            let startDate, endDate;

            if (this.state.weekDays && this.state.weekDays.length > 0) {
                // Week view
                startDate = this.state.weekDays[0].fullDate;
                endDate = this.state.weekDays[6].fullDate;
            } else if (this.state.monthDays && this.state.monthDays.length > 0) {
                // Month view
                const monthStart = this.state.monthDays.find(d => d.isCurrentMonth).fullDate;
                const monthEnd = this.state.monthDays.filter(d => d.isCurrentMonth).pop().fullDate;
                startDate = monthStart;
                endDate = monthEnd;
            } else {
                // Day view
                startDate = this.state.currentDate;
                endDate = this.state.currentDate;
            }

            // Format dates for backend
            const formattedStartDate = this.formatDateForBackend(startDate);
            const formattedEndDate = this.formatDateForBackend(endDate);

            console.log('=== Loading Cabin Break Periods ===');
            console.log('Cabin IDs:', cabinIds);
            console.log('Date Range:', formattedStartDate, 'to', formattedEndDate);

            // Load break periods from backend
            const breakPeriodsData = await this.orm.call(
                'appointment.cabin',
                'get_cabin_break_periods_for_range',
                [cabinIds, formattedStartDate, formattedEndDate]
            );

            console.log('Cabin Break Periods Data:', breakPeriodsData);

            this.state.cabinBreakPeriods = breakPeriodsData || {};
            this.state.cabinBreakPeriodsLoaded = true;
            console.log('✅ Cabin break periods loaded:', this.state.cabinBreakPeriods);
        } catch (error) {
            console.error('❌ Error loading cabin break periods:', error);
            this.state.cabinBreakPeriods = {};
            this.state.cabinBreakPeriodsLoaded = true;
        }
    }

    // TIME CONFIGURATION: Enhanced break period check for 30-minute slots (including leaves)
    isBreakPeriod(physicianId, dateStr, hour, minute = 0) {
        if (!this.state.breakPeriods || !this.state.breakPeriods[physicianId]) {
            return false;
        }

        const physicianBreaks = this.state.breakPeriods[physicianId];
        const dateBreaks = physicianBreaks.filter(bp => bp.date === dateStr);

        for (const breakPeriod of dateBreaks) {
            const breakStartParts = breakPeriod.start_time.split(':');
            const breakEndParts = breakPeriod.end_time.split(':');

            const breakStartHour = parseInt(breakStartParts[0]);
            const breakStartMinute = parseInt(breakStartParts[1]) || 0;
            const breakEndHour = parseInt(breakEndParts[0]);
            const breakEndMinute = parseInt(breakEndParts[1]) || 0;

            // Convert to total minutes for comparison
            const slotTotalMinutes = hour * 60 + minute;
            const breakStartTotalMinutes = breakStartHour * 60 + breakStartMinute;
            const breakEndTotalMinutes = breakEndHour * 60 + breakEndMinute;

            // Check if current slot is within break or leave period
            if (slotTotalMinutes >= breakStartTotalMinutes && slotTotalMinutes < breakEndTotalMinutes) {
                const isLeave = breakPeriod.type === 'leave';
                console.log(`🚫 Physician ${isLeave ? 'leave' : 'break'} period found:`, {
                    physicianId: physicianId,
                    date: dateStr,
                    hour: hour,
                    minute: minute,
                    start: breakPeriod.start_time,
                    end: breakPeriod.end_time,
                    type: breakPeriod.type || 'break',
                    leaveName: breakPeriod.leave_name
                });
                return {
                    isBreak: true,
                    isLeave: isLeave,
                    start: breakPeriod.start_time,
                    end: breakPeriod.end_time,
                    type: breakPeriod.type || 'break',
                    leaveName: breakPeriod.leave_name
                };
            }
        }

        return false;
    }

    // Cabin break period method remains unchanged
    isCabinBreakPeriod(cabinId, dateStr, hour, minute = 0) {
        if (!this.state.cabinBreakPeriods || !this.state.cabinBreakPeriods[cabinId]) {
            return false;
        }

        const cabinBreaks = this.state.cabinBreakPeriods[cabinId];
        const dateBreaks = cabinBreaks.filter(bp => bp.date === dateStr);

        for (const breakPeriod of dateBreaks) {
            const breakStartParts = breakPeriod.start_time.split(':');
            const breakEndParts = breakPeriod.end_time.split(':');

            const breakStartHour = parseInt(breakStartParts[0]);
            const breakStartMinute = parseInt(breakStartParts[1]) || 0;
            const breakEndHour = parseInt(breakEndParts[0]);
            const breakEndMinute = parseInt(breakEndParts[1]) || 0;

            // Convert to total minutes for comparison
            const slotTotalMinutes = hour * 60 + minute;
            const breakStartTotalMinutes = breakStartHour * 60 + breakStartMinute;
            const breakEndTotalMinutes = breakEndHour * 60 + breakEndMinute;

            // Check if current slot is within break period
            if (slotTotalMinutes >= breakStartTotalMinutes && slotTotalMinutes < breakEndTotalMinutes) {
                console.log('🚫 Cabin break period found:', {
                    cabinId: cabinId,
                    date: dateStr,
                    hour: hour,
                    minute: minute,
                    breakStart: breakPeriod.start_time,
                    breakEnd: breakPeriod.end_time
                });
                return {
                    isBreak: true,
                    start: breakPeriod.start_time,
                    end: breakPeriod.end_time
                };
            }
        }

        return false;
    }

    // TIME CONFIGURATION: Get break period style for 30-minute slots (different colors for breaks and leaves)
    getBreakPeriodStyle(physicianId, dateStr, hour, minute = 0) {
        const breakInfo = this.isBreakPeriod(physicianId, dateStr, hour, minute);
        if (breakInfo) {
            if (breakInfo.isLeave) {
                // Purple semi-transparent background for leave periods
                return 'background-color: rgba(128, 0, 128, 0.15) !important; ' +
                       'border: 2px dashed rgba(128, 0, 128, 0.5) !important; ' +
                       'position: relative; ' +
                       'cursor: not-allowed;';
            } else {
                // Red semi-transparent background for break periods
                return 'background-color: rgba(255, 0, 0, 0.15) !important; ' +
                       'border: 2px dashed rgba(220, 53, 69, 0.5) !important; ' +
                       'position: relative; ' +
                       'cursor: not-allowed;';
            }
        }
        return '';
    }

    // Cabin break period style remains unchanged
    getCabinBreakPeriodStyle(cabinId, dateStr, hour, minute = 0) {
        const breakInfo = this.isCabinBreakPeriod(cabinId, dateStr, hour, minute);
        if (breakInfo) {
            // Red semi-transparent background for break periods
            return 'background-color: rgba(255, 0, 0, 0.15) !important; ' +
                   'border: 2px dashed rgba(220, 53, 69, 0.5) !important; ' +
                   'position: relative; ' +
                   'cursor: not-allowed;';
        }
        return '';
    }

    // TIME CONFIGURATION: Get break period tooltip for 30-minute slots (different messages for breaks and leaves)
    getBreakPeriodTooltip(physicianId, dateStr, hour, minute = 0) {
        const breakInfo = this.isBreakPeriod(physicianId, dateStr, hour, minute);
        if (breakInfo) {
            if (breakInfo.isLeave) {
                const leaveName = breakInfo.leaveName ? ` (${breakInfo.leaveName})` : '';
                return `Doctor on leave${leaveName}: ${breakInfo.start} - ${breakInfo.end}`;
            } else {
                return `Doctor break time: ${breakInfo.start} - ${breakInfo.end}`;
            }
        }
        return '';
    }

    // Cabin break period tooltip remains unchanged
    getCabinBreakPeriodTooltip(cabinId, dateStr, hour, minute = 0) {
        const breakInfo = this.isCabinBreakPeriod(cabinId, dateStr, hour, minute);
        if (breakInfo) {
            return `Cabin break time: ${breakInfo.start} - ${breakInfo.end}`;
        }
        return '';
    }

    // TIME CONFIGURATION: Check break period before click with minute precision (handles both breaks and leaves)
    checkBreakPeriodBeforeClick(slotData) {
        if (!slotData.physicianId) return false;

        const dateStr = slotData.date || this.formatDateForBackend(this.state.currentDate);
        const hour = slotData.hour || 0;
        const minute = slotData.minute || 0;

        const breakInfo = this.isBreakPeriod(slotData.physicianId, dateStr, hour, minute);
        if (breakInfo) {
            if (breakInfo.isLeave) {
                this.notification.add(
                    `Cannot schedule: Doctor is on leave`,
                    { type: 'danger', title: 'Doctor Unavailable', sticky: true }
                );
            } else {
                this.notification.add(
                    `Cannot schedule: Doctor has break time`,
                    { type: 'danger', title: 'Doctor Break', sticky: true }
                );
            }
            return true;
        }
        return false;
    }

    // Cabin break period check remains unchanged
    checkCabinBreakPeriodBeforeClick(slotData) {
        if (!slotData.cabinId) return false;

        const dateStr = slotData.date || this.formatDateForBackend(this.state.currentDate);
        const hour = slotData.hour || 0;
        const minute = slotData.minute || 0;

        const breakInfo = this.isCabinBreakPeriod(slotData.cabinId, dateStr, hour, minute);
        if (breakInfo) {
            this.notification.add(
                `Cannot schedule: Cabin has break time`,
                { type: 'danger', title: 'Cabin Break', sticky: true }
            );
            return true;
        }
        return false;
    }

    // TIME CONFIGURATION: Check break period before drop with minute precision (handles both breaks and leaves)
    checkBreakPeriodBeforeDrop(targetData) {
        if (!targetData.physicianId) return false;

        const dateStr = targetData.date || this.formatDateForBackend(this.state.currentDate);
        const hour = targetData.hour || 0;
        const minute = targetData.minute || 0;

        const breakInfo = this.isBreakPeriod(targetData.physicianId, dateStr, hour, minute);
        if (breakInfo) {
            return breakInfo;
        }
        return false;
    }

    // Cabin break period check remains unchanged
    checkCabinBreakPeriodBeforeDrop(targetData) {
        if (!targetData.cabinId) return false;

        const dateStr = targetData.date || this.formatDateForBackend(this.state.currentDate);
        const hour = targetData.hour || 0;
        const minute = targetData.minute || 0;

        const breakInfo = this.isCabinBreakPeriod(targetData.cabinId, dateStr, hour, minute);
        if (breakInfo) {
            return breakInfo;
        }
        return false;
    }

    // TIME CONFIGURATION: Enhanced slot click with minute precision
    onSlotClick = (slotData) => {
        console.log('Slot clicked:', slotData);

        // Check if slot is in break or leave period (physician)
        if (this.checkBreakPeriodBeforeClick(slotData)) {
            return;
        }

        // Check if slot is in cabin break period
        if (this.checkCabinBreakPeriodBeforeClick(slotData)) {
            return;
        }

        this.openAppointmentPopup('create', null, slotData);
    }

    onSlotDragOver = (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';

        // FIX: Check if currentTarget exists
        if (!ev.currentTarget) return;

        const currentBg = ev.currentTarget.style.backgroundColor;
        const isBreakPeriod = currentBg && (currentBg.includes('rgba(255, 0, 0, 0.15)') ||
                         currentBg.includes('rgba(255,0,0,0.15)') ||
                         currentBg.includes('rgba(128, 0, 128, 0.15)'));

        if (!isBreakPeriod) {
            ev.currentTarget.style.backgroundColor = '#e3f2fd';
            ev.currentTarget.style.border = '2px dashed #2196F3';
        }
    }

    onSlotDragLeave = (ev) => {
        // FIX: Check if currentTarget exists
        if (!ev.currentTarget) return;

        const currentBg = ev.currentTarget.style.backgroundColor;
        const isBreakPeriod = currentBg && (currentBg.includes('rgba(255, 0, 0, 0.15)') ||
                         currentBg.includes('rgba(255,0,0,0.15)') ||
                         currentBg.includes('rgba(128, 0, 128, 0.15)'));

        if (isBreakPeriod) {
            // Reset to original break/leave color based on what type it is
            if (currentBg.includes('rgba(128, 0, 128, 0.15)')) {
                ev.currentTarget.style.backgroundColor = 'rgba(128, 0, 128, 0.15)';
                ev.currentTarget.style.border = '2px dashed rgba(128, 0, 128, 0.5)';
            } else {
                ev.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.15)';
                ev.currentTarget.style.border = '2px dashed rgba(220, 53, 69, 0.5)';
            }
        } else {
            ev.currentTarget.style.backgroundColor = '';
            ev.currentTarget.style.border = '';
        }
    }

    onSlotDrop = async (ev, targetData) => {
        ev.preventDefault();

        // Store the target element to avoid null reference
        const targetElement = ev.currentTarget;
        if (!targetElement) {
            console.error('❌ No target element found for drop');
            this.notification.add('Drop Error', {
                type: 'danger',
                title: 'Error',
                sticky: true
            });
            return;
        }

        const originalBg = targetElement.style.backgroundColor;
        const originalBorder = targetElement.style.border;

        if (!this.state.draggedEvent) {
            this.notification.add('No appointment selected for drag', {
                type: 'warning',
                title: 'Warning'
            });
            return;
        }

        try {
            // Perform comprehensive drag and drop validation
            const validationResult = await this.validateDragAndDropConstraints(targetData, this.state.draggedEvent);

            if (!validationResult.isValid) {
                // Show validation error with detailed notification
                console.log('❌ Validation failed:', validationResult.message);

                this.notification.add(validationResult.message, {
                    type: 'danger',
                    title: 'Validation Error',
                    sticky: true,
                    className: 'validation-error-notification'
                });

                // Reset dragged event
                this.state.draggedEvent = null;
                const draggedElements = document.querySelectorAll('.o_calendar_event[draggable="true"]');
                draggedElements.forEach(el => {
                    el.style.opacity = '1';
                });

                targetElement.style.backgroundColor = originalBg;
                targetElement.style.border = originalBorder;
                return;
            }

            // Check for break periods BEFORE attempting to move
            const dateStr = targetData.date || this.formatDateForBackend(this.state.currentDate);
            const hour = targetData.hour || 0;
            const minute = targetData.minute || 0;

            // Check physician break/leave
            if (targetData.physicianId) {
                const breakInfo = this.isBreakPeriod(targetData.physicianId, dateStr, hour, minute);
                if (breakInfo) {
                    if (breakInfo.isLeave) {
                        this.notification.add(`Cannot move: Doctor is on leave (${breakInfo.leaveName || ''})`, {
                            type: 'danger',
                            title: 'Doctor Unavailable',
                            sticky: true
                        });
                    } else {
                        this.notification.add('Cannot move: Doctor has break time', {
                            type: 'danger',
                            title: 'Doctor Break',
                            sticky: true
                        });
                    }
                    this.state.draggedEvent = null;
                    targetElement.style.backgroundColor = originalBg;
                    targetElement.style.border = originalBorder;
                    return;
                }
            }

            // Check cabin break
            if (targetData.cabinId) {
                const cabinBreakInfo = this.isCabinBreakPeriod(targetData.cabinId, dateStr, hour, minute);
                if (cabinBreakInfo) {
                    this.notification.add('Cannot move: Cabin has break time', {
                        type: 'danger',
                        title: 'Cabin Break',
                        sticky: true
                    });
                    this.state.draggedEvent = null;
                    targetElement.style.backgroundColor = originalBg;
                    targetElement.style.border = originalBorder;
                    return;
                }
            }

            // Original drop logic (only executed if validation passes)...
            const appointmentId = this.state.draggedEvent.id;
            const newStart = this.calculateNewEventTime(targetData);

            if (!newStart || isNaN(newStart.getTime())) {
                this.notification.add('Invalid time selected', {
                    type: 'danger',
                    title: 'Invalid Time',
                    sticky: true
                });
                this.state.draggedEvent = null;

                targetElement.style.backgroundColor = originalBg;
                targetElement.style.border = originalBorder;
                return;
            }

            const originalStart = this.parseDateFromBackend(this.state.draggedEvent.start);
            const originalEnd = this.parseDateFromBackend(this.state.draggedEvent.stop);
            const durationMs = originalEnd.getTime() - originalStart.getTime();
            const newStop = new Date(newStart.getTime() + durationMs);

            const newStartUTC = new Date(newStart);
            const newStopUTC = new Date(newStop);

            newStartUTC.setHours(newStartUTC.getHours() + 3);
            newStopUTC.setHours(newStopUTC.getHours() + 3);

            const formattedStart = this.formatDateTimeForBackend(newStartUTC);
            const formattedStop = this.formatDateTimeForBackend(newStopUTC);

            const newPhysicianId = targetData.physicianId || this.state.draggedEvent.doctor_id;
            const newCabinId = targetData.cabinId || this.state.draggedEvent.cabin_id;

            console.log('✅ Moving appointment (validation passed):', {
                appointmentId: appointmentId,
                newStart: formattedStart,
                newStop: formattedStop,
                newPhysicianId: newPhysicianId,
                newCabinId: newCabinId
            });

            const result = await this.orm.call(
                'hms.appointment',
                'update_event_time',
                [appointmentId, formattedStart, formattedStop, newPhysicianId, newCabinId]
            );

            if (result) {
                await this.refreshData();
                this.notification.add('Appointment moved successfully', {
                    type: 'success',
                    title: 'Success'
                });
            } else {
                this.notification.add('Failed to move appointment', {
                    type: 'danger',
                    title: 'Move Failed',
                    sticky: true
                });
            }
        } catch (error) {
            console.error('❌ Error moving appointment:', error);

            // Extract the actual error message from server response
            let errorMessage = 'Failed to move appointment';
            let detailedMessage = '';
            let title = 'Move Failed';

            if (error.data && error.data.message) {
                // Try to extract the actual error message
                const serverMessage = error.data.message;

                console.log('Server error message:', serverMessage);

                if (serverMessage.includes('Doctor already has an appointment at this time')) {
                    const parts = serverMessage.split(':');
                    if (parts.length > 1) {
                        const appointmentName = parts[1].trim();
                        errorMessage = `Doctor already has an appointment: ${appointmentName}`;
                        detailedMessage = 'Please choose a different time or doctor';
                        title = 'Appointment Conflict';
                    } else {
                        errorMessage = 'Doctor already has an appointment at this time';
                        detailedMessage = 'The selected doctor has another appointment scheduled';
                    }
                }
                else if (serverMessage.includes('Gender conflict') || serverMessage.includes('gender conflict')) {
                    errorMessage = 'Gender Conflict in Consultation Room';
                    detailedMessage = 'Cannot schedule male and female patients in the same room at the same time';
                    title = 'Gender Conflict';
                }
                else if (serverMessage.includes('Cannot schedule appointment')) {
                    if (serverMessage.includes('Gender conflict')) {
                        errorMessage = 'Gender Conflict in Consultation Room';
                        detailedMessage = 'Cannot schedule appointments with different genders at the same time in the same room';
                    } else {
                        errorMessage = 'Cabin Already Occupied';
                        detailedMessage = 'The selected consultation room is already booked for this time';
                    }
                    title = 'Scheduling Conflict';
                }
                else if (serverMessage.includes('Invalid cabin ID') || serverMessage.includes('Invalid cabin_id')) {
                    errorMessage = 'Invalid Consultation Room';
                    detailedMessage = 'The selected consultation room is not valid. Please select a different room.';
                    title = 'Invalid Room';
                }
                else if (serverMessage.includes('break period')) {
                    errorMessage = 'Break period';
                    detailedMessage = 'Cannot schedule during break time';
                    title = 'Break Time';
                }
                else if (serverMessage.includes('leave period')) {
                    errorMessage = 'Doctor is on leave';
                    detailedMessage = 'Doctor is not available during this time';
                    title = 'Doctor Unavailable';
                }
                else {
                    errorMessage = serverMessage;
                    if (serverMessage.includes(':')) {
                        const msgParts = serverMessage.split(':');
                        if (msgParts.length > 1) {
                            title = msgParts[0].trim();
                            errorMessage = msgParts.slice(1).join(':').trim();
                        }
                    }
                }
            }
            else if (error.message) {
                errorMessage = error.message;
            }

            let finalMessage = errorMessage;
            if (detailedMessage) {
                finalMessage = `${errorMessage}\n\n${detailedMessage}`;
            }

            console.log('Displaying notification:', { title, finalMessage });

            this.notification.add(finalMessage, {
                type: 'danger',
                title: title,
                sticky: true,
                className: 'validation-error-notification'
            });

            // Reset dragged event
            this.state.draggedEvent = null;

            const draggedElements = document.querySelectorAll('.o_calendar_event[draggable="true"]');
            draggedElements.forEach(el => {
                el.style.opacity = '1';
            });

            if (targetElement && targetElement.parentNode) {
                targetElement.style.backgroundColor = originalBg;
                targetElement.style.border = originalBorder;
            }
        }
    }

    // TIME CONFIGURATION: Override refreshData to include time config
    refreshData = async () => {
        console.log('=== Refreshing Calendar Data ===');
        this.state.loading = true;
        try {
            console.log('Physicians:', this.getPhysicianIdsForAPI());
            console.log('Cabins:', this.getCabinIdsForAPI());
            await this.loadEvents();
            // Load both physician and cabin break periods
            await this.loadBreakPeriods();
            await this.loadCabinBreakPeriods();
            // TIME CONFIGURATION: Load time configuration
            await this.loadTimeConfig();
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.notification.add('Error loading calendar data', { type: 'danger' });
        } finally {
            this.state.loading = false;
        }
    }

    // TIME CONFIGURATION: Force refresh time configuration
    forceRefreshTimeConfig = async () => {
        try {
            this.state.timeConfig.loaded = false;
            await this.loadTimeConfig();
        } catch (error) {
            console.error('Error refreshing time configuration:', error);
        }
    }

    // Rest of the original methods remain the same...
    openAppointmentPopup = (mode, appointmentId = null, slotData = null) => {
        this.state.showAppointmentPopup = true;
        this.state.popupMode = mode;
        this.state.currentAppointmentId = appointmentId || undefined;
        this.state.slotData = slotData;
    }

    closeAppointmentPopup = () => {
        this.state.showAppointmentPopup = false;
        this.state.popupMode = 'create';
        this.state.currentAppointmentId = null;
        this.state.slotData = null;
    }

    refreshAfterPopup = async () => {
        await this.refreshData();
    }

    // TIME CONFIGURATION: Initialize data with time config
    initializeData = async () => {
        console.log('=== Initializing Calendar Data ===');
        this.state.physicians = await this.loadPhysicians();
        this.state.cabins = await this.loadCabins();

        // Initialize search state
        this.setupSearchState();

        // TIME CONFIGURATION: Load time configuration first
        await this.loadTimeConfig();

        console.log('Calendar initialized:', {
            physicians: this.state.physicians,
            cabins: this.state.cabins,
            selectedPhysicians: this.state.selectedPhysicianIds,
            selectedCabins: this.state.selectedCabinIds,
            searchState: this.state.searchField,
            timeConfig: this.state.timeConfig // TIME CONFIGURATION: Log time config
        });

        await this.refreshData();
    }

    loadEvents = () => {
        console.warn('loadEvents should be implemented by child controllers');
    }

    getPhysicianIdsFromEvents = () => {
        const physicianIds = new Set();

        if (this.state.events && Object.keys(this.state.events).length > 0) {
            Object.keys(this.state.events).forEach(physicianId => {
                physicianIds.add(parseInt(physicianId));
            });
        }

        return Array.from(physicianIds);
    }

    getCabinIdsFromEvents = () => {
        const cabinIds = new Set();

        if (this.state.events && Object.keys(this.state.events).length > 0) {
            Object.keys(this.state.events).forEach(cabinId => {
                cabinIds.add(parseInt(cabinId));
            });
        }

        return Array.from(cabinIds);
    }

    // Rest of the methods remain the same...
    onPhysicianSearchChange = (ev) => {
        const searchTerm = ev.target.value;
        this.state.physicianSearchTerm = searchTerm;
        this.state.showPhysicianSuggestions = searchTerm.length > 0;
    }

    onCabinSearchChange = (ev) => {
        const searchTerm = ev.target.value;
        this.state.cabinSearchTerm = searchTerm;
        this.state.showCabinSuggestions = searchTerm.length > 0;
    }

    onPhysicianSuggestionClick = (physician) => {
        if (!this.state.selectedPhysicianIds.includes(physician.id)) {
            this.state.selectedPhysicianIds = [...this.state.selectedPhysicianIds, physician.id];
        }
        this.state.physicianSearchTerm = '';
        this.state.showPhysicianSuggestions = false;
        this.refreshData();
    }

    onCabinSuggestionClick = (cabin) => {
        if (!this.state.selectedCabinIds.includes(cabin.id)) {
            this.state.selectedCabinIds = [...this.state.selectedCabinIds, cabin.id];
        }
        this.state.cabinSearchTerm = '';
        this.state.showCabinSuggestions = false;
        this.refreshData();
    }

    removePhysicianSelection = (physicianId) => {
        this.state.selectedPhysicianIds = this.state.selectedPhysicianIds.filter(id => id !== physicianId);
        this.refreshData();
    }

    removeCabinSelection = (cabinId) => {
        this.state.selectedCabinIds = this.state.selectedCabinIds.filter(id => id !== cabinId);
        this.refreshData();
    }

    clearAllPhysicianSelections = () => {
        this.state.selectedPhysicianIds = [];
        this.refreshData();
    }

    clearAllCabinSelections = () => {
        this.state.selectedCabinIds = [];
        this.refreshData();
    }

    hidePhysicianSuggestions = () => {
        setTimeout(() => {
            this.state.showPhysicianSuggestions = false;
        }, 150);
    }

    hideCabinSuggestions = () => {
        setTimeout(() => {
            this.state.showCabinSuggestions = false;
        }, 150);
    }

    getFilteredPhysicianSuggestions = () => {
        const searchTerm = this.state.physicianSearchTerm.toLowerCase();
        return this.state.physicians.filter(physician =>
            physician.name.toLowerCase().includes(searchTerm) &&
            !this.state.selectedPhysicianIds.includes(physician.id)
        );
    }

    getFilteredCabinSuggestions = () => {
        const searchTerm = this.state.cabinSearchTerm.toLowerCase();
        return this.state.cabins.filter(cabin =>
            cabin.name.toLowerCase().includes(searchTerm) &&
            !this.state.selectedCabinIds.includes(cabin.id)
        );
    }

    getSelectedPhysicians = () => {
        return this.state.physicians.filter(physician =>
            this.state.selectedPhysicianIds.includes(physician.id)
        );
    }

    getSelectedCabins = () => {
        return this.state.cabins.filter(cabin =>
            this.state.selectedCabinIds.includes(cabin.id)
        );
    }

    getFilteredPhysicians = () => {
        if (this.state.selectedPhysicianIds.length > 0) {
            return this.getSelectedPhysicians();
        }
        return this.state.physicians;
    }

    getFilteredCabins = () => {
        if (this.state.selectedCabinIds.length > 0) {
            return this.getSelectedCabins();
        }
        return this.state.cabins;
    }

    getPhysicianIdsForAPI = () => {
        if (this.state.selectedPhysicianIds && this.state.selectedPhysicianIds.length > 0) {
            return this.state.selectedPhysicianIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        }

        if (this.state.physicians && this.state.physicians.length > 0) {
            return this.state.physicians.map(physician => parseInt(physician.id)).filter(id => !isNaN(id));
        }

        return [];
    }

    getCabinIdsForAPI = () => {
        if (this.state.selectedCabinIds && this.state.selectedCabinIds.length > 0) {
            return this.state.selectedCabinIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        }

        if (this.state.cabins && this.state.cabins.length > 0) {
            return this.state.cabins.map(cabin => parseInt(cabin.id)).filter(id => !isNaN(id));
        }

        return [];
    }

    // Helper method to format date only (without time)
    formatDateOnlyForBackend(date) {
        if (!date || isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    async validateDragAndDropConstraints(targetData, draggedEvent) {
        console.log('=== START: Validating drag and drop constraints ===', {
            targetData: targetData,
            draggedEvent: draggedEvent
        });

        try {
            // Get patient data from dragged event
            const patientGender = draggedEvent.patient_gender || null;
            const appointmentId = draggedEvent.id;
            const physicianId = targetData.physicianId || draggedEvent.doctor_id;
            let cabinId = targetData.cabinId || draggedEvent.cabin_id;

            console.log('DEBUG - Initial cabinId:', cabinId, 'type:', typeof cabinId);

            // Convert cabinId to integer
            if (cabinId) {
                cabinId = parseInt(cabinId);
            }

            if (!cabinId || isNaN(cabinId)) {
                console.error('Invalid cabinId:', cabinId);
                return {
                    isValid: false,
                    message: `Invalid cabin selected: ${cabinId}`
                };
            }

            // Calculate duration from event
            const eventStart = this.parseDateFromBackend(draggedEvent.start);
            const eventEnd = this.parseDateFromBackend(draggedEvent.stop);
            const durationMs = eventEnd.getTime() - eventStart.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            // Get target date and time
            const targetDate = targetData.date || this.formatDateForBackend(this.state.currentDate);
            const targetHour = targetData.hour || 0;
            const targetMinute = targetData.minute || 0;

            console.log('DEBUG - Validation parameters:', {
                cabinId: cabinId,
                targetDate: targetDate,
                targetHour: targetHour,
                targetMinute: targetMinute,
                durationHours: durationHours,
                patientGender: patientGender,
                appointmentId: appointmentId
            });

            // 1. Check cabin appointment conflict with gender validation
            if (cabinId && patientGender) {
                // Calculate correct start and end times
                const startDate = new Date(targetDate);
                startDate.setHours(targetHour, targetMinute, 0, 0);

                // Calculate end time based on duration (in milliseconds)
                const endDate = new Date(startDate.getTime() + (durationHours * 60 * 60 * 1000));

                const formattedStart = this.formatDateTimeForBackend(startDate);
                const formattedEnd = this.formatDateTimeForBackend(endDate);

                console.log('DEBUG - Calling cabin conflict check with CORRECT parameters:', {
                    cabin_id: cabinId,
                    start_datetime: formattedStart,
                    end_datetime: formattedEnd,
                    patient_gender: patientGender,
                    exclude_appointment_id: appointmentId
                });

                try {
                    const conflictCheck = await this.orm.call_kw(
                        'hms.appointment',
                        'check_cabin_appointment_conflict',
                        [],
                        {
                            cabin_id: cabinId,
                            start_datetime: formattedStart,
                            end_datetime: formattedEnd,
                            patient_gender: patientGender || false,
                            exclude_appointment_id: appointmentId || false
                        }
                    );

                    console.log('DEBUG - Cabin conflict check result:', conflictCheck);

                    if (conflictCheck && conflictCheck.hasConflict) {
                        return {
                            isValid: false,
                            message: conflictCheck.message || 'Cabin conflict detected'
                        };
                    }
                } catch (kwError) {
                    console.error('Error with call_kw, trying regular call:', kwError);

                    // Fallback to regular call with correct parameter order
                    const conflictCheck = await this.orm.call(
                        'hms.appointment',
                        'check_cabin_appointment_conflict',
                        [
                            cabinId,
                            formattedStart,
                            formattedEnd,
                            patientGender || false,
                            appointmentId || false
                        ]
                    );

                    console.log('DEBUG - Cabin conflict check result (fallback):', conflictCheck);

                    if (conflictCheck && conflictCheck.hasConflict) {
                        return {
                            isValid: false,
                            message: conflictCheck.message || 'Cabin conflict detected'
                        };
                    }
                }
            }

            // 2. Check physician break/leave period
            if (targetData.physicianId && targetData.physicianId !== draggedEvent.doctor_id) {
                const physicianBreakCheck = await this.checkPhysicianBreakPeriodForDrop(
                    targetData.physicianId,
                    targetDate,
                    targetHour,
                    targetMinute,
                    durationHours
                );

                if (physicianBreakCheck) {
                    return {
                        isValid: false,
                        message: `Doctor ${physicianBreakCheck.isLeave ? 'is on leave' : 'has break time'}`
                    };
                }
            }


            // 4. Check cabin break period
            if (targetData.cabinId && targetData.cabinId !== draggedEvent.cabin_id) {
                const cabinBreakCheck = await this.checkCabinBreakPeriodForDrop(
                    targetData.cabinId,
                    targetDate,
                    targetHour,
                    targetMinute,
                    durationHours
                );

                if (cabinBreakCheck) {
                    return {
                        isValid: false,
                        message: 'Cabin has break time'
                    };
                }
            }

            console.log('✅ All constraints satisfied');
            return {
                isValid: true,
                message: 'Validation passed'
            };

        } catch (error) {
            console.error('❌ Error validating drag and drop constraints:', error);
            return {
                isValid: false,
                message: error.message || 'Validation error occurred'
            };
        }
    }

    // Check physician break period for drag and drop
    async checkPhysicianBreakPeriodForDrop(physicianId, date, hour, minute, duration) {
        try {
            const startDate = new Date(date);
            startDate.setHours(hour, minute, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, minute, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            const breakPeriods = await this.orm.call(
                'hms.physician',
                'get_break_periods_for_range',
                [physicianId, this.formatDateOnlyForBackend(startDate), this.formatDateOnlyForBackend(endDate)]
            );

            if (breakPeriods && breakPeriods[physicianId]) {
                const breaks = breakPeriods[physicianId];
                for (const breakPeriod of breaks) {
                    const breakStart = new Date(breakPeriod.date + 'T' + breakPeriod.start_time);
                    const breakEnd = new Date(breakPeriod.date + 'T' + breakPeriod.end_time);

                    if (startDate < breakEnd && endDate > breakStart) {
                        return {
                            isLeave: breakPeriod.type === 'leave',
                            leaveName: breakPeriod.leave_name || '',
                            start: breakPeriod.start_time,
                            end: breakPeriod.end_time
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking physician break period for drop:', error);
            return null;
        }
    }

    // Check cabin break period for drag and drop
    async checkCabinBreakPeriodForDrop(cabinId, date, hour, minute, duration) {
        try {
            const startDate = new Date(date);
            startDate.setHours(hour, minute, 0, 0);
            const endDate = new Date(startDate);
            endDate.setHours(hour + duration, minute, 0, 0);

            const formattedStart = this.formatDateTimeForBackend(startDate);
            const formattedEnd = this.formatDateTimeForBackend(endDate);

            const breakPeriods = await this.orm.call(
                'appointment.cabin',
                'get_cabin_break_periods_for_range',
                [cabinId, this.formatDateOnlyForBackend(startDate), this.formatDateOnlyForBackend(endDate)]
            );

            if (breakPeriods && breakPeriods[cabinId]) {
                const breaks = breakPeriods[cabinId];
                for (const breakPeriod of breaks) {
                    const breakStart = new Date(breakPeriod.date + 'T' + breakPeriod.start_time);
                    const breakEnd = new Date(breakPeriod.date + 'T' + breakPeriod.end_time);

                    if (startDate < breakEnd && endDate > breakStart) {
                        return {
                            start: breakPeriod.start_time,
                            end: breakPeriod.end_time
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking cabin break period for drop:', error);
            return null;
        }
    }

    onEventMouseOver = (ev, event) => {
        if (!this.state) return;

        if (this.state.popupTimeout) {
            clearTimeout(this.state.popupTimeout);
            this.state.popupTimeout = null;
        }

        this.state.hoveredEvent = event;
        this.state.showEventPopup = true;
        this.state.popupEvent = event;
        this.adjustPopupPosition(ev.clientX, ev.clientY);
    }

    onEventMouseOut = (ev, event) => {
        if (!this.state) return;

        // Hide popup immediately without any delay or conditions
        this.state.hoveredEvent = null;
        this.state.showEventPopup = false;
        this.state.popupEvent = null;

        if (this.state.popupTimeout) {
            clearTimeout(this.state.popupTimeout);
            this.state.popupTimeout = null;
        }
    }

    onPopupMouseEnter = () => {
        // Remove all popup-related timeouts and clear state
        if (this.state.popupTimeout) {
            clearTimeout(this.state.popupTimeout);
            this.state.popupTimeout = null;
        }
    }

    onPopupMouseLeave = () => {
        // Hide popup immediately when mouse leaves the popup
        this.state.hoveredEvent = null;
        this.state.showEventPopup = false;
        this.state.popupEvent = null;

        if (this.state.popupTimeout) {
            clearTimeout(this.state.popupTimeout);
            this.state.popupTimeout = null;
        }
    }

    onCreateEvent = (slotData = null) => {
        this.openAppointmentPopup('create', null, slotData);
    }

    onEventClick = (appointmentId) => {
        this.openAppointmentPopup('edit', appointmentId);
    }

    onEventDragStart = (ev, event) => {
        this.state.draggedEvent = event;
        ev.dataTransfer.setData('text/plain', event.id);
        ev.dataTransfer.effectAllowed = 'move';

        ev.target.style.opacity = '0.5';
    }

    onMouseMove = (ev) => {
        if (this.state.showEventPopup && this.state.popupEvent) {
            this.adjustPopupPosition(ev.clientX, ev.clientY);
        }
    }

    closeEventPopup = () => {
        this.state.showEventPopup = false;
        this.state.popupEvent = null;
        this.state.hoveredEvent = null;

        if (this.state.popupTimeout) {
            clearTimeout(this.state.popupTimeout);
            this.state.popupTimeout = null;
        }
    }

    onDayHeaderClick = (day) => {
        const selectedDate = new Date(day.fullDate);
        localStorage.setItem('selected_calendar_date', selectedDate.toISOString());
        this.action.doAction({
            type: 'ir.actions.act_window',
            name: 'Appointment Calendar - Day View',
            res_model: 'hms.appointment',
            views: [[false, 'list']],
            target: 'current',
        });
    }

    onToday = () => {
        this.state.currentDate = new Date();
        this.refreshData();
    }

    generateWeekDays = (startDate = null) => {
        const start = startDate || new Date();
        const weekStart = new Date(start);
        const dayOfWeek = start.getDay();
        const daysToSubtract = (dayOfWeek + 1) % 7;
        weekStart.setDate(start.getDate() - daysToSubtract);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);

            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            days.push({
                date: this.formatDateForBackend(day),
                name: dayNames[day.getDay()],
                shortName: shortDayNames[day.getDay()],
                day: day.getDate(),
                month: monthNames[day.getMonth()],
                fullDate: day
            });
        }
        return days;
    }

    generateMonthDays = () => {
        const date = new Date(this.state.currentDate);
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        const firstDayOfWeek = firstDay.getDay();

        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const prevDate = new Date(firstDay);
            prevDate.setDate(prevDate.getDate() - (i + 1));
            days.push({
                date: this.formatDateForBackend(prevDate),
                day: prevDate.getDate(),
                month: 'prev',
                fullDate: prevDate,
                isCurrentMonth: false,
                shortName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][prevDate.getDay()],
                monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][prevDate.getMonth()]
            });
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const currentDate = new Date(year, month, day);
            days.push({
                date: this.formatDateForBackend(currentDate),
                day: day,
                month: 'current',
                fullDate: currentDate,
                isCurrentMonth: true,
                shortName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][currentDate.getDay()],
                monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentDate.getMonth()]
            });
        }

        const lastDayOfWeek = lastDay.getDay();
        const daysToAdd = 6 - lastDayOfWeek;

        for (let i = 1; i <= daysToAdd; i++) {
            const nextDate = new Date(lastDay);
            nextDate.setDate(nextDate.getDate() + i);
            days.push({
                date: this.formatDateForBackend(nextDate),
                day: nextDate.getDate(),
                month: 'next',
                fullDate: nextDate,
                isCurrentMonth: false,
                shortName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][nextDate.getDay()],
                monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][nextDate.getMonth()]
            });
        }

        return days;
    }

    loadPhysicians = async () => {
        try {
            const physicians = await this.orm.searchRead(
                'hms.physician',
                [['active', '=', true]],
                ['id', 'name', 'code', 'email', 'phone', 'department_id', 'resource_calendar_id']
            );

            console.log('Loaded physicians with calendar info:', physicians);

            const colors = [
                '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
                '#F44336', '#607D8B', '#795548', '#E91E63',
                '#00BCD4', '#8BC34A', '#FFC107', '#673AB7',
                '#3F51B5', '#009688', '#CDDC39', '#FF5722',
                '#795548', '#9E9E9E', '#607D8B', '#8BC34A',
                '#FFC107', '#FF9800', '#FF5722', '#F44336'
            ];

            const physicianColors = {};
            physicians.forEach((physician, index) => {
                physicianColors[physician.id] = colors[index % colors.length];
            });

            this.state.physicianColors = physicianColors;
            return physicians;
        } catch (error) {
            console.error('Error loading physicians:', error);
            return [];
        }
    }

    loadCabins = async () => {
        try {
            console.log('Loading cabins from database...');
            const cabins = await this.orm.searchRead(
                'appointment.cabin',
                [],
                ['id', 'name']
            );

            console.log('Cabins loaded:', cabins);

            const colors = [
                '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
                '#F44336', '#607D8B', '#795548', '#E91E63',
                '#00BCD4', '#8BC34A', '#FFC107', '#673AB7',
                '#3F51B5', '#009688', '#CDDC39', '#FF5722',
                '#795548', '#9E9E9E', '#607D8B', '#8BC34A',
                '#FFC107', '#FF9800', '#FF5722', '#F44336'
            ];

            const cabinColors = {};
            cabins.forEach((cabin, index) => {
                cabinColors[cabin.id] = colors[index % colors.length];
            });

            this.state.cabinColors = cabinColors;
            return cabins;
        } catch (error) {
            console.error('Error loading cabins:', error);
            return [];
        }
    }

    getPhysicianColor = (physicianId) => {
        return this.state.physicianColors[physicianId] || '#607D8B';
    }

    getCabinColor = (cabinId) => {
        return this.state.cabinColors[cabinId] || '#607D8B';
    }

    getPhysicianDisplayName = (physician) => {
        return physician.name;
    }

    getCabinDisplayName = (cabin) => {
        return cabin.name;
    }

    getEventTimeRange = (event) => {
        if (!event.start || !event.stop) return '';

        try {
            const start = this.parseDateFromBackend(event.start);
            const end = this.parseDateFromBackend(event.stop);
            return this.formatTime(start) + ' - ' + this.formatTime(end);
        } catch (error) {
            return '';
        }
    }

    formatTime = (date) => {
        if (!date || isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    formatDateForBackend = (date) => {
        if (!date || isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return year + '-' + month + '-' + day;
    }

    formatDateTimeForBackend = (date) => {
        if (!date || isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    }

    parseDateFromBackend = (dateString) => {
        if (!dateString) return new Date();

        try {
            let date;
            if (dateString.includes('T')) {
                date = new Date(dateString);
            } else {
                const [datePart, timePart] = dateString.split(' ');
                const [year, month, day] = datePart.split('-');
                const [hours, minutes, seconds] = timePart ? timePart.split(':') : ['00', '00', '00'];

                date = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds)
                );
            }

            return date;
        } catch (error) {
            console.error('Error parsing date:', error, dateString);
            return new Date();
        }
    }

    getEventGridStyle = (eventCount) => {
        if (eventCount === 1) return 'width: 100%;';
        if (eventCount === 2) return 'width: calc(50% - 1px);';
        if (eventCount === 3) return 'width: calc(33.333% - 1px);';
        if (eventCount === 4) return 'width: calc(25% - 1px);';
        return 'width: calc(20% - 1px); min-width: 80px;';
    }

    // NEW: Get event display style with rowspan calculation
    getEventDisplayStyle = (event) => {
        const rowSpan = this.getEventRowSpan(event);
        return `grid-row: span ${rowSpan}; position: relative;`;
    }

    getEventStyle = (event) => {
        const backgroundColor = this.getAppointmentStatusColor(event.appointment_status);
        return 'background-color: ' + backgroundColor + '; color: white; border-radius: 4px; padding: 4px; margin: 2px; cursor: move;';
    }

    getAppointmentStatusColor = (status) => {
        const statusColors = {
            'draft': '#6c757d',
            'no_answer': '#fd7e14',
            'call_back': '#ffc107',
            'posponed': '#8d6e63',
            'confirm': '#17a2b8',
            'booked': '#007bff',
            'arrived': '#6f42c1',
            'waiting': '#0056b3',
            'treatment': '#e83e8c',
            'in_consultation': '#9561e2',
            'basic_7_floor': '#20c997',
            'pause': '#ff6b6b',
            'to_invoice': '#f39c12',
            'gig_insurance': '#28a745',
            'billed': '#155724',
            'done': '#28a745',
            'cancelled': '#dc3545',
            'blocked': '#721c24',
            'follow_up': '#5bc0de',
            'feels_good': '#8bc34a'
        };
        return statusColors[status] || '#607D8B';
    }

    getEventPopupStyle = (event) => {
        const statusColor = this.getAppointmentStatusColor(event.appointment_status);
        return 'background-color: ' + statusColor + '; color: white;';
    }

    getEventPopupInfo = (event) => {
        if (!event) return {};

        const startTime = this.parseDateFromBackend(event.start);
        const endTime = this.parseDateFromBackend(event.stop);

        const formattedStart = this.formatTime(startTime);
        const formattedEnd = this.formatTime(endTime);
        const formattedDate = this.formatDateForBackend(startTime);

        const patientName = event.partner_names && event.partner_names.length > 0
            ? event.partner_names.join(', ')
            : event.patient_name || 'No patient';

        const patientGender = event.patient_gender || '';
        const patientPhone = event.patient_mobile || event.patient_phone || '';

        const statusColor = this.getAppointmentStatusColor(event.appointment_status);

        // Convert duration from hours to minutes
        let durationDisplay = '';
        if (event.duration) {
            const durationInMinutes = Math.round(event.duration * 60);

            if (durationInMinutes < 60) {
                // Less than an hour: show minutes only
                durationDisplay = `${durationInMinutes} minutes`;
            } else if (durationInMinutes % 60 === 0) {
                // Exact hours
                const hours = durationInMinutes / 60;
                durationDisplay = `${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                // Hours and minutes
                const hours = Math.floor(durationInMinutes / 60);
                const minutes = durationInMinutes % 60;
                durationDisplay = `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
        } else {
            durationDisplay = '1 hour'; // Default value
        }

        return {
            appointmentId: event.id,
            title: event.name,
            physician: event.doctor_name || event.physician_name || 'No physician',
            cabin: event.cabin_name || 'No cabin',
            department: event.doctor_specialty || event.department_name || 'No department',
            patient: patientName,
            patient_gender: patientGender,
            patient_phone: patientPhone,
            startTime: formattedStart,
            endTime: formattedEnd,
            date: formattedDate,
            duration: durationDisplay, // Modified here
            description: event.description || 'No description',
            appointment_status: event.appointment_status,
            statusColor: statusColor,
            notes: event.notes || '',
            patient_code: event.patient_code || ''

        };
    }

    // TIME CONFIGURATION: Enhanced time calculation with minute precision
    calculateNewEventTime = (targetData) => {
        try {
            console.log('Calculating new event time with targetData:', targetData);

            let newTime;

            if (targetData.date && targetData.hour !== undefined) {
                const [year, month, day] = targetData.date.split('-');

                newTime = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(targetData.hour),
                    parseInt(targetData.minute || 0),
                    0
                );
            } else if ((targetData.physicianId || targetData.cabinId) && targetData.hour !== undefined) {
                newTime = new Date(this.state.currentDate);
                newTime.setHours(
                    parseInt(targetData.hour),
                    parseInt(targetData.minute || 0),
                    0,
                    0
                );
            } else {
                console.warn('Invalid target data for time calculation:', targetData);
                return new Date();
            }

            console.log('Calculated new time:', newTime);
            return newTime;
        } catch (error) {
            console.error('Error calculating new appointment time:', error, targetData);
            return new Date();
        }
    }

    adjustPopupPosition = (clientX, clientY) => {
        const popupWidth = 400;
        const popupHeight = 300;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = clientX + 15;
        let y = clientY + 15;

        // Adjust for right edge
        if (x + popupWidth > viewportWidth) {
            x = clientX - popupWidth - 15;
        }

        // Adjust for bottom edge - show above cursor if near bottom
        if (clientY + 15 + popupHeight > viewportHeight) {
            y = clientY - popupHeight - 15;
        }

        // Ensure popup stays within viewport boundaries
        x = Math.max(10, Math.min(x, viewportWidth - popupWidth - 10));
        y = Math.max(10, Math.min(y, viewportHeight - popupHeight - 10));

        this.state.popupPosition = { x, y };
    }

    isValidDate = (date) => {
        return date && !isNaN(date.getTime());
    }
}
