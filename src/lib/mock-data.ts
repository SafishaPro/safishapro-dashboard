export const kpis = [
  { label: "Total Bookings", value: "1,284", delta: "+12.4%", tone: "up" as const },
  { label: "Active Cleaners", value: "86", delta: "+3", tone: "up" as const },
  { label: "Revenue (KES)", value: "3.42M", delta: "+8.1%", tone: "up" as const },
  { label: "Open Tickets", value: "27", delta: "-4", tone: "down" as const },
];

export const bookingsOverTime = [
  { name: "Mon", bookings: 42, revenue: 82000 },
  { name: "Tue", bookings: 51, revenue: 96000 },
  { name: "Wed", bookings: 48, revenue: 91000 },
  { name: "Thu", bookings: 62, revenue: 118000 },
  { name: "Fri", bookings: 78, revenue: 152000 },
  { name: "Sat", bookings: 94, revenue: 189000 },
  { name: "Sun", bookings: 71, revenue: 141000 },
];

export const customers = [
  { id: "C-1001", name: "Amina Yusuf", email: "amina@mail.com", phone: "+254 700 111 222", bookings: 14, address: "Kilimani, Nairobi" },
  { id: "C-1002", name: "Brian Otieno", email: "brian@mail.com", phone: "+254 711 333 444", bookings: 6, address: "Westlands, Nairobi" },
  { id: "C-1003", name: "Cynthia Mwangi", email: "cindy@mail.com", phone: "+254 722 555 666", bookings: 22, address: "Karen, Nairobi" },
  { id: "C-1004", name: "David Kimani", email: "dave@mail.com", phone: "+254 733 777 888", bookings: 3, address: "Lavington, Nairobi" },
  { id: "C-1005", name: "Esther Njeri", email: "esther@mail.com", phone: "+254 744 999 000", bookings: 11, address: "Runda, Nairobi" },
];

export const staff = [
  { id: "S-01", name: "James Owuor", email: "james@safisha.pro", role: "Operations Manager", status: "Active" },
  { id: "S-02", name: "Grace Wanjiku", email: "grace@safisha.pro", role: "Dispatcher", status: "Active" },
  { id: "S-03", name: "Peter Kariuki", email: "peter@safisha.pro", role: "Finance Officer", status: "Active" },
  { id: "S-04", name: "Lucy Adhiambo", email: "lucy@safisha.pro", role: "Customer Support Officer", status: "On Leave" },
  { id: "S-05", name: "Mark Ochieng", email: "mark@safisha.pro", role: "Reporting Analyst", status: "Active" },
];

export const cleaners = [
  { id: "CL-01", name: "Fatuma Ali", zone: "Nairobi CBD", rating: 4.9, jobs: 128, status: "Verified", availability: "Available" },
  { id: "CL-02", name: "Joseph Mutua", zone: "Westlands", rating: 4.7, jobs: 96, status: "Verified", availability: "On Job" },
  { id: "CL-03", name: "Mercy Chebet", zone: "Karen", rating: 4.8, jobs: 154, status: "Verified", availability: "Available" },
  { id: "CL-04", name: "Samuel Kiprop", zone: "Kilimani", rating: 4.5, jobs: 42, status: "Pending BG Check", availability: "Unavailable" },
  { id: "CL-05", name: "Ruth Njoki", zone: "Runda", rating: 4.9, jobs: 201, status: "Verified", availability: "Available" },
  { id: "CL-06", name: "Ali Hassan", zone: "Lavington", rating: 4.6, jobs: 78, status: "Verified", availability: "On Job" },
];

export const bookings = [
  { id: "BK-2401", customer: "Amina Yusuf", cleaner: "Fatuma Ali", service: "Deep Clean", date: "2026-07-25 10:00", status: "In Progress", amount: 4500 },
  { id: "BK-2402", customer: "Brian Otieno", cleaner: "Joseph Mutua", service: "Standard Clean", date: "2026-07-25 13:00", status: "Pending", amount: 2800 },
  { id: "BK-2403", customer: "Cynthia Mwangi", cleaner: "Mercy Chebet", service: "Move Out", date: "2026-07-24 09:00", status: "Completed", amount: 7200 },
  { id: "BK-2404", customer: "David Kimani", cleaner: "Ruth Njoki", service: "Office Clean", date: "2026-07-26 08:00", status: "Pending", amount: 12500 },
  { id: "BK-2405", customer: "Esther Njeri", cleaner: "Ali Hassan", service: "Deep Clean", date: "2026-07-23 14:00", status: "Cancelled", amount: 4500 },
  { id: "BK-2406", customer: "Amina Yusuf", cleaner: "Ruth Njoki", service: "Standard Clean", date: "2026-07-27 11:00", status: "Pending", amount: 2800 },
];

export const payments = [
  { id: "PAY-9001", booking: "BK-2401", customer: "Amina Yusuf", amount: 4500, method: "M-Pesa", ref: "SGH8KX2LQP", status: "Paid", date: "2026-07-25" },
  { id: "PAY-9002", booking: "BK-2403", customer: "Cynthia Mwangi", amount: 7200, method: "M-Pesa", ref: "TFT9LM3RRA", status: "Paid", date: "2026-07-24" },
  { id: "PAY-9003", booking: "BK-2402", customer: "Brian Otieno", amount: 2800, method: "Card", ref: "CH_1KsFq", status: "Pending", date: "2026-07-25" },
  { id: "PAY-9004", booking: "BK-2404", customer: "David Kimani", amount: 12500, method: "M-Pesa", ref: "SGH4LK9ZPO", status: "Failed", date: "2026-07-26" },
];

export const payouts = [
  { id: "PO-501", cleaner: "Fatuma Ali", period: "Jul 15 – Jul 21", amount: 24500, status: "Paid", date: "2026-07-22" },
  { id: "PO-502", cleaner: "Mercy Chebet", period: "Jul 15 – Jul 21", amount: 31200, status: "Paid", date: "2026-07-22" },
  { id: "PO-503", cleaner: "Joseph Mutua", period: "Jul 22 – Jul 28", amount: 18900, status: "Pending", date: "2026-07-29" },
  { id: "PO-504", cleaner: "Ruth Njoki", period: "Jul 22 – Jul 28", amount: 40100, status: "Pending", date: "2026-07-29" },
];

export const tickets = [
  { id: "T-301", subject: "Cleaner was late", customer: "Brian Otieno", priority: "High", status: "Open", updated: "2h ago" },
  { id: "T-302", subject: "Refund request", customer: "Esther Njeri", priority: "Medium", status: "In Review", updated: "5h ago" },
  { id: "T-303", subject: "App can't book", customer: "David Kimani", priority: "Low", status: "Open", updated: "1d ago" },
  { id: "T-304", subject: "Payout missing", customer: "Fatuma Ali (Cleaner)", priority: "High", status: "Escalated", updated: "30m ago" },
];

export const notifications = [
  { id: "N-1", type: "SMS", channel: "Twilio", message: "Booking BK-2401 confirmed", to: "+254 700 111 222", date: "2026-07-25 09:55" },
  { id: "N-2", type: "Email", channel: "Sendgrid", message: "Invoice INV-9002 sent", to: "cindy@mail.com", date: "2026-07-24 12:10" },
  { id: "N-3", type: "System", channel: "Internal", message: "Cleaner CL-04 verification pending", to: "Ops", date: "2026-07-25 08:00" },
];

export const services = [
  { id: "SV-1", name: "Standard Clean", basePrice: 2800, duration: "2h" },
  { id: "SV-2", name: "Deep Clean", basePrice: 4500, duration: "4h" },
  { id: "SV-3", name: "Move Out", basePrice: 7200, duration: "6h" },
  { id: "SV-4", name: "Office Clean", basePrice: 12500, duration: "8h" },
];

export const auditLogs = [
  { id: "A-1", actor: "James Owuor", action: "Assigned BK-2402 to Joseph Mutua", date: "2026-07-25 09:30" },
  { id: "A-2", actor: "Peter Kariuki", action: "Processed payout PO-501", date: "2026-07-22 16:20" },
  { id: "A-3", actor: "System Administrator", action: "Updated role permissions for Dispatcher", date: "2026-07-24 11:00" },
];

// Cleaner portal
export const cleanerSchedule = [
  { id: "BK-2401", service: "Deep Clean", customer: "Amina Yusuf", address: "Kilimani, Nairobi", date: "2026-07-25 10:00", pay: 3200 },
  { id: "BK-2410", service: "Standard Clean", customer: "Faith Kamau", address: "Kileleshwa, Nairobi", date: "2026-07-26 09:00", pay: 2000 },
];

export const cleanerEarnings = [
  { period: "Week 28", jobs: 6, earnings: 18500, rating: 4.8 },
  { period: "Week 29", jobs: 8, earnings: 24500, rating: 4.9 },
  { period: "Week 30", jobs: 5, earnings: 15100, rating: 4.7 },
];

// Customer portal
export const customerBookings = [
  { id: "BK-2401", service: "Deep Clean", cleaner: "Fatuma Ali", date: "2026-07-25 10:00", status: "In Progress", amount: 4500 },
  { id: "BK-2380", service: "Standard Clean", cleaner: "Mercy Chebet", date: "2026-07-10 11:00", status: "Completed", amount: 2800 },
  { id: "BK-2350", service: "Move Out", cleaner: "Ruth Njoki", date: "2026-06-28 09:00", status: "Completed", amount: 7200 },
];
