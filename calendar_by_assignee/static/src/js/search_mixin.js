/** @odoo-module **/

export const searchMixin = {
    // Initialize search state
    setupSearchState() {
        if (!this.state) {
            console.error('State is not available in search mixin');
            return;
        }

        this.state.searchField = 'physician';
        this.state.searchInput = '';
        this.state.searchTerms = {
            physician: [],
            patient: [],
            phone: [],
            appointment: [],
            cabin: [],
            status: []
        };
        this.state.searchFields = [
            { value: 'physician', label: 'Physician' },
            { value: 'patient', label: 'Patient' },
            { value: 'phone', label: 'Phone' },
            { value: 'appointment', label: 'Appointment' },
            { value: 'cabin', label: 'Clinic' }, // CHANGED: Cabin to Clinic
            { value: 'status', label: 'Status' }
        ];
        this.state.showSearchSuggestions = false;

        // Updated status options with display names
        this.state.statusOptions = [
            { value: 'draft', label: 'Draft' },
            { value: 'no_answer', label: 'No Answer' },
            { value: 'call_back', label: 'Call Back' },
            { value: 'posponed', label: 'Postponed' },
            { value: 'confirm', label: 'Confirm' },
            { value: 'booked', label: 'Booked' },
            { value: 'arrived', label: 'Arrived' },
            { value: 'waiting', label: 'Waiting' },
            { value: 'treatment', label: 'Treatment' },
            { value: 'in_consultation', label: 'In Consultation' },
            { value: 'basic_7_floor', label: 'Basic 7th Floor' },
            { value: 'pause', label: 'Pause' },
            { value: 'to_invoice', label: 'To Invoice' },
            { value: 'gig_insurance', label: 'GIG Insurance' },
            { value: 'billed', label: 'Billed' },
            { value: 'done', label: 'Done' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'blocked', label: 'Blocked' },
            { value: 'follow_up', label: 'Follow Up' },
            { value: 'feels_good', label: 'Feels Good' }
        ];

        // Initialize suggestion arrays
        this.state.patientSuggestions = [];
        this.state.appointmentSuggestions = [];
        this.state.cabinSuggestions = [];
    },

    // Check if there is an active search
    hasActiveSearch() {
        if (!this.state) return false;
        const currentField = this.state.searchField;
        const searchTerms = this.state.searchTerms[currentField];
        return searchTerms && searchTerms.length > 0;
    },

    // Handle search field change
    onSearchFieldChange(ev) {
        if (!this.state) return;
        this.state.searchField = ev.target.value;
        this.state.searchInput = '';
        this.state.showSearchSuggestions = false;
        if (this.refreshData) {
            this.refreshData();
        }
    },

    // Handle search input change - FIXED FOR STATUS
    async onSearchInputChange(ev) {
        if (!this.state) return;

        const value = ev.target.value;
        this.state.searchInput = value;

        // Show suggestions for status field immediately
        if (this.state.searchField === 'status') {
            this.state.showSearchSuggestions = value.length > 0;
            return;
        }

        // Show suggestions for other fields (except phone)
        if (this.state.searchField !== 'phone' && value.length > 1) {
            await this.loadSearchSuggestions();
            this.state.showSearchSuggestions = true;
        } else {
            this.state.showSearchSuggestions = false;
        }
    },

    // Handle search key press (for Enter key)
    onSearchKeyPress(ev) {
        if (ev.key === 'Enter' && this.state && this.state.searchInput) {
            this.addSearchTerm(this.state.searchInput);
            this.state.searchInput = '';
            this.state.showSearchSuggestions = false;
        }
    },

    // Add search term
    addSearchTerm(term) {
        if (!this.state || !term) return;
        const currentField = this.state.searchField;
        if (!this.state.searchTerms[currentField].includes(term)) {
            this.state.searchTerms[currentField].push(term);
        }
        this.state.searchInput = '';
        this.state.showSearchSuggestions = false;
        if (this.refreshData) {
            this.refreshData();
        }
    },

    // Remove search term by index
    removeSearchTerm(index) {
        if (!this.state) return;
        const currentField = this.state.searchField;
        if (index >= 0 && index < this.state.searchTerms[currentField].length) {
            this.state.searchTerms[currentField].splice(index, 1);
        }
        if (this.refreshData) {
            this.refreshData();
        }
    },

    // Clear all search terms
    clearSearch() {
        if (!this.state) return;
        const currentField = this.state.searchField;
        this.state.searchTerms[currentField] = [];
        this.state.searchInput = '';
        this.state.showSearchSuggestions = false;
        if (this.refreshData) {
            this.refreshData();
        }
    },

    // Hide search suggestions
    hideSearchSuggestions() {
        if (!this.state) return;
        setTimeout(() => {
            this.state.showSearchSuggestions = false;
        }, 150);
    },

    // Load search suggestions
    async loadSearchSuggestions() {
        if (!this.state || !this.orm) return;

        const searchInput = this.state.searchInput.toLowerCase();
        if (!searchInput || searchInput.length < 2) return;

        try {
            switch (this.state.searchField) {
                case 'patient':
                    const patients = await this.orm.searchRead(
                        'hms.patient',
                        [['name', 'ilike', searchInput]],
                        ['id', 'name', 'phone', 'mobile'],
                        { limit: 10 }
                    );
                    this.state.patientSuggestions = patients;
                    break;

                case 'appointment':
                    const appointments = await this.orm.searchRead(
                        'hms.appointment',
                        [['name', 'ilike', searchInput]],
                        ['id', 'name', 'patient_id'],
                        { limit: 10 }
                    );
                    this.state.appointmentSuggestions = appointments;
                    break;

                case 'cabin':
                    const cabins = await this.orm.searchRead(
                        'appointment.cabin',
                        [['name', 'ilike', searchInput]],
                        ['id', 'name'],
                        { limit: 10 }
                    );
                    this.state.cabinSuggestions = cabins;
                    break;

                // For status field, we don't need to load from server
                // since status options are predefined
                case 'status':
                    // Status options are already loaded in setupSearchState
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error('Error loading search suggestions:', error);
        }
    },

    // Get search suggestions for current field - FIXED FOR STATUS
    getSearchSuggestions() {
        if (!this.state) return [];

        // No suggestions for phone field
        if (this.state.searchField === 'phone') {
            return [];
        }

        const searchInput = this.state.searchInput.toLowerCase();
        if (!searchInput) return [];

        try {
            switch (this.state.searchField) {
                case 'physician':
                    return (this.state.physicians || [])
                        .filter(physician =>
                            physician.name.toLowerCase().includes(searchInput) &&
                            !this.state.searchTerms.physician.includes(physician.name)
                        )
                        .slice(0, 10); // Limit to 10 suggestions
                case 'patient':
                    return (this.state.patientSuggestions || [])
                        .filter(patient =>
                            patient.name.toLowerCase().includes(searchInput) &&
                            !this.state.searchTerms.patient.includes(patient.name)
                        )
                        .slice(0, 10);
                case 'appointment':
                    return (this.state.appointmentSuggestions || [])
                        .filter(appointment =>
                            appointment.name.toLowerCase().includes(searchInput) &&
                            !this.state.searchTerms.appointment.includes(appointment.name)
                        )
                        .slice(0, 10);
                case 'cabin':
                    return (this.state.cabinSuggestions || [])
                        .filter(cabin =>
                            cabin.name.toLowerCase().includes(searchInput) &&
                            !this.state.searchTerms.cabin.includes(cabin.name)
                        )
                        .slice(0, 10);
                case 'status':
                    // FIXED: Ensure statusOptions are available
                    if (!this.state.statusOptions || this.state.statusOptions.length === 0) {
                        console.warn('Status options are empty in getSearchSuggestions');
                        // Reinitialize if empty
                        this.state.statusOptions = [
                            { value: 'draft', label: 'Draft' },
                            { value: 'no_answer', label: 'No Answer' },
                            { value: 'call_back', label: 'Call Back' },
                            { value: 'posponed', label: 'Postponed' },
                            { value: 'confirm', label: 'Confirm' },
                            { value: 'booked', label: 'Booked' },
                            { value: 'arrived', label: 'Arrived' },
                            { value: 'waiting', label: 'Waiting' },
                            { value: 'treatment', label: 'Treatment' },
                            { value: 'in_consultation', label: 'In Consultation' },
                            { value: 'basic_7_floor', label: 'Basic 7th Floor' },
                            { value: 'pause', label: 'Pause' },
                            { value: 'to_invoice', label: 'To Invoice' },
                            { value: 'gig_insurance', label: 'GIG Insurance' },
                            { value: 'billed', label: 'Billed' },
                            { value: 'done', label: 'Done' },
                            { value: 'cancelled', label: 'Cancelled' },
                            { value: 'blocked', label: 'Blocked' },
                            { value: 'follow_up', label: 'Follow Up' },
                            { value: 'feels_good', label: 'Feels Good' }
                        ];
                    }

                    // Filter status options
                    const filtered = this.state.statusOptions.filter(statusOption => {
                        if (!statusOption || !statusOption.value || !statusOption.label) {
                            return false;
                        }

                        const valueMatch = statusOption.value.toLowerCase().includes(searchInput);
                        const labelMatch = statusOption.label.toLowerCase().includes(searchInput);
                        const alreadyAdded = this.state.searchTerms.status.includes(statusOption.value);

                        return (valueMatch || labelMatch) && !alreadyAdded;
                    });

                    // Sort by relevance: exact matches first, then starts with, then contains
                    return filtered.sort((a, b) => {
                        const aLabel = a.label.toLowerCase();
                        const bLabel = b.label.toLowerCase();
                        const aValue = a.value.toLowerCase();
                        const bValue = b.value.toLowerCase();

                        // Check exact matches
                        if (aLabel === searchInput || aValue === searchInput) return -1;
                        if (bLabel === searchInput || bValue === searchInput) return 1;

                        // Check starts with
                        const aStartsWith = aLabel.startsWith(searchInput) || aValue.startsWith(searchInput);
                        const bStartsWith = bLabel.startsWith(searchInput) || bValue.startsWith(searchInput);

                        if (aStartsWith && !bStartsWith) return -1;
                        if (!aStartsWith && bStartsWith) return 1;

                        // Alphabetical order
                        return aLabel.localeCompare(bLabel);
                    });
                default:
                    return [];
            }
        } catch (error) {
            console.error('Error getting search suggestions:', error);
            return [];
        }
    },

    // Handle search suggestion click - FIXED FOR PRODUCTION ISSUE
    onSearchSuggestionClick(suggestion) {
        if (!this.state) {
            console.error('State is undefined in onSearchSuggestionClick');
            return;
        }

        // Prevent default behavior to avoid any unwanted actions
        event.preventDefault();
        event.stopPropagation();

        let termToAdd = '';
        let displayTerm = '';

        switch (this.state.searchField) {
            case 'physician':
                termToAdd = suggestion.name;
                displayTerm = suggestion.name;
                break;
            case 'patient':
                termToAdd = suggestion.name;
                displayTerm = suggestion.name;
                break;
            case 'appointment':
                termToAdd = suggestion.name;
                displayTerm = suggestion.name;
                break;
            case 'cabin':
                termToAdd = suggestion.name;
                displayTerm = suggestion.name;
                break;
            case 'status':
                // For status, we store the value but display the label
                termToAdd = suggestion.value;
                displayTerm = suggestion.label;
                break;
            case 'phone':
                termToAdd = suggestion;
                displayTerm = suggestion;
                break;
            default:
                termToAdd = suggestion.name || suggestion.value;
                displayTerm = suggestion.name || suggestion.label || suggestion.value;
        }

        // Store the actual value (termToAdd) for filtering
        if (termToAdd && !this.state.searchTerms[this.state.searchField].includes(termToAdd)) {
            this.state.searchTerms[this.state.searchField].push(termToAdd);
        }

        this.state.searchInput = '';
        this.state.showSearchSuggestions = false;

        // Use setTimeout to avoid blocking the main thread and prevent issues on production
        setTimeout(() => {
            if (this.refreshData) {
                this.refreshData();
            }
        }, 100);
    },

    // Get current search terms for display - FIXED FOR STATUS
    getCurrentSearchTerms() {
        if (!this.state || !this.state.searchField || !this.state.searchTerms) {
            return [];
        }

        const terms = this.state.searchTerms[this.state.searchField] || [];

        // For status field, convert values to display labels
        if (this.state.searchField === 'status' && this.state.statusOptions) {
            return terms.map(termValue => {
                const statusOption = this.state.statusOptions.find(option => option.value === termValue);
                return statusOption ? statusOption.label : termValue;
            });
        }

        return terms;
    },

    // Filter events based on search criteria - FIXED FOR STATUS
    filterEventsBySearch(eventsData) {
        if (!this.state) return eventsData;

        const currentField = this.state.searchField;
        const searchTerms = this.state.searchTerms[currentField];

        if (!searchTerms || searchTerms.length === 0) {
            return eventsData;
        }

        const filteredEvents = {};

        Object.entries(eventsData).forEach(([id, events]) => {
            const filteredEventsList = events.filter(event => {
                try {
                    switch (currentField) {
                        case 'physician':
                            const doctorName = event.doctor_name || '';
                            return searchTerms.some(term =>
                                doctorName.toLowerCase().includes(term.toLowerCase())
                            );
                        case 'patient':
                            const patientNames = event.partner_names || [];
                            const patientName = event.patient_name || '';
                            return searchTerms.some(term =>
                                patientNames.some(name =>
                                    name && name.toLowerCase().includes(term.toLowerCase())
                                ) || patientName.toLowerCase().includes(term.toLowerCase())
                            );
                        case 'phone':
                            const phone = event.patient_phone || '';
                            const mobile = event.patient_mobile || '';
                            return searchTerms.some(term => {
                                const cleanTerm = term.replace(/\s+/g, '').toLowerCase();
                                const cleanPhone = phone.replace(/\s+/g, '').toLowerCase();
                                const cleanMobile = mobile.replace(/\s+/g, '').toLowerCase();
                                return cleanPhone.includes(cleanTerm) || cleanMobile.includes(cleanTerm);
                            });
                        case 'appointment':
                            const appointmentName = event.name || '';
                            return searchTerms.some(term =>
                                appointmentName.toLowerCase().includes(term.toLowerCase())
                            );
                        case 'cabin':
                            const cabinName = event.cabin_name || '';
                            return searchTerms.some(term =>
                                cabinName.toLowerCase().includes(term.toLowerCase())
                            );
                        case 'status':
                            const appointmentStatus = event.appointment_status || '';
                            return searchTerms.some(term =>
                                appointmentStatus.toLowerCase().includes(term.toLowerCase())
                            );
                        default:
                            return true;
                    }
                } catch (error) {
                    console.error('Error filtering event:', error, event);
                    return false;
                }
            });

            if (filteredEventsList.length > 0) {
                filteredEvents[id] = filteredEventsList;
            }
        });

        return filteredEvents;
    }
};