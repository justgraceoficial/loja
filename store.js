/* ======================================================================
   Just Grace — camada de dados (localStorage)
   Usada pela loja (index.html) e pelo painel de gestão (gestao.html).
   ====================================================================== */
(function(){

  const KEYS = {
    products: 'jg_products',
    orders: 'jg_orders',
    customers: 'jg_customers',
    users: 'jg_users',
    delivery: 'jg_delivery_fees',
    waitlist: 'jg_waitlist',
    session: 'jg_session',
    audit: 'jg_audit',
    seeded: 'jg_seeded_v1',
  };

  /* ----------------------------------------------------------------
     Sincronização remota dos pedidos (Google Apps Script)
     Preencha apiUrl e token depois de implantar o Code.gs como Web App.
     Enquanto apiUrl estiver vazio, o sistema funciona só com localStorage,
     como antes.
     ---------------------------------------------------------------- */
  const SYNC_CONFIG = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbxCDfMFqedJH3A2OHdqO8IccThDOIFtpEfPwzA8vl4cNCEqCoaZQBQEsBfwsxZdiVY/exec',
    token: 'jgSec9rX4mNqT2wZ',
  };

  function isSyncConfigured(){
    return !!(SYNC_CONFIG.apiUrl && SYNC_CONFIG.token);
  }

  async function pushListToServer(type, list){
    if(!isSyncConfigured()) return;
    try{
      await fetch(SYNC_CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ token: SYNC_CONFIG.token, type, [type]: list }),
      });
    }catch(err){
      console.warn('Just Grace: não foi possível sincronizar "' + type + '" com o servidor.', err);
    }
  }
  async function pullListFromServer(type, key){
    if(!isSyncConfigured()) return null;
    try{
      const res = await fetch(SYNC_CONFIG.apiUrl + '?token=' + encodeURIComponent(SYNC_CONFIG.token) + '&type=' + type);
      const data = await res.json();
      if(data && Array.isArray(data[type])){
        write(key, data[type]);
        return data[type];
      }
    }catch(err){
      console.warn('Just Grace: não foi possível buscar "' + type + '" do servidor.', err);
    }
    return null;
  }

  const pushOrdersToServer    = (list) => pushListToServer('orders', list);
  const pullOrdersFromServer  = ()     => pullListFromServer('orders', KEYS.orders);
  const pushCustomersToServer = (list) => pushListToServer('customers', list);
  const pullCustomersFromServer = ()   => pullListFromServer('customers', KEYS.customers);
  const pushWaitlistToServer  = (list) => pushListToServer('waitlist', list);
  const pullWaitlistFromServer = ()    => pullListFromServer('waitlist', KEYS.waitlist);
  const pushProductsToServer  = (list) => pushListToServer('products', list);
  const pullProductsFromServer = ()    => pullListFromServer('products', KEYS.products);

  // pede ao Apps Script para abrir um pagamento online (PIX ou cartão via Mercado Pago).
  // method: 'pix' ou 'card' — restringe a forma de pagamento na página do Mercado Pago.
  // Só funciona depois que o token do Mercado Pago for configurado no Code.gs.
  async function requestOnlinePayment(order, method){
    if(!isSyncConfigured()){
      return { error: 'Sincronização remota não configurada.' };
    }
    try{
      const res = await fetch(SYNC_CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createPayment',
          token: SYNC_CONFIG.token,
          order,
          paymentMethod: method || 'both',
          successUrl: window.location.origin + window.location.pathname,
          failureUrl: window.location.origin + window.location.pathname,
        }),
      });
      return await res.json();
    }catch(err){
      return { error: 'Não foi possível conectar ao pagamento online.' };
    }
  }

  function read(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }
  function write(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix){
    return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function nowISO(){ return new Date().toISOString(); }
  function money(cents){
    return 'R$ ' + ((cents||0) / 100).toFixed(2).replace('.', ',');
  }

  const orderStatusLabels = {
    cart_confirmed: 'Contato pendente',
    contacted: 'Contato realizado',
    payment_pending: 'Aguardando pagamento',
    paid: 'Pago',
    fulfilled: 'Entregue',
    cancelled: 'Cancelado',
    payment_error: 'Erro no pagamento',
    payment_expired: 'Pagamento expirado',
    payment_cancelled: 'Pagamento cancelado',
  };
  function orderStatusLabel(status){
    return orderStatusLabels[status] || status;
  }

  /* ---------------- seed inicial (roda uma única vez) ---------------- */
  function seedIfNeeded(){
    if(read(KEYS.seeded, false)) return;

    const defaultUsers = [
      {
        id: uid('u'),
        name: 'Administrador',
        email: 'admin@justgrace.com.br',
        password: 'justgrace123',
        role: 'admin',
        status: 'active',
        permissions: ['orders_manage','products_manage','stock_manage','delivery_manage','users_manage'],
        createdAt: nowISO(),
        updatedAt: nowISO(),
      },
      {
        id: uid('u'),
        name: 'Pedro Pires Neves',
        email: 'pedropiresneves@hotmail.com',
        password: 'Peu19012003',
        role: 'admin',
        status: 'active',
        permissions: ['orders_manage','products_manage','stock_manage','delivery_manage','users_manage'],
        createdAt: nowISO(),
        updatedAt: nowISO(),
      },
    ];

    const svgPlaceholder = '<circle cx="50" cy="50" r="28" stroke="#f3ede1" stroke-width="2" fill="none"/><path d="M38 42 L50 30 L62 42" stroke="#f3ede1" stroke-width="2" fill="none" stroke-linecap="round"/>';

    const defaultProducts = [
      { id:uid('p'), cat:'basicas', tag:'Camiseta', name:'Camiseta Graça Essencial', desc:'Algodão penteado, corte reto, estampa minimalista.', priceCents:8900, stockQuantity:12, status:'active', sku:'JG-BAS-001', svg:svgPlaceholder, image:'https://placehold.co/500x500/070706/f3ede1?text=Camiseta+Preta&font=montserrat', sizes:['P','M','G','GG'] },
      { id:uid('p'), cat:'basicas', tag:'Camiseta', name:'Camiseta Fé em Movimento', desc:'Malha macia, silk artesanal no peito.', priceCents:9400, stockQuantity:8, status:'active', sku:'JG-BAS-002', svg:svgPlaceholder, image:'https://placehold.co/500x500/f3ede1/070706?text=Camiseta+Off-White&font=montserrat', sizes:['P','M','G','GG'] },
      { id:uid('p'), cat:'duopima', tag:'Duo Pima', name:'Camiseta Duo Pima Propósito', desc:'Algodão Pima premium, toque macio e caimento superior.', priceCents:12900, stockQuantity:5, status:'active', sku:'JG-DUO-001', svg:svgPlaceholder, image:'', sizes:['P','M','G','GG'] },
      { id:uid('p'), cat:'duopima', tag:'Duo Pima', name:'Camiseta Duo Pima A Graça Basta', desc:'Edição limitada, bordado discreto.', priceCents:13900, stockQuantity:0, status:'active', sku:'JG-DUO-002', svg:svgPlaceholder, image:'', sizes:['P','M','G','GG'] },
    ];

    const defaultDelivery = [
      { id:1, zone:'Zona Sul', neighborhood:'Cabedelo Centro', feeCents:800 },
      { id:2, zone:'Zona Sul', neighborhood:'Intermares', feeCents:1000 },
      { id:3, zone:'João Pessoa', neighborhood:'Bessa', feeCents:1200 },
      { id:4, zone:'João Pessoa', neighborhood:'Tambaú', feeCents:1500 },
      { id:5, zone:'Outras cidades', neighborhood:'Combinar via WhatsApp', feeCents:0 },
    ];

    write(KEYS.users, defaultUsers);
    write(KEYS.products, defaultProducts);
    write(KEYS.orders, []);
    write(KEYS.customers, []);
    write(KEYS.delivery, defaultDelivery);
    write(KEYS.audit, []);
    write(KEYS.seeded, true);
  }
  seedIfNeeded();

  /* garante que o login pessoal exista mesmo se o localStorage já tinha
     sido semeado antes (ex.: versão anterior sem esse usuário) */
  function ensurePersonalUser(){
    const users = read(KEYS.users, []);
    const exists = users.some(u => u.email.toLowerCase() === 'pedropiresneves@hotmail.com');
    if(!exists){
      users.unshift({
        id: uid('u'),
        name: 'Pedro Pires Neves',
        email: 'pedropiresneves@hotmail.com',
        password: 'Peu19012003',
        role: 'admin',
        status: 'active',
        permissions: ['orders_manage','products_manage','stock_manage','delivery_manage','users_manage'],
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
      write(KEYS.users, users);
    }
  }
  ensurePersonalUser();

  /* ---------------- API pública ---------------- */
  const JGStore = {
    KEYS,
    read,
    write,
    uid,
    nowISO,
    money,
    orderStatusLabel,

    // produtos
    getProducts(){ return read(KEYS.products, []); },
    saveProducts(list){ write(KEYS.products, list); pushProductsToServer(list); },

    // pedidos
    getOrders(){ return read(KEYS.orders, []); },
    saveOrders(list){ write(KEYS.orders, list); pushOrdersToServer(list); },

    // clientes
    getCustomers(){ return read(KEYS.customers, []); },
    saveCustomers(list){ write(KEYS.customers, list); pushCustomersToServer(list); },

    // lista de espera ("avise-me")
    getWaitlist(){ return read(KEYS.waitlist, []); },
    saveWaitlist(list){ write(KEYS.waitlist, list); pushWaitlistToServer(list); },
    addWaitlistEntry({ productName, customerName, customerPhone }){
      const list = this.getWaitlist();
      list.unshift({
        id: uid('esp'),
        productName, customerName, customerPhone,
        status: 'pending',
        createdAt: nowISO(),
      });
      this.saveWaitlist(list);
      this.addAudit('waitlist_add', `${customerName} quer ser avisado(a) sobre "${productName}".`, 'Loja');
      return list[0];
    },

    // sincronização remota (Google Apps Script)
    isSyncConfigured,
    syncOrders: pullOrdersFromServer,
    syncCustomers: pullCustomersFromServer,
    syncWaitlist: pullWaitlistFromServer,
    syncProducts: pullProductsFromServer,
    requestOnlinePayment,

    // usuários
    getUsers(){ return read(KEYS.users, []); },
    saveUsers(list){ write(KEYS.users, list); },

    // fretes
    getDeliveryFees(){ return read(KEYS.delivery, []); },
    saveDeliveryFees(list){ write(KEYS.delivery, list); },

    // calcula o frete a partir do texto do bairro digitado pelo cliente
    quoteDelivery(neighborhoodText){
      const fees = this.getDeliveryFees();
      const term = (neighborhoodText || '').trim().toLowerCase();
      if(!term) return null;
      const hit = fees.find(f => f.neighborhood && f.neighborhood.toLowerCase().includes(term))
        || fees.find(f => term.includes((f.neighborhood||'').toLowerCase()) && f.neighborhood);
      if(hit) return { zone: hit.zone, neighborhood: hit.neighborhood, feeCents: hit.feeCents, matched: true };
      // não encontrou bairro atendido — cai no combinar via WhatsApp, se existir
      const fallback = fees.find(f => /combinar/i.test(f.neighborhood || '') || /outra/i.test(f.zone || ''));
      if(fallback) return { zone: fallback.zone, neighborhood: fallback.neighborhood, feeCents: 0, matched: false };
      return { zone: '', neighborhood: neighborhoodText, feeCents: 0, matched: false };
    },

    // sessão
    getSession(){ return read(KEYS.session, null); },
    setSession(session){ write(KEYS.session, session); },
    clearSession(){ localStorage.removeItem(KEYS.session); },

    // auditoria
    addAudit(action, detail, actor){
      const audit = read(KEYS.audit, []);
      audit.unshift({ id: uid('a'), action, detail, actor, createdAt: nowISO() });
      write(KEYS.audit, audit.slice(0, 500));
    },

    // usado pela loja ao finalizar um pedido
    createStoreOrder({ customerName, customerPhone, customerEmail, items, address, deliveryFeeCents, paymentMethod }){
      const orders = this.getOrders();
      const products = this.getProducts();

      const orderItems = items.map(i => ({ name:i.name, size:i.size||'', price:i.price, qty:i.qty, subtotalCents: Math.round(i.price*100)*i.qty }));
      const productsCents = orderItems.reduce((s,i)=> s + i.subtotalCents, 0);
      const feeCents = deliveryFeeCents || 0;
      const totalCents = productsCents + feeCents;

      const order = {
        id: uid('PED').toUpperCase(),
        customerName,
        customerPhone,
        customerEmail: customerEmail || '',
        address: address || null,
        items: orderItems,
        productsCents,
        deliveryFeeCents: feeCents,
        totalCents,
        status: 'cart_confirmed',
        paymentMethod: paymentMethod || '',
        events: [{ id:uid('ev'), label:'Pedido recebido pela loja online', actor:'Loja', createdAt: nowISO() }],
        createdAt: nowISO(),
      };
      orders.unshift(order);
      this.saveOrders(orders);

      // baixa estoque
      orderItems.forEach(oi=>{
        const p = products.find(pp => pp.name === oi.name);
        if(p) p.stockQuantity = Math.max(0, p.stockQuantity - oi.qty);
      });
      this.saveProducts(products);

      // registra/atualiza cliente, guardando o último endereço usado
      const customers = this.getCustomers();
      let c = customers.find(cc => cc.phone === customerPhone);
      if(!c){
        c = { id: uid('cli'), name: customerName, phone: customerPhone, email:'', createdAt: nowISO(), internalNotes:'', nextContactAt:'', orders: [] };
        customers.unshift(c);
      }
      c.name = customerName || c.name;
      c.email = customerEmail || c.email;
      if(address) c.address = address;
      c.orders = c.orders || [];
      c.orders.unshift({ id: order.id, totalCents: order.totalCents, status: order.status, createdAt: order.createdAt });
      this.saveCustomers(customers);

      this.addAudit('order_create', `Novo pedido ${order.id} de ${customerName}.`, 'Loja');
      return order;
    },

    // busca um cliente já cadastrado pelo WhatsApp (usado no "já sou cliente")
    findCustomerByPhone(phone){
      const digits = (phone || '').replace(/\D/g, '');
      if(digits.length < 8) return null;
      return this.getCustomers().find(c => (c.phone || '').replace(/\D/g,'').endsWith(digits.slice(-8))) || null;
    },
  };

  window.JGStore = JGStore;
})();
