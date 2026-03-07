const app = {
    currentUser: JSON.parse(localStorage.getItem('barbearia_user')) || null,
    users: JSON.parse(localStorage.getItem('barbearia_users')) || [],
    appointments: JSON.parse(localStorage.getItem('barbearia_appointments')) || [],
    editingAppointmentId: null,
    currentPaymentId: null,
    
    init: () => {
        app.seedBarber();
        app.loadNotificationSettings();
        app.renderNav();
        app.setupEventListeners();
        
        // Hide loader
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
            app.checkAndSendReminders();
        }, 1000);

        // Initial page
        app.showPage('home');
    },

    seedBarber: () => {
        // Create an admin barber if not exists
        if (!app.users.find(u => u.role === 'barber')) {
            app.users.push({
                id: '1',
                name: 'Mestre da Baixada',
                email: 'barbeiro@teste.com',
                password: '123',
                role: 'barber'
            });
            localStorage.setItem('barbearia_users', JSON.stringify(app.users));
        }
    },

    // --- NAVIGATION ---
    showPage: (pageId) => {
        // Security checks
        if (pageId === 'barber-dashboard' && (!app.currentUser || app.currentUser.role !== 'barber')) {
            app.showPage('home');
            return;
        }
        if (pageId === 'booking' && (app.currentUser && app.currentUser.role === 'barber')) {
            app.showPage('barber-dashboard');
            return;
        }

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        window.scrollTo(0, 0);
        
        if (pageId === 'booking') {
            app.renderClientAppointments();
            app.renderClientHistory();
        }
        if (pageId === 'barber-dashboard') app.renderBarberDashboard();
    },

    renderNav: () => {
        const nav = document.getElementById('nav-links');
        let html = `<li><a href="#" onclick="app.showPage('home')">Início</a></li>`;
        
        if (app.currentUser) {
            if (app.currentUser.role === 'barber') {
                html += `<li><a href="#" onclick="app.showPage('barber-dashboard')">Painel</a></li>`;
            } else {
                html += `<li><a href="#" onclick="app.showPage('booking')">Meus Agendamentos</a></li>`;
            }
            html += `<li><a href="#" onclick="app.logout()">Sair (${app.currentUser.name.split(' ')[0]})</a></li>`;
        } else {
            html += `<li><a href="#" class="btn btn-primary" onclick="app.showPage('auth')">Entrar</a></li>`;
        }
        
        nav.innerHTML = html;

        // Hide booking buttons if barber is logged in
        const bookingBtns = document.querySelectorAll('button[onclick*="booking"]');
        bookingBtns.forEach(btn => {
            if (app.currentUser && app.currentUser.role === 'barber') {
                btn.style.display = 'none';
            } else {
                btn.style.display = 'block';
            }
        });
    },

    scrollTo: (id) => {
        document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    },

    // --- AUTH ---
    toggleBarberMode: (isBarber) => {
        const tabs = document.getElementById('auth-tabs');
        const title = document.getElementById('auth-title');
        const link = document.getElementById('barber-toggle-link');
        
        if (isBarber) {
            tabs.style.display = 'none';
            title.innerText = 'Acesso do Barbeiro';
            link.innerText = 'Voltar para Login de Clientes';
            link.onclick = () => app.toggleBarberMode(false);
            app.setAuthTab('login');
        } else {
            tabs.style.display = 'flex';
            title.innerText = 'Bem-vindo de volta';
            link.innerText = 'Acesso Administrativo';
            link.onclick = () => app.toggleBarberMode(true);
        }
    },

    setAuthTab: (tab) => {
        document.getElementById('tab-login').classList.toggle('active', tab === 'login');
        document.getElementById('tab-register').classList.toggle('active', tab === 'register');
        document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    },

    checkAuth: (pageToRedirect) => {
        if (!app.currentUser) {
            app.showPage('auth');
        } else {
            app.showPage(pageToRedirect);
        }
    },

    logout: () => {
        app.currentUser = null;
        localStorage.removeItem('barbearia_user');
        app.renderNav();
        app.showPage('home');
    },

    setupEventListeners: () => {
        // Login Form (Client & Barber)
        document.getElementById('login-form').onsubmit = (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            
            const user = app.users.find(u => u.email === email && u.password === pass);
            if (user) {
                app.currentUser = user;
                localStorage.setItem('barbearia_user', JSON.stringify(user));
                app.renderNav();
                app.showPage(user.role === 'barber' ? 'barber-dashboard' : 'booking');
            } else {
                alert('Email ou senha incorretos.');
            }
        };

        // Register Form
        document.getElementById('register-form').onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;

            if (app.users.find(u => u.email === email)) return alert('Email já cadastrado.');

            const newUser = { id: Date.now().toString(), name, email, password: pass, role: 'client' };
            app.users.push(newUser);
            localStorage.setItem('barbearia_users', JSON.stringify(app.users));
            
            app.currentUser = newUser;
            localStorage.setItem('barbearia_user', JSON.stringify(newUser));
            app.renderNav();
            app.showPage('booking');
        };

        // Booking Form
        document.getElementById('appointment-form').onsubmit = (e) => {
            e.preventDefault();
            app.createAppointment();
        };
    },

    // --- BOOKING LOGIC ---
    handleDateChange: () => {
        const dateInput = document.getElementById('book-date').value;
        const date = new Date(dateInput + 'T00:00:00');
        const day = date.getDay(); // 0 is Sunday
        
        const addressRow = document.getElementById('address-container');
        if (day === 0) {
            addressRow.style.display = 'block';
            document.getElementById('book-address').required = true;
        } else {
            addressRow.style.display = 'none';
            document.getElementById('book-address').required = false;
        }
        
        app.updatePricePreview();
    },

    updatePricePreview: () => {
        const service = document.getElementById('book-service').value;
        const dateInput = document.getElementById('book-date').value;
        const addBeard = document.getElementById('add-beard').checked;
        const addEyebrow = document.getElementById('add-eyebrow').checked;
        const addPigment = document.getElementById('add-pigment').checked;
        
        let total = 0;
        let isSunday = false;
        
        if (dateInput) {
            const date = new Date(dateInput + 'T00:00:00');
            isSunday = (date.getDay() === 0);
        }

        // Base price
        let basePrice = 0;
        let isSpecialty = false;

        if (service === 'Corte Social') basePrice = isSunday ? 25 : 20;
        else if (service === 'Degradê') basePrice = isSunday ? 30 : 25;
        else if (['Luzes', 'Platinado'].includes(service)) isSpecialty = true;

        total = basePrice;
        if (addBeard) total += 5;
        if (addEyebrow) total += 5;
        if (addPigment) total += 10;

        if (isSpecialty) {
            document.getElementById('preview-total').innerText = "A combinar";
        } else {
            document.getElementById('preview-total').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }
    },

    createAppointment: () => {
        const service = document.getElementById('book-service').value;
        const date = document.getElementById('book-date').value;
        const time = document.getElementById('book-time').value;
        const addBeard = document.getElementById('add-beard').checked;
        const addEyebrow = document.getElementById('add-eyebrow').checked;
        const addPigment = document.getElementById('add-pigment').checked;
        const address = document.getElementById('book-address').value;
        
        // Calculate final price and duration
        const dt = new Date(date + 'T00:00:00');
        const isSun = dt.getDay() === 0;
        let price = 0;
        let duration = 45; // Base duration in minutes

        if (service === 'Corte Social') price = isSun ? 25 : 20;
        else if (service === 'Degradê') price = isSun ? 30 : 25;
        else { // Specialty
            price = 0;
            duration = 60;
        }

        if (addBeard) { price += 5; duration += 15; }
        if (addEyebrow) { price += 5; duration += 5; }
        if (addPigment) { price += 10; duration += 15; }

        // Rule: Minimum 1h advance booking
        const now = new Date();
        const selectedTime = new Date(date + 'T' + time);
        const oneHourLater = new Date(now.getTime() + (60 * 60 * 1000));

        if (selectedTime < oneHourLater) {
            alert('Agendamentos devem ser feitos com no mínimo 1 hora de antecedência.');
            return;
        }

        // Rule: Check Overlap
        if (app.isTimeOccupied(date, time, duration, app.editingAppointmentId)) {
            alert('Este horário (ou o período do serviço) já está ocupado. Por favor, escolha outro.');
            return;
        }

        if (app.editingAppointmentId) {
            const index = app.appointments.findIndex(a => a.id === app.editingAppointmentId);
            if (index !== -1) {
                app.appointments[index] = {
                    ...app.appointments[index],
                    service: `${service}${addBeard ? ' + Barba' : ''}${addEyebrow ? ' + Sobrancelha' : ''}${addPigment ? ' + Pigmentação' : ''}`,
                    date,
                    time,
                    price,
                    duration,
                    isSunday: isSun,
                    address: isSun ? address : 'No salão'
                };
                alert('Agendamento atualizado!');
            }
            app.resetEditing();
        } else {
            const appointment = {
                id: Date.now().toString(),
                clientId: app.currentUser.id,
                clientName: app.currentUser.name,
                service: `${service}${addBeard ? ' + Barba' : ''}${addEyebrow ? ' + Sobrancelha' : ''}${addPigment ? ' + Pigmentação' : ''}`,
                date,
                time,
                price,
                duration,
                isSunday: isSun,
                address: isSun ? address : 'No salão',
                status: 'Pendente'
            };
            app.appointments.push(appointment);
            alert('Desde já, agradecemos pela preferência, você receberá um aviso no seu E-mail 24 horas e 2 horas antes do seu horário marcado!');
        }

        localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
        app.renderClientAppointments();
        document.getElementById('appointment-form').reset();
        app.updatePricePreview();
    },

    // --- TIME UTILS ---
    isTimeOccupied: (date, time, duration, excludeId) => {
        const start = new Date(date + 'T' + time).getTime();
        const end = start + (duration * 60 * 1000);

        return app.appointments.some(a => {
            if (a.id === excludeId) return false;
            if (a.date !== date) return false;
            if (a.status === 'Cancelado') return false;

            const aStart = new Date(a.date + 'T' + a.time).getTime();
            const aDuration = a.duration || 45; // Default if old data
            const aEnd = aStart + (aDuration * 60 * 1000);

            // Overlap check: (Start A < End B) and (End A > Start B)
            return (start < aEnd && end > aStart);
        });
    },

    renderClientAppointments: () => {
        app.renderClientHistory(); // Keep history in sync
        const list = document.getElementById('client-appointments-list');
        const myApps = app.appointments.filter(a => a.clientId === app.currentUser.id && a.status !== 'Concluído');
        
        if (myApps.length === 0) {
            list.innerHTML = `<p class="empty-msg">Você ainda não possui agendamentos.</p>`;
            return;
        }

        list.innerHTML = myApps.sort((a,b) => new Date(b.date) - new Date(a.date)).map(a => `
            <div class="appointment-card">
                <div style="display:flex; justify-content:space-between">
                    <h4>${a.service}</h4>
                    <span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span>
                </div>
                <p><i class="fas fa-calendar"></i> ${a.date.split('-').reverse().join('/')} às ${a.time}</p>
                <p><i class="fas fa-money-bill"></i> ${a.price > 0 ? `R$ ${a.price.toFixed(2).replace('.', ',')}` : 'Preço a combinar'}</p>
                ${a.isSunday ? `<p><i class="fas fa-home"></i> ${a.address}</p>` : ''}
                
                <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                    ${a.status === 'Pendente' ? `
                        <button class="btn btn-primary" style="padding: 5px 12px; font-size: 0.8rem;" onclick="app.openPayment('${a.id}')">Pagar Agora</button>
                        <button class="btn btn-outline" style="padding: 5px 12px; font-size: 0.8rem;" onclick="app.editAppointment('${a.id}')">Editar</button>
                    ` : ''}
                    ${a.status !== 'Concluído' ? `
                        <button class="btn" style="padding: 5px 12px; font-size: 0.8rem; background: rgba(220, 53, 69, 0.2); color: #ff4d4d; border: 1px solid #ff4d4d;" onclick="app.cancelAppointment('${a.id}')">Cancelar</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    renderClientHistory: () => {
        const list = document.getElementById('client-history-list');
        if (!list) return;
        const history = app.appointments.filter(a => a.clientId === app.currentUser.id && a.status.toLowerCase() === 'concluído');
        const now = new Date();

        if (history.length === 0) {
            list.innerHTML = `<p class="empty-msg">Nenhum serviço finalizado ainda.</p>`;
            return;
        }

        list.innerHTML = history.sort((a,b) => new Date(b.date) - new Date(a.date)).map(a => {
            const appDate = new Date(a.date + 'T00:00:00');
            const diffDays = Math.floor((now - appDate) / (1000 * 60 * 60 * 24));
            
            let suggestion = '';
            // Touch-up logic for Platinado (20 days)
            if (a.service.includes('Platinado') && diffDays >= 20) {
                suggestion = `
                    <div class="touchup-suggestion glass">
                        <p><i class="fas fa-magic"></i> Já faz ${diffDays} dias que você fez o <strong>Platinado</strong>. Que tal um retoque?</p>
                        <button class="btn btn-primary" style="font-size: 0.7rem; padding: 5px 10px;" onclick="app.sendTouchupEmail('${a.service}', '${a.date}')">Mandar Lembrete no Gmail</button>
                    </div>
                `;
            }

            return `
                <div class="appointment-card history">
                    <div style="display:flex; justify-content:space-between">
                        <h4>${a.service}</h4>
                        <span class="status-badge status-concluido">Finalizado</span>
                    </div>
                    <p><i class="fas fa-calendar"></i> Realizado em ${a.date.split('-').reverse().join('/')}</p>
                    ${suggestion}
                </div>
            `;
        }).join('');
    },

    sendTouchupEmail: (service, date) => {
        const email = app.currentUser.email;
        const subject = encodeURIComponent(`💡 Hora de cuidar do seu visual - Barbearia da Baixada`);
        const body = encodeURIComponent(`Olá ${app.currentUser.name}!\n\nPercebemos que já faz 20 dias que você realizou seu ${service} conosco (no dia ${date.split('-').reverse().join('/')}).\n\nQue tal agendar um retoque para manter o estilo impecável?\n\nAgende agora pelo nosso site ou responda este e-mail!\n\nAtenciosamente,\nBarbearia da Baixada 💈`);
        
        const mailto = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        window.open(mailto, '_blank');
        alert('Abrindo o Gmail para você enviar o lembrete de retoque!');
    },

    openPayment: (id) => {
        const a = app.appointments.find(appo => appo.id === id);
        if (!a) return;
        app.currentPaymentId = id;
        document.getElementById('pay-total').innerText = `R$ ${a.price.toFixed(2).replace('.', ',')}`;
        
        // Use barber's custom PIX key if available
        const savedPixKey = localStorage.getItem('barber_pix_key');
        if (savedPixKey) {
            document.getElementById('pix-key').value = savedPixKey;
        }

        document.getElementById('payment-modal').style.display = 'flex';
    },

    closePayment: () => {
        document.getElementById('payment-modal').style.display = 'none';
        app.currentPaymentId = null;
    },

    copyPix: () => {
        const pix = document.getElementById('pix-key');
        pix.select();
        document.execCommand('copy');
        alert('Código PIX copiado!');
    },

    confirmPayment: () => {
        const a = app.appointments.find(appo => appo.id === app.currentPaymentId);
        if (a) {
            a.status = 'Pago';
            localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
            app.closePayment();
            app.renderClientAppointments();
            
            const wpMsg = encodeURIComponent(`Olá! Acabei de realizar o pagamento do agendamento de ${a.service} para o dia ${a.date.split('-').reverse().join('/')} às ${a.time}. Segue o comprovante.`);
            const wpLink = `https://wa.me/5573998376471?text=${wpMsg}`;
            
            alert('Pagamento registrado! Agora, por favor, envie o comprovante pelo WhatsApp que abrirá a seguir.');
            window.open(wpLink, '_blank');
        }
    },

    cancelAppointment: (id) => {
        if (confirm('Deseja realmente cancelar este agendamento?')) {
            app.appointments = app.appointments.filter(a => a.id !== id);
            localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
            app.renderClientAppointments();
        }
    },

    editAppointment: (id) => {
        const a = app.appointments.find(appo => appo.id === id);
        if (!a) return;

        app.editingAppointmentId = id;
        
        // Fill form
        const serviceBase = a.service.split(' +')[0];
        document.getElementById('book-service').value = serviceBase;
        document.getElementById('add-beard').checked = a.service.includes('Barba');
        document.getElementById('add-eyebrow').checked = a.service.includes('Sobrancelha');
        document.getElementById('add-pigment').checked = a.service.includes('Pigmentação');
        document.getElementById('book-date').value = a.date;
        document.getElementById('book-time').value = a.time;
        
        if (a.isSunday) {
            document.getElementById('address-container').style.display = 'block';
            document.getElementById('book-address').value = a.address;
        } else {
            document.getElementById('address-container').style.display = 'none';
        }

        app.updatePricePreview();
        document.querySelector('#appointment-form button').innerText = 'Salvar Alterações';
        
        // Add cancel edit button if not exists
        if (!document.getElementById('btn-cancel-edit')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'btn-cancel-edit';
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-outline btn-block';
            cancelBtn.style.marginTop = '10px';
            cancelBtn.innerText = 'Cancelar Edição';
            cancelBtn.onclick = app.resetEditing;
            document.getElementById('appointment-form').appendChild(cancelBtn);
        }
        
        window.scrollTo({ top: document.getElementById('booking').offsetTop - 100, behavior: 'smooth' });
    },

    resetEditing: () => {
        app.editingAppointmentId = null;
        document.getElementById('appointment-form').reset();
        document.querySelector('#appointment-form button').innerText = 'Confirmar Agendamento';
        const cancelBtn = document.getElementById('btn-cancel-edit');
        if (cancelBtn) cancelBtn.remove();
        app.updatePricePreview();
    },

    // --- NOTIFICATIONS ---
    loadNotificationSettings: () => {
        const settings = JSON.parse(localStorage.getItem('barber_notif_settings')) || { n24h: true, n2h: true };
        const c24h = document.getElementById('notify-24h');
        const c2h = document.getElementById('notify-2h');
        if (c24h) c24h.checked = settings.n24h;
        if (c2h) c2h.checked = settings.n2h;
    },

    saveNotificationSettings: () => {
        const settings = {
            n24h: document.getElementById('notify-24h').checked,
            n2h: document.getElementById('notify-2h').checked
        };
        localStorage.setItem('barber_notif_settings', JSON.stringify(settings));
    },

    checkAndSendReminders: () => {
        const now = new Date();
        const settings = JSON.parse(localStorage.getItem('barber_notif_settings')) || { n24h: true, n2h: true };
        let sentCount = 0;

        app.appointments.forEach(a => {
            if (a.status !== 'Pendente' && a.status !== 'Pago') return;

            const appTime = new Date(a.date + 'T' + a.time);
            const diffMs = appTime - now;
            const diffHours = diffMs / (1000 * 60 * 60);

            // 24h Reminder
            if (settings.n24h && diffHours > 0 && diffHours <= 24 && !a.notified24h) {
                app.simulateEmail(a, '24 horas');
                a.notified24h = true;
                sentCount++;
            }

            // 2h Reminder
            if (settings.n2h && diffHours > 0 && diffHours <= 2 && !a.notified2h) {
                app.simulateEmail(a, '2 horas');
                a.notified2h = true;
                sentCount++;
            }
        });

        if (sentCount > 0) {
            localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
        }
    },

    simulateEmail: (appointment, window) => {
        const log = document.getElementById('notification-log');
        const time = new Date().toLocaleTimeString();
        const msg = `[${time}] E-mail de lembrete (${window}) enviado para: ${appointment.clientName}`;
        
        console.log(`SIMULAÇÃO DE EMAIL: ${msg}`);
        
        if (log) {
            const entry = document.createElement('div');
            entry.innerText = msg;
            log.prepend(entry);
        }
    },

    // --- BARBER DASHBOARD ---
    setBarberTab: (tab) => {
        document.getElementById('tab-agenda').classList.toggle('active', tab === 'agenda');
        document.getElementById('tab-wallet').classList.toggle('active', tab === 'wallet');
        
        document.getElementById('barber-agenda').style.display = tab === 'agenda' ? 'block' : 'none';
        document.getElementById('barber-wallet').style.display = tab === 'wallet' ? 'block' : 'none';

        if (tab === 'wallet') {
            const savedPixKey = localStorage.getItem('barber_pix_key');
            if (savedPixKey) {
                document.getElementById('barber-pix-key-input').value = savedPixKey;
            }
        }
    },

    updateBarberPixKey: () => {
        const newKey = document.getElementById('barber-pix-key-input').value;
        localStorage.setItem('barber_pix_key', newKey);
        alert('Chave PIX atualizada com sucesso!');
    },

    renderBarberDashboard: () => {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        // Filter appointments for today
        const todayApps = app.appointments.filter(a => a.date === today);
        
        // Calculate revenue (Case-insensitive check for 'Concluído' or 'Pago')
        const todayRevenue = todayApps
            .filter(a => a.status.toLowerCase() === 'concluído' || a.status.toLowerCase() === 'pago')
            .reduce((sum, a) => sum + (a.price || 0), 0);
        
        // Update Overview Stats
        const dailyRevEl = document.getElementById('daily-revenue');
        const dailyCountEl = document.getElementById('daily-count');
        if (dailyRevEl) dailyRevEl.innerText = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
        if (dailyCountEl) dailyCountEl.innerText = todayApps.length;

        // Wallet Stats (Today)
        const todayCuts = todayApps.filter(a => a.status.toLowerCase() === 'concluído').length;
        const todayPixPayments = todayApps.filter(a => a.status.toLowerCase() === 'pago').length;

        const wMoney = document.getElementById('wallet-today-money');
        const wCuts = document.getElementById('wallet-today-cuts');
        const wPix = document.getElementById('wallet-today-pix');

        if (wMoney) wMoney.innerText = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
        if (wCuts) wCuts.innerText = todayCuts;
        if (wPix) wPix.innerText = todayPixPayments;

        // Agenda
        const tbody = document.getElementById('barber-agenda-body');
        const sorted = [...app.appointments].sort((a,b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
        
        tbody.innerHTML = sorted.map(a => `
            <tr>
                <td><strong>${a.clientName}</strong></td>
                <td>${a.service}</td>
                <td>${a.date.split('-').reverse().join('/')}<br><small>${a.time}</small></td>
                <td>${a.price > 0 ? `R$ ${a.price.toFixed(2).replace('.', ',')}` : 'A combinar'}</td>
                <td><span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span></td>
                <td>
                    ${(a.status === 'Pendente' || a.status === 'Pago') ? `<button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.7rem;" onclick="app.completeAppointment('${a.id}')">Concluir</button>` : ''}
                    ${a.status === 'Bloqueado' ? `<button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.7rem; border-color: var(--primary); color: var(--primary);" onclick="app.unblockTime('${a.id}')">Desbloquear</button>` : ''}
                    ${(a.status === 'Concluído') ? '<i class="fas fa-check-double" style="color:var(--primary)"></i>' : ''}
                </td>
            </tr>
            ${a.isSunday ? `<tr><td colspan="6" style="background: rgba(212, 175, 55, 0.05); font-size: 0.8rem; border-top: none;"><i class="fas fa-truck"></i> Endereço: ${a.address}</td></tr>` : ''}
        `).join('');

        // Finance
        const financeList = document.getElementById('finance-list');
        const completed = app.appointments.filter(a => a.status === 'Concluído');
        
        if (completed.length === 0) {
            financeList.innerHTML = `<p class="empty-msg">Nenhum recebimento registrado.</p>`;
        } else {
            // Group by day
            const byDay = completed.reduce((acc, a) => {
                acc[a.date] = (acc[a.date] || 0) + a.price;
                return acc;
            }, {});

            financeList.innerHTML = Object.entries(byDay).sort((a,b) => new Date(b[0]) - new Date(a[0])).map(([date, total]) => `
                <div class="finance-item">
                    <span>${date.split('-').reverse().join('/')}</span>
                    <strong style="color:var(--primary)">R$ ${total.toFixed(2).replace('.', ',')}</strong>
                </div>
            `).join('');
        }
    },

    blockTime: () => {
        const date = document.getElementById('block-date').value;
        const time = document.getElementById('block-time').value;
        const duration = parseInt(document.getElementById('block-duration').value);
        const reason = document.getElementById('block-reason').value || 'Bloqueio Manual';

        if (!date || !time) return alert('Selecione data e hora.');

        if (app.isTimeOccupied(date, time, duration)) {
            return alert('Este horário já está ocupado por um cliente ou outro bloqueio.');
        }

        const block = {
            id: Date.now().toString(),
            clientId: 'barber',
            clientName: 'BLOQUEIO',
            service: reason,
            date,
            time,
            price: 0,
            duration,
            status: 'Bloqueado'
        };

        app.appointments.push(block);
        localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
        app.renderBarberDashboard();
        alert('Horário bloqueado com sucesso!');
    },

    unblockTime: (id) => {
        if (confirm('Deseja realmente desbloquear este horário?')) {
            app.appointments = app.appointments.filter(a => a.id !== id);
            localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
            app.renderBarberDashboard();
        }
    },

    completeAppointment: (id) => {
        const appointment = app.appointments.find(a => a.id === id);
        if (appointment) {
            appointment.status = 'Concluído';
            localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
            app.renderBarberDashboard();
        }
    }
};

window.onload = app.init;
