// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://rhpmuyjqfqzxsstsqnez.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJocG11eWpxZnF6eHNzdHNxbmV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjE4MTIsImV4cCI6MjA4ODQ5NzgxMn0.s29pH_q2EBINgIxcMQigToAqyWFt14x6L5iQSu27ntg';
let db = null; // Inicializado no init

const app = {
    // Funções auxiliares para Storage Seguro (Evita erro de Tracking Prevention)
    storage: {
        get: (key, defaultValue) => {
            try {
                const val = localStorage.getItem(key);
                return val ? JSON.parse(val) : defaultValue;
            } catch (e) {
                console.warn('Storage bloqueado:', e.message);
                return defaultValue;
            }
        },
        set: (key, val) => {
            try {
                localStorage.setItem(key, JSON.stringify(val));
            } catch (e) {
                console.warn('Erro ao salvar no storage:', e.message);
            }
        }
    },

    currentUser: null,
    users: [],
    appointments: [],
    editingAppointmentId: null,
    currentPaymentId: null,

    // Função para checar a conexão (Saber se deu certo)
    checkConnection: async () => {
        if (!db) return false;
        try {
            const { data, error } = await db.from('users').select('count', { count: 'exact', head: true });
            if (error) {
                console.error('Erro ao conectar no banco:', error.message);
                return false;
            }
            console.log('✅ Conexão com Supabase estabelecida com sucesso!');
            return true;
        } catch (e) {
            console.error('Falha crítica na conexão:', e.message);
            return false;
        }
    },

    showToast: (msg) => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = msg;
        container.appendChild(toast);

        // Trigger show
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 4s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    },

    init: async () => {
        // Carrega sessão local (para manter logado)
        app.currentUser = app.storage.get('barbearia_user', null);

        // Inicializa o banco com segurança
        if (typeof supabase !== 'undefined') {
            db = supabase.createClient(supabaseUrl, supabaseKey);
        } else {
            console.error('Erro: SDK do Supabase não carregou!');
            setTimeout(() => app.showToast('Erro: Não foi possível conectar ao servidor de dados.'), 1000);
            return;
        }

        app.setupEventListeners();
        await app.syncData(); // Sincroniza usuários e agendamentos do banco
        await app.checkLicense(); // Verifica se a mensalidade está paga
        app.loadNotificationSettings();
        app.renderNav();

        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
            app.checkAndSendReminders();
        }, 1000);

        app.showPage('home');
    },

    // Função para buscar tudo do banco de dados
    syncData: async () => {
        if (!db) return;
        try {
            // Busca usuários
            const { data: usersData, error: uError } = await db.from('users').select('*');
            if (uError) throw uError;
            app.users = usersData || [];

            // Busca agendamentos
            const { data: appoData, error: aError } = await db.from('appointments').select('*');
            if (aError) throw aError;
            app.appointments = appoData || [];

            // Se for barbeiro, o banco sempre garante o admin. Localmente garantimos aqui:
            app.seedBarber(); 

            console.log('🔄 Dados sincronizados com Supabase');
        } catch (e) {
            console.error('Erro na sincronização:', e.message);
            // Fallback para storage local se o banco falhar
            app.users = app.storage.get('barbearia_users', []);
            app.appointments = app.storage.get('barbearia_appointments', []);
        }

        // Garante que o administrador existe no banco
        await app.seedBarber();
    },

    checkLicense: async () => {
        if (!db) return;
        try {
            // Busca o status e a data de vencimento na tabela 'config'
            const { data, error } = await db.from('config').select('key, value');
            
            if (error) throw error;

            const status = data.find(i => i.key === 'subscription_status')?.value;
            const dueDate = data.find(i => i.key === 'next_payment_date')?.value;

            // Atualiza a data na interface se o elemento existir
            const dateEl = document.getElementById('payment-due-date');
            if (dateEl && dueDate) {
                dateEl.innerText = dueDate;
            }
            
            // Se estiver inativo, bloqueia o site
            if (status !== 'active') {
                app.lockSystem();
            }
        } catch (e) {
            console.error('Erro na licença:', e.message);
        }
    },

    lockSystem: () => {
        // Cria uma tela de bloqueio total que sobrepõe tudo
        const lock = document.createElement('div');
        lock.id = 'system-lock';
        lock.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #0a0a0a; color: white; z-index: 99999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; padding: 20px; font-family: 'Montserrat', sans-serif;
        `;
        lock.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #D4AF37; margin-bottom: 20px;"></i>
            <h1 style="font-size: 1.8rem; margin-bottom: 15px;">Sistema Temporariamente Suspenso</h1>
            <p style="color: #a0a0a0; max-width: 400px; line-height: 1.6; margin-bottom: 30px;">
                Para restabelecer o acesso ao agendamento e ao painel administrativo, por favor, entre em contato com o suporte técnico.
            </p>
            <a href="https://wa.me/5573998376471?text=Olá! Meu sistema foi suspenso. Gostaria de regularizar o acesso." 
               target="_blank" class="btn btn-primary" style="text-decoration: none;">
               Falar com Suporte
            </a>
        `;
        document.body.appendChild(lock);
        // Desativa interações
        document.body.style.overflow = 'hidden';
    },

    seedBarber: async () => {
        const masterEmail = 'barbeiro@teste.com';
        const masterPass = 'barbeiro123';
        
        // Verifica se o admin já existe no banco de dados pela lista local carregada
        let barber = app.users.find(u => u.role === 'barber');
        
        if (!barber) {
            // Se não existe, tenta cadastrar no Supabase
            const { data, error } = await db.from('users').insert([{
                name: 'Mestre da Baixada',
                email: masterEmail,
                password: masterPass,
                role: 'barber'
            }]).select();
            
            if (!error && data) {
                app.users.push(data[0]);
                console.log('👑 Admin criado no Supabase');
            }
        } else if (barber.password !== masterPass) {
            // Se a senha mudou, atualiza no banco
            const { error } = await db.from('users').update({ password: masterPass }).eq('email', masterEmail);
            if (!error) {
                barber.password = masterPass;
                console.log('👑 Senha do Admin atualizada');
            }
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

        // Close mobile menu on page change
        const nav = document.getElementById('nav-links');
        if (nav) nav.classList.remove('active');
    },

    toggleMenu: () => {
        const nav = document.getElementById('nav-links');
        nav.classList.toggle('active');
        const icon = document.querySelector('.menu-toggle i');
        if (nav.classList.contains('active')) {
            icon.classList.replace('fa-bars', 'fa-times');
        } else {
            icon.classList.replace('fa-times', 'fa-bars');
        }
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
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
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
        document.getElementById('recovery-form').style.display = tab === 'recovery' ? 'block' : 'none';
        
        // Reset recovery steps if changing tabs
        if (tab !== 'recovery') {
            document.getElementById('recovery-step-1').style.display = 'block';
            document.getElementById('recovery-step-2').style.display = 'none';
            document.getElementById('recovery-form').reset();
        }
    },

    forgotPassword: () => {
        app.setAuthTab('recovery');
    },

    tempRecovery: { code: null, user: null },

    sendRecoveryCode: async () => {
        const email = document.getElementById('recovery-email').value;
        if (!email) return app.showToast('Digite seu e-mail.');

        try {
            app.showToast('Buscando conta...');
            const { data, error } = await db.from('users').select('*').eq('email', email);
            if (error) throw error;

            if (data && data.length > 0) {
                const user = data[0];
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                app.tempRecovery = { code, user };

                const subject = encodeURIComponent('🔑 Código de Recuperação - Barbearia da Baixada');
                const body = encodeURIComponent(`Olá ${user.name}!\n\nSeu código de recuperação é: ${code}\n\nDigite este código no site para acessar sua conta.\n\nAtenciosamente,\nBarbearia da Baixada 💈`);
                const mailto = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
                
                window.open(mailto, '_blank');
                
                document.getElementById('recovery-step-1').style.display = 'none';
                document.getElementById('recovery-step-2').style.display = 'block';
                app.showToast('Código enviado! Verifique seu Gmail.');
            } else {
                app.showToast('E-mail não cadastrado.');
            }
        } catch (err) {
            console.error(err);
            app.showToast('Erro ao buscar conta.');
        }
    },

    verifyRecoveryCode: () => {
        const input = document.getElementById('recovery-code-input').value;
        if (input === app.tempRecovery.code) {
            alert(`✅ Código Confirmado!\n\nSua senha atual é: ${app.tempRecovery.user.password}\n\nAnote em um lugar seguro!`);
            app.setAuthTab('login');
        } else {
            app.showToast('Código incorreto. Verifique o Gmail.');
        }
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
        app.storage.set('barbearia_user', null);
        app.renderNav();
        const nav = document.getElementById('nav-links');
        if (nav) nav.classList.remove('active');
        app.showPage('home');
    },

    setupEventListeners: () => {
        // Login Form (Client & Barber)
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;

            app.showToast('Verificando...');

            try {
                const { data: users, error } = await db.from('users').select('*').eq('email', email).eq('password', pass);
                if (error) throw error;

                const user = users[0];
                if (user) {
                    app.currentUser = user;
                    app.storage.set('barbearia_user', user);
                    app.renderNav();
                    app.showToast(`Bem-vindo, ${user.name.split(' ')[0]}!`);
                    app.showPage(user.role === 'barber' ? 'barber-dashboard' : 'booking');
                } else {
                    app.showToast('E-mail ou senha incorretos.');
                }
            } catch (err) {
                console.error(err);
                app.showToast('Erro ao conectar. Tente novamente.');
            }
        };

        // Register Form
        document.getElementById('register-form').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;

            if (app.users.find(u => u.email === email)) {
                return app.showToast('Este e-mail já está cadastrado.');
            }

            try {
                const newUser = { name, email, password: pass, role: 'client' };
                const { data, error } = await db.from('users').insert([newUser]).select();
                
                if (error) throw error;

                app.currentUser = data[0];
                app.storage.set('barbearia_user', app.currentUser);
                await app.syncData(); // Atualiza lista local
                
                app.renderNav();
                app.showToast('Conta criada com sucesso!');
                app.showPage('booking');
            } catch (err) {
                console.error(err);
                app.showToast('Erro ao cadastrar. Tente novamente.');
            }
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
        const addPezinho = document.getElementById('add-pezinho').checked;
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
        if (addBeard) total += 10;
        if (addEyebrow) total += 5;
        if (addPezinho) total += 10;
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
        const addPezinho = document.getElementById('add-pezinho').checked;
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

        if (addBeard) { price += 10; duration += 15; }
        if (addEyebrow) { price += 5; duration += 5; }
        if (addPezinho) { price += 10; duration += 10; }
        if (addPigment) { price += 10; duration += 15; }

        // Rule: Minimum 1h advance booking
        const now = new Date();
        const selectedTime = new Date(date + 'T' + time);
        const oneHourLater = new Date(now.getTime() + (60 * 60 * 1000));

        if (selectedTime < oneHourLater) {
            app.showToast('Favor agendar com pelo menos 1h de antecedência.');
            return;
        }

        // Rule: Check Overlap
        if (app.isTimeOccupied(date, time, duration, app.editingAppointmentId)) {
            app.showToast('Este horário já está ocupado. Escolha outro.');
            return;
        }

        if (app.editingAppointmentId) {
            // Edição
            app.updateExistingAppointment({
                id: app.editingAppointmentId,
                service: `${service}${addBeard ? ' + Barba' : ''}${addEyebrow ? ' + Sobrancelha' : ''}${addPezinho ? ' + Pezinho' : ''}${addPigment ? ' + Pigmentação' : ''}`,
                date,
                time,
                price,
                duration,
                issunday: isSun,
                address: isSun ? address : 'No salão'
            });
        } else {
            // Novo
            app.saveNewAppointment({
                clientid: app.currentUser.id,
                clientname: app.currentUser.name,
                service: `${service}${addBeard ? ' + Barba' : ''}${addEyebrow ? ' + Sobrancelha' : ''}${addPezinho ? ' + Pezinho' : ''}${addPigment ? ' + Pigmentação' : ''}`,
                date,
                time,
                price,
                duration,
                issunday: isSun,
                address: isSun ? address : 'No salão',
                status: 'Pendente'
            });
        }

        document.getElementById('appointment-form').reset();
        app.updatePricePreview();
    },

    saveNewAppointment: async (appointment) => {
        try {
            app.showToast('Agendando...');
            const { error } = await db.from('appointments').insert([appointment]);
            if (error) throw error;

            await app.syncData();
            app.renderClientAppointments();
            app.showToast('Agendamento concluído com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            // Mostra o erro técnico para o usuário poder me informar
            app.showToast(`Erro no banco: ${err.message || 'Falha ao salvar'}`);
        }
    },

    updateExistingAppointment: async (data) => {
        try {
            app.showToast('Salvando...');
            const { error } = await db.from('appointments').update(data).eq('id', data.id);
            if (error) throw error;

            await app.syncData();
            app.resetEditing();
            app.renderClientAppointments();
            app.showToast('Agendamento atualizado!');
        } catch (err) {
            console.error('Erro ao atualizar:', err);
            app.showToast(`Erro na atualização: ${err.message}`);
        }
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
        if (!app.currentUser) return; // Segurança contra crash
        app.renderClientHistory(); // Keep history in sync
        const list = document.getElementById('client-appointments-list');
        const myApps = app.appointments.filter(a => a.clientid === app.currentUser.id && a.status !== 'Concluído');

        if (myApps.length === 0) {
            list.innerHTML = `<p class="empty-msg">Você ainda não possui agendamentos.</p>`;
            return;
        }

        list.innerHTML = myApps.sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => `
            <div class="appointment-card">
                <div style="display:flex; justify-content:space-between">
                    <h4>${a.service}</h4>
                    <span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span>
                </div>
                <p><i class="fas fa-calendar"></i> ${a.date.split('-').reverse().join('/')} às ${a.time}</p>
                <p><i class="fas fa-money-bill"></i> ${a.price > 0 ? `R$ ${a.price.toFixed(2).replace('.', ',')}` : 'Preço a combinar'}</p>
                ${a.issunday ? `<p><i class="fas fa-home"></i> ${a.address}</p>` : ''}
                
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
        if (!list || !app.currentUser) return;
        const history = app.appointments.filter(a => a.clientid === app.currentUser.id && a.status.toLowerCase() === 'concluído');
        const now = new Date();

        if (history.length === 0) {
            list.innerHTML = `<p class="empty-msg">Nenhum serviço finalizado ainda.</p>`;
            return;
        }

        list.innerHTML = history.sort((a, b) => new Date(b.date) - new Date(a.date)).map(a => {
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
        const defaultKey = "09613543562";
        const savedPixKey = app.storage.get('barber_pix_key', defaultKey);
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
        
        // Versão moderna para mobile e desktop
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(pix.value).then(() => {
                app.showToast('✅ Código PIX copiado!');
            }).catch(err => {
                console.error('Erro ao copiar:', err);
                app.fallbackCopy(pix);
            });
        } else {
            app.fallbackCopy(pix);
        }
    },

    fallbackCopy: (el) => {
        el.select();
        el.setSelectionRange(0, 99999); // Para mobile
        try {
            document.execCommand('copy');
            app.showToast('✅ Código PIX copiado!');
        } catch (err) {
            app.showToast('❌ Erro ao copiar. Tente selecionar e copiar manualmente.');
        }
    },

    confirmPayment: () => {
        const a = app.appointments.find(appo => appo.id === app.currentPaymentId);
        if (a) {
            a.status = 'Pago';
            app.storage.set('barbearia_appointments', app.appointments);
            app.closePayment();
            app.renderClientAppointments();

            const wpMsg = encodeURIComponent(`Olá! Acabei de realizar o pagamento do agendamento de ${a.service} para o dia ${a.date.split('-').reverse().join('/')} às ${a.time}. Segue o comprovante.`);
            const wpLink = `https://wa.me/5573998376471?text=${wpMsg}`;

            alert('Pagamento registrado! Agora, por favor, envie o comprovante pelo WhatsApp que abrirá a seguir.');
            window.open(wpLink, '_blank');
        }
    },

    cancelAppointment: async (id) => {
        if (confirm('Deseja realmente cancelar este agendamento?')) {
            try {
                app.showToast('Cancelando...');
                const { error } = await db.from('appointments').delete().eq('id', id);
                if (error) throw error;

                await app.syncData();
                app.renderClientAppointments();
                app.showToast('Agendamento cancelado.');
            } catch (err) {
                console.error(err);
                app.showToast('Erro ao cancelar agendamento.');
            }
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
        document.getElementById('add-pezinho').checked = a.service.includes('Pezinho');
        document.getElementById('add-pigment').checked = a.service.includes('Pigmentação');
        document.getElementById('book-date').value = a.date;
        document.getElementById('book-time').value = a.time;

        if (a.issunday) {
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
        const settings = app.storage.get('barber_notif_settings', { n24h: true, n2h: true });
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
        app.storage.set('barber_notif_settings', settings);
    },

    checkAndSendReminders: () => {
        const now = new Date();
        const settings = app.storage.get('barber_notif_settings', { n24h: true, n2h: true });
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
            app.storage.set('barbearia_appointments', app.appointments);
        }
    },

    simulateEmail: (appointment, window) => {
        const log = document.getElementById('notification-log');
        const time = new Date().toLocaleTimeString();
        const msg = `[${time}] E-mail de lembrete (${window}) enviado para: ${appointment.clientname}`;

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
        document.getElementById('tab-clients').classList.toggle('active', tab === 'clients');

        document.getElementById('barber-agenda').style.display = tab === 'agenda' ? 'block' : 'none';
        document.getElementById('barber-wallet').style.display = tab === 'wallet' ? 'block' : 'none';
        document.getElementById('barber-clients').style.display = tab === 'clients' ? 'block' : 'none';

        if (tab === 'wallet') {
            const savedPixKey = app.storage.get('barber_pix_key', null);
            if (savedPixKey) {
                document.getElementById('barber-pix-key-input').value = savedPixKey;
            }
        }
    },

    updateBarberPixKey: () => {
        const newKey = document.getElementById('barber-pix-key-input').value;
        app.storage.set('barber_pix_key', newKey);
        app.showToast('Chave PIX atualizada com sucesso!');
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
        const sorted = [...app.appointments].sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

        tbody.innerHTML = sorted.map(a => `
            <tr>
                <td><strong>${a.clientname}</strong></td>
                <td>${a.service}</td>
                <td>${a.date.split('-').reverse().join('/')}<br><small>${a.time}</small></td>
                <td>${a.price > 0 ? `R$ ${a.price.toFixed(2).replace('.', ',')}` : 'A combinar'}</td>
                <td><span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span></td>
                <td>
                    ${(a.status === 'Pendente' || a.status === 'Pago') ? `
                        <button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.7rem;" onclick="app.completeAppointment('${a.id}')">Concluir</button>
                        <button class="btn" style="padding: 5px 10px; font-size: 0.7rem; background:rgba(220, 53, 69, 0.1); color:#ff4d4d; border:1px solid #ff4d4d;" onclick="app.cancelByBarber('${a.id}')">Cancelar</button>
                    ` : ''}
                    ${a.status === 'Bloqueado' ? `<button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.7rem; border-color: var(--primary); color: var(--primary);" onclick="app.unblockTime('${a.id}')">Desbloquear</button>` : ''}
                    ${(a.status === 'Concluído') ? '<i class="fas fa-check-double" style="color:var(--primary); margin-right: 5px;"></i>' : ''}
                    <button class="btn" style="padding: 5px 10px; font-size: 0.7rem; background: rgba(255, 255, 255, 0.05); color: #a0a0a0; border: 1px solid rgba(255, 255, 255, 0.1);" onclick="app.deleteByBarber('${a.id}')" title="Excluir Permanentemente">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
            ${a.issunday ? `<tr><td colspan="6" style="background: rgba(212, 175, 55, 0.05); font-size: 0.8rem; border-top: none;"><i class="fas fa-truck"></i> Endereço: ${a.address}</td></tr>` : ''}
        `).join('');

        // Finance history
        app.renderFinanceHistory();

        // New Clients List
        app.renderBarberClients();
    },

    renderBarberClients: () => {
        const tbody = document.getElementById('barber-clients-body');
        if (!tbody) return;

        // Filtra para mostrar apenas clientes (não mostra o próprio barbeiro)
        const clients = app.users.filter(u => u.role === 'client');

        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Nenhum cliente cadastrado ainda.</td></tr>';
            return;
        }

        tbody.innerHTML = clients.map(u => `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td>
                    <a href="https://wa.me/?text=Olá ${u.name.split(' ')[0]}! Aqui é da Barbearia da Baixada..." target="_blank" class="btn" style="padding: 5px 10px; font-size: 0.7rem; background:rgba(37, 211, 102, 0.2); color:#25d366; border:1px solid #25d366;">
                        <i class="fab fa-whatsapp"></i> Contato
                    </a>
                </td>
            </tr>
        `).join('');
    },

    // Finance
    renderFinanceHistory: () => {
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

            financeList.innerHTML = Object.entries(byDay).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([date, total]) => `
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

        if (app.isTimeOccupied(date, time, duration)) {
            return app.showToast('Este horário já está ocupado.');
        }

        app.saveBlock({
            clientid: 'barber',
            clientname: 'BLOQUEIO',
            service: reason,
            date,
            time,
            price: 0,
            duration,
            status: 'Bloqueado'
        });
    },

    saveBlock: async (block) => {
        try {
            app.showToast('Bloqueando...');
            const { error } = await db.from('appointments').insert([block]);
            if (error) throw error;

            await app.syncData();
            app.renderBarberDashboard();
            app.showToast('Horário bloqueado!');
        } catch (err) {
            console.error(err);
            app.showToast('Erro ao bloquear horário.');
        }
    },

    unblockTime: async (id) => {
        if (confirm('Deseja realmente desbloquear este horário?')) {
            try {
                app.showToast('Desbloqueando...');
                const { error } = await db.from('appointments').delete().eq('id', id);
                if (error) throw error;

                await app.syncData();
                app.renderBarberDashboard();
                app.showToast('Horário desbloqueado.');
            } catch (err) {
                console.error(err);
                app.showToast('Erro ao desbloquear.');
            }
        }
    },

    cancelByBarber: async (id) => {
        const appointment = app.appointments.find(a => a.id === id);
        if (!appointment) return;

        if (confirm(`Deseja realmente cancelar o agendamento de ${appointment.clientname}?`)) {
            try {
                app.showToast('Cancelando...');
                const { error } = await db.from('appointments').update({ status: 'Cancelado' }).eq('id', id);
                if (error) throw error;
                
                // Busca o email do cliente
                const client = app.users.find(u => u.id === appointment.clientid);
                
                await app.syncData();
                app.renderBarberDashboard();
                app.showToast('Agendamento cancelado!');

                if (client && client.email) {
                    const subject = encodeURIComponent('⚠️ Aviso de Cancelamento - Barbearia da Baixada');
                    const body = encodeURIComponent(`Olá ${client.name.split(' ')[0]}!\n\nInfelizmente precisamos cancelar o seu agendamento de ${appointment.service} marcado para o dia ${appointment.date.split('-').reverse().join('/')} às ${appointment.time}.\n\nPedimos desculpas pelo transtorno. Por favor, acesse nosso site e escolha um novo horário que seja melhor para você!\n\nAtt,\nBarbearia da Baixada 💈`);
                    
                    const mailto = `https://mail.google.com/mail/?view=cm&fs=1&to=${client.email}&su=${subject}&body=${body}`;
                    window.open(mailto, '_blank');
                    app.showToast('Agendamento cancelado! Notificando cliente...');
                }
            } catch (err) {
                console.error(err);
                app.showToast('Erro ao cancelar.');
            }
        }
    },

    completeAppointment: async (id) => {
        try {
            app.showToast('Concluindo...');
            const { error } = await db.from('appointments').update({ status: 'Concluído' }).eq('id', id);
            if (error) throw error;

            await app.syncData();
            app.renderBarberDashboard();
            app.showToast('Serviço concluído!');
        } catch (err) {
            console.error(err);
            app.showToast('Erro ao concluir serviço.');
        }
    },

    deleteByBarber: async (id) => {
        const appointment = app.appointments.find(a => a.id === id);
        if (!appointment) return;

        if (confirm(`⚠️ EXCLUSÃO PERMANENTE\n\nDeseja realmente apagar o registro de ${appointment.clientname} do sistema?\n\nEsta ação não pode ser desfeita.`)) {
            try {
                app.showToast('Excluindo...');
                const { error } = await db.from('appointments').delete().eq('id', id);
                if (error) throw error;

                await app.syncData();
                app.renderBarberDashboard();
                app.showToast('Registro excluído permanentemente.');
            } catch (err) {
                console.error(err);
                app.showToast('Erro ao excluir registro.');
            }
        }
    }
};

window.onload = app.init;
