# Implementation Plan - Barbearia da Baixada

A premium, localized web application for a modern barbershop with appointment-only services and dynamic pricing.

## 🎨 Design System
- **Theme**: Dark Mode (Slate/Charcoal) with Gold (#D4AF37) accents.
- **Glassmorphism**: Semi-transparent cards with backdrop blur.
- **Typography**: Inter or Montserrat (Google Fonts) for a modern, clean look.
- **Micro-interactions**: Hover effects on cards, smooth transitions between sections.

## 🛠 Features
- **Landing Page**: Service showcase and "Book Now" CTA.
- **User Authentication**:
  - Client Registration/Login.
  - Role-based access (Client vs. Barber/Admin).
- **Appointment System**:
  - Date picking (Mon-Sun).
  - **Sunday Constraint**: If Sunday is selected, ask for "Address" (A domicilio).
  - **Dynamic Pricing**:
    - Corte Social: R$20 (Mon-Sat) / R$25 (Sun).
    - Degradê: R$25 (Mon-Sat) / R$30 (Sun).
    - Barba: R$5.
    - Sobrancelha: R$5.
- **Barber Dashboard**:
  - View all scheduled appointments.
  - Mark as completed.
  - Financial summary: Revenue per day/week.

## 📂 File Structure
- `index.html`: Shell and SPA containers.
- `style.css`: Design system and layout.
- `app.js`: Application logic and state management.

## 💾 Data Strategy
- Use `localStorage` for:
  - `users`: Array of {id, name, email, password, role}.
  - `appointments`: Array of {id, userId, clientName, service, date, time, price, status, address}.
