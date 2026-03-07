const app = {
    currentUser: JSON.parse(localStorage.getItem('barbearia_user')) || null,
    users: JSON.parse(localStorage.getItem('barbearia_users')) || [],
    appointments: JSON.parse(localStorage.getItem('barbearia_appointments')) || [],
    editingAppointmentId: null,
    currentPaymentId: null,
    
    init: () => {
        app.seedBarber();
        app.renderNav();
        app.setupEventListeners();
        
        // Hide loader
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
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
        // Security check for barber dashboard
        if (pageId === 'barber-dashboard' && (!app.currentUser || app.currentUser.role !== 'barber')) {
            app.showPage('home');
            return;
        }

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        window.scrollTo(0, 0);
        
        if (pageId === 'booking') app.renderClientAppointments();
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
    },

    scrollTo: (id) => {
        document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    },

    // --- AUTH ---
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
        // Login
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

        // Register
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

        // Booking
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
        
        let total = 0;
        let isSunday = false;
        
        if (dateInput) {
            const date = new Date(dateInput + 'T00:00:00');
            isSunday = (date.getDay() === 0);
        }

        // Base price
        if (service === 'Corte Social') total = isSunday ? 25 : 20;
        else if (service === 'Degradê') total = isSunday ? 30 : 25;

        // Extras
        if (addBeard) total += 5;
        if (addEyebrow) total += 5;

        document.getElementById('preview-total').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    },

    createAppointment: () => {
        const service = document.getElementById('book-service').value;
        const date = document.getElementById('book-date').value;
        const time = document.getElementById('book-time').value;
        const addBeard = document.getElementById('add-beard').checked;
        const addEyebrow = document.getElementById('add-eyebrow').checked;
        const address = document.getElementById('book-address').value;
        
        // Calculate final price
        const dt = new Date(date + 'T00:00:00');
        const isSun = dt.getDay() === 0;
        let price = (service === 'Corte Social' ? (isSun ? 25 : 20) : (isSun ? 30 : 25));
        if (addBeard) price += 5;
        if (addEyebrow) price += 5;

        if (app.editingAppointmentId) {
            const index = app.appointments.findIndex(a => a.id === app.editingAppointmentId);
            if (index !== -1) {
                app.appointments[index] = {
                    ...app.appointments[index],
                    service: `${service}${addBeard ? ' + Barba' : ''}${addEyebrow ? ' + Sobrancelha' : ''}`,
                    date,
                    time,
                    price,
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
                service: `${service}${addBeard ? ' + Barba' : ''}${addEyebrow ? ' + Sobrancelha' : ''}`,
                date,
                time,
                price,
                isSunday: isSun,
                address: isSun ? address : 'No salão',
                status: 'Pendente'
            };
            app.appointments.push(appointment);
            alert('Agendamento realizado com sucesso!');
        }

        localStorage.setItem('barbearia_appointments', JSON.stringify(app.appointments));
        app.renderClientAppointments();
        document.getElementById('appointment-form').reset();
        app.updatePricePreview();
    },

    renderClientAppointments: () => {
        const list = document.getElementById('client-appointments-list');
        const myApps = app.appointments.filter(a => a.clientId === app.currentUser.id);
        
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
                <p><i class="fas fa-money-bill"></i> R$ ${a.price.toFixed(2).replace('.', ',')}</p>
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
            alert('Pagamento confirmado! Seu horário está garantido.');
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
        const today = new Date().toISOString().split('T')[0];
        const completedApps = app.appointments.filter(a => a.status === 'Concluído');
        
        // Stats
        const todayApps = app.appointments.filter(a => a.date === today);
        const todayRevenue = todayApps.filter(a => a.status === 'Concluído' || a.status === 'Pago').reduce((sum, a) => sum + a.price, 0);
        
        document.getElementById('daily-revenue').innerText = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
        document.getElementById('daily-count').innerText = todayApps.length;

        // Wallet Stats (Today)
        const todayCuts = todayApps.filter(a => a.status === 'Concluído').length;
        const todayPixPayments = todayApps.filter(a => a.status === 'Pago' || a.status === 'Concluído').length; // Simplification: assuming non-cash is tracked

        document.getElementById('wallet-today-money').innerText = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
        document.getElementById('wallet-today-cuts').innerText = todayCuts;
        document.getElementById('wallet-today-pix').innerText = todayPixPayments;

        // Agenda
        const tbody = document.getElementById('barber-agenda-body');
        const sorted = [...app.appointments].sort((a,b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
        
        tbody.innerHTML = sorted.map(a => `
            <tr>
                <td><strong>${a.clientName}</strong></td>
                <td>${a.service}</td>
                <td>${a.date.split('-').reverse().join('/')}<br><small>${a.time}</small></td>
                <td>R$ ${a.price.toFixed(2).replace('.', ',')}</td>
                <td><span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span></td>
                <td>
                    ${(a.status === 'Pendente' || a.status === 'Pago') ? `<button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.7rem;" onclick="app.completeAppointment('${a.id}')">Concluir</button>` : '<i class="fas fa-check-double" style="color:var(--primary)"></i>'}
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
