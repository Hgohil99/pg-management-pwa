# 🏠 PG Manager

A full-stack Progressive Web App (PWA) for managing Paying Guest accommodations. Built with vanilla JavaScript, Firebase, and Cloudinary.

## 🚀 Live Demo
👉 [pg-management-app-67141.web.app](https://pg-management-app-67141.web.app)

## ✨ Features

### 🔐 Authentication & Authorization
- Email/Password authentication with Firebase Auth
- Role-based access control (Product Owner, Manager, Resident, Karyakar)
- Auto-logout after 15 minutes of inactivity
- Session invalidation across devices

### 👥 User Management
- Registration with validation (email, mobile, duplicate detection)
- Manager approval workflow
- Reorderable resident list with drag-and-drop
- Presence tracking (Check In/Check Out)

### 💰 Rent Management
- Monthly rent tracking with payment screenshots
- Cloudinary signed uploads for secure file storage
- Rent history with date tracking
- Manager verification workflow

### 🧾 Expense Tracker
- Category-based expense logging
- Pending/Settled tab views
- Auto-cleanup of settled expenses after 14 days
- Settlement workflow with notifications

### 📋 Attendance System
- Check In/Out with 48-hour advance booking
- Duplicate check-in prevention
- Presence synced across all pages in real-time
- Attendance history

### 🧹 Task Management
- Kitchen cleaning rotation (auto-assign from present list)
- Weekly Fruits & Vegetables assignment
- Sabha (meeting) task assignment with accept/reject
- Automatic reassignment when users check out

### 🎨 UI/UX
- Dark/Light theme toggle
- PWA - installable on mobile devices
- Responsive hamburger menu
- Real-time data updates via Firestore listeners
- Profile management with role switching

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend | Firebase (Auth, Firestore, Hosting) |
| File Storage | Cloudinary (Signed Uploads) |
| API Layer | Vercel Serverless Functions |
| PWA | Service Workers, Web App Manifest |
| Security | Firebase Security Rules, API Key Restrictions, XSS Sanitization |

## 📐 Architecture
┌─────────────┐ ┌──────────────┐ ┌─────────────┐
│ Client │────▶│ Firebase │────▶│ Firestore │
│ (PWA/SPA) │ │ Hosting │ │ (Database) │
└─────────────┘ └──────────────┘ └─────────────┘
│ │
▼ ▼
┌─────────────┐ ┌──────────────┐
│ Cloudinary │ │ Vercel │
│ (Uploads) │ │ (API/CRON) │
└─────────────┘ └──────────────┘