# Nanakshahi Calendar Subscription

This project provides a simple and elegant webpage for subscribing to the Nanakshahi Calendar. The calendar includes Gurpurabs and significant Sikh historical dates, which can be synced with your personal calendar applications like Google Calendar and Apple Calendar.

## Features

- **Google Calendar Integration**: Easily add the Nanakshahi Calendar to your Google Calendar.
- **Apple Calendar Integration**: Subscribe to the calendar on Apple devices.
- **Responsive Design**: The webpage is optimized for both desktop and mobile devices.
- **Lightweight and Fast**: Minimalistic design with a focus on performance.

## Live Demo

You can view the live webpage [here](https://sagalpreet.github.io/projects/nanakshahi_calendar/index.html).

## How to Use

1. Open the webpage in your browser.
2. Click on the "Add to Google Calendar" button to sync with Google Calendar.
3. Alternatively, click on the "Subscribe on Apple Devices" button to sync with Apple Calendar.

## Project Structure

```
nanakshahi_calendar/
├── index.html                # Main entry point for the webpage
└── assets
    └── script.js             # JS script for data extraction from Nanakshahi Calendar
```

## Development

### Prerequisites

- A modern web browser for testing.
- A text editor like VS Code for making changes.

### Steps to Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/sagalpreet/projects.git
   ```
2. Navigate to the project directory:
   ```bash
   cd nanakshahi-calendar
   ```
3. Open the `index.html` file in your browser to view the webpage.

## Tracking Visitors

This project includes Google Analytics integration to track the number of visitors.

## Credits

- **Data Source**: [nanakshahi.net/calendar](https://nanakshahi.net/calendar/)
- **Creator**: [Sagalpreet Singh](https://sagalpreet.github.io)

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Data Source

The data for this project is obtained from [nanakshahi.net/calendar](https://nanakshahi.net/calendar). The script used to process and manage this data is located in the `assets` folder within the `nanakshahi_calendar` directory.

The ICS file for the calendar is hosted on a GitHub Gist: [Nanakshahi.ics](https://gist.githubusercontent.com/sagalpreet/217c93d8b3c4361e594230f739650447/raw/Nanakshahi.ics). The content of this Gist will be manually updated annually using the script located in the `assets` folder.