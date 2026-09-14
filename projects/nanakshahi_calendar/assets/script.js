(async function extractCalendarToICS() {
    console.log("Starting Calendar Scraper for 2026...");

    // Store unique events to avoid duplicates (Key: "YYYY-MM-DD|Title")
    const eventSet = new Set();
    const eventsList = [];

    // Helper: Pause execution to allow DOM to render
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper: Format date for ICS (YYYYMMDD)
    const formatDateToICS = (dateString) => {
        return dateString.replace(/-/g, '');
    };

    // Helper: Escape special characters for ICS format
    const escapeICS = (str) => {
        return str.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
    };

    // Core scraping function for the current view
    const scrapeCurrentView = () => {
        const dayCells = document.querySelectorAll('.fc-daygrid-day');
        
        dayCells.forEach(cell => {
            const date = cell.getAttribute('data-date');
            
            // Only process dates in 2026
            if (!date || !date.startsWith('2026')) return;

            // Find event titles within the day cell
            const titles = cell.querySelectorAll('.fc-event-title');

            titles.forEach(titleEl => {
                const title = titleEl.innerText.trim();
                const uniqueKey = `${date}|${title}`;

                if (!eventSet.has(uniqueKey)) {
                    eventSet.add(uniqueKey);
                    eventsList.push({
                        date: date,
                        title: title
                    });
                }
            });
        });
    };

    // Main Loop
    let currentMonthIndex = 0; // 0 = Jan, 11 = Dec
    const targetYear = "2026";
    
    // Ensure we are scraping the correct year/months. 
    // This loop assumes the calendar is currently open to January 2026 (as per your code snippet).
    while (currentMonthIndex < 12) {
        
        // 1. Get current title to verify progress (for logging)
        const titleEl = document.querySelector('.fc-toolbar-title');
        const currentTitle = titleEl ? titleEl.innerText : "Unknown";
        console.log(`Scraping: ${currentTitle}`);

        // 2. Scrape data
        scrapeCurrentView();

        // 3. Check if we are done (If we just scraped December)
        if (currentTitle.includes(`December ${targetYear}`)) {
            break;
        }

        // 4. Navigate to next month
        const nextBtn = document.querySelector('.fc-next-button');
        if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
            currentMonthIndex++;
            // Wait for animation/AJAX to finish rendering the new month
            await sleep(800); 
        } else {
            console.warn("Next button not found or disabled. Stopping.");
            break;
        }
    }

    console.log(`Scraping complete. Found ${eventsList.length} events.`);

    // --- Generate ICS Content ---
    let icsContent = "BEGIN:VCALENDAR\r\n";
    icsContent += "VERSION:2.0\r\n";
    icsContent += "PRODID:-//Nanakshahi Calendar//Scraper//EN\r\n";
    icsContent += "CALSCALE:GREGORIAN\r\n";
    icsContent += "METHOD:PUBLISH\r\n";

    eventsList.forEach(evt => {
        const icsDate = formatDateToICS(evt.date);
        const uuid = crypto.randomUUID(); // specific ID for the event
        const cleanTitle = escapeICS(evt.title);

        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += `UID:${uuid}\r\n`;
        icsContent += `DTSTART;VALUE=DATE:${icsDate}\r\n`;
        // All-day events usually don't need DTEND for single days in some clients, 
        // but standards suggest DTEND is the next day.
        // For simplicity in this scraping context, we leave DTEND open or same day + duration if needed.
        // Most clients handle VALUE=DATE correctly as a single day.
        icsContent += `SUMMARY:${cleanTitle}\r\n`;
        icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR";

    // --- Trigger Download ---
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nanakshahi_calendar_2026.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

})();