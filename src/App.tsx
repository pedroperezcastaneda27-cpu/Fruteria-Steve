import React, { useEffect, useMemo, useState } from 'react';
import {
  STORAGE_KEYS,
  initialPermissions,
  initialProducts,
  initialUsers,
  loadFromStorage,
  saveToStorage,
  type CartItem,
  type Order,
  type PermissionState,
  type Product,
  type Role,
  type Sale,
  type User,
} from './types';

type Store = {
  id?: number;
  name: string;
  mercadoPagoAccessToken?: string | null;
  createdAt?: string;
};

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const tabs = [
  'inicio',
  'catalogo',
  'carrito',
  'pedido',
  'caja',
  'inventario',
  'admin',
  'reportes',
] as const;

type Tab = (typeof tabs)[number];

const productLookup = (products: Product[], id: number) =>
  products.find((product) => product.id === id);

const roleTabs: Record<Role, Tab[]> = {
  admin: ['inicio', 'catalogo', 'carrito', 'pedido', 'caja', 'inventario', 'admin', 'reportes'],
  cajero: ['inicio', 'caja', 'inventario', 'reportes'],
  cliente: ['inicio', 'catalogo', 'carrito', 'pedido'],
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() =>
    loadFromStorage(STORAGE_KEYS.products, initialProducts),
  );
  const [users, setUsers] = useState<User[]>(() =>
    loadFromStorage(STORAGE_KEYS.users, initialUsers),
  );
  const [cart, setCart] = useState<CartItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.cart, [] as CartItem[]),
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    loadFromStorage(STORAGE_KEYS.orders, [] as Order[]),
  );
  const [sales, setSales] = useState<Sale[]>(() =>
    loadFromStorage(STORAGE_KEYS.sales, [] as Sale[]),
  );
  const [permissions, setPermissions] = useState<PermissionState>(() =>
    loadFromStorage(STORAGE_KEYS.permissions, initialPermissions),
  );
  const [activeUserId, setActiveUserId] = useState<number | null>(() => {
    const current = loadFromStorage<number | null>(STORAGE_KEYS.currentUser, null);
    return current;
  });
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [loginForm, setLoginForm] = useState({ email: 'admin@fruteriasteve.com', password: '123456' });
  const [posSearch, setPosSearch] = useState('');
  const [posItems, setPosItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'digital'>('efectivo');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '123456',
    role: 'cliente' as Role,
  });

  // Store / MercadoPago setup
  const [store, setStore] = useState<Store | null>(null);
  const [storeForm, setStoreForm] = useState<{ name: string; mercadoPagoAccessToken: string }>({ name: '', mercadoPagoAccessToken: '' });

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.users, users);
  }, [users]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.cart, cart);
  }, [cart]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.orders, orders);
  }, [orders]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.sales, sales);
  }, [sales]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.permissions, permissions);
  }, [permissions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.currentUser, activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // load store from server (local lowdb) so admin can configure Mercado Pago quickly
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/store');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setStore(data);
            setStoreForm({ name: data.name || '', mercadoPagoAccessToken: data.mercadoPagoAccessToken || '' });
          }
        }
      } catch (err) {
        // ignore -- server may not be running locally
      }
    })();
  }, []);

  const activeUser = users.find((user) => user.id === activeUserId) ?? null;
  const visibleTabs = activeUser ? roleTabs[activeUser.role] : ['inicio', 'catalogo'];

  useEffect(() => {
    if (!activeUser) return;
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeUser, visibleTabs, activeTab]);

  const categories = useMemo(
    () => ['Todas', ...new Set(products.map((product) => product.category))],
    [products],
  );

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory;
    const matchesSearch = `${product.name} ${product.description}`
      .toLowerCase()
      .includes(query.toLowerCase());

    return product.active && matchesCategory && matchesSearch;
  });

  const prodPosList = useMemo(() => {
    if (!posSearch) return products.filter((p) => p.active);
    return products.filter((p) => p.active && p.name.toLowerCase().includes(posSearch.toLowerCase()));
  }, [products, posSearch]);

  const cartItems = cart
    .map((item) => {
      const product = productLookup(products, item.productId);
      if (!product) return null;
      return { ...product, quantity: item.quantity, subtotal: product.price * item.quantity };
    })
    .filter(Boolean) as Array<Product & { quantity: number; subtotal: number }>;

  const cartTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

  const posItemsData = posItems
    .map((item) => {
      const product = productLookup(products, item.productId);
      if (!product) return null;
      return { ...product, quantity: item.quantity, subtotal: product.price * item.quantity };
    })
    .filter(Boolean) as Array<Product & { quantity: number; subtotal: number }>;

  const posTotal = posItemsData.reduce((sum, item) => sum + item.subtotal, 0);

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStockProducts = products.filter((product) => product.stock <= 5);
  const dailyTotal = sales.reduce((sum, sale) => sum + sale.total, 0);
  const orderCount = orders.length;

  const handleAddProductToCart = (productId: number) => {
    const product = productLookup(products, productId);
    if (!product || product.stock <= 0) return;

    setCart((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (productId: number, delta: number) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          return nextQty > 0 ? { ...item, quantity: nextQty } : null;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const handleRemoveCartItem = (productId: number) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const handleCreateOrder = () => {
    if (!activeUser) {
      alert('Debes iniciar sesión para confirmar un pedido.');
      return;
    }

    if (cartItems.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        alert(`No hay suficiente inventario de ${item.name}.`);
        return;
      }
    }

    const orderId = `ORD-${Date.now()}`;
    const createdOrder: Order = {
      id: orderId,
      userId: activeUser.id,
      status: 'recibido',
      total: cartTotal,
      createdAt: new Date().toISOString(),
      paymentStatus: 'pendiente',
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
    };

    setOrders((current) => [createdOrder, ...current]);
    setProducts((current) =>
      current.map((product) => {
        const item = cartItems.find((cartItem) => cartItem.id === product.id);
        return item ? { ...product, stock: product.stock - item.quantity } : product;
      }),
    );
    setCart([]);
    setActiveTab('pedido');
    alert(`Pedido ${orderId} registrado correctamente.`);
  };

  const handleLogin = () => {
    const matchedUser = users.find(
      (user) => user.email === loginForm.email && user.password === loginForm.password,
    );

    if (!matchedUser) {
      alert('Credenciales incorrectas.');
      return;
    }

    setActiveUserId(matchedUser.id);
    setActiveTab(matchedUser.role === 'admin' ? 'admin' : matchedUser.role === 'cajero' ? 'caja' : 'catalogo');
    alert(`Sesión iniciada como ${matchedUser.name}.`);
  };

  const handleLogout = () => {
    setActiveUserId(null);
    setActiveTab('inicio');
    alert('Sesión cerrada.');
  };

  const handleAddToPos = (productId: number) => {
    setPosItems((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        const product = productLookup(products, productId);
        if (!product) return current;
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item,
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  };

  const handleUpdatePosQty = (productId: number, delta: number) => {
    setPosItems((current) =>
      current
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          return nextQty > 0 ? { ...item, quantity: nextQty } : null;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const handleFinalizeSale = () => {
    if (!activeUser || activeUser.role === 'cliente') {
      alert('Necesitas iniciar sesión como cajero o administrador para realizar ventas.');
      return;
    }

    if (posItemsData.length === 0) {
      alert('La venta está vacía.');
      return;
    }

    const saleId = `SALE-${Date.now()}`;
    const sale: Sale = {
      id: saleId,
      cashierId: activeUser.id,
      total: posTotal,
      paymentMethod,
      createdAt: new Date().toISOString(),
      items: posItemsData.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
    };

    setSales((current) => [sale, ...current]);
    setProducts((current) =>
      current.map((product) => {
        const item = posItemsData.find((p) => p.id === product.id);
        return item ? { ...product, stock: product.stock - item.quantity } : product;
      }),
    );
    setPosItems([]);
    setPaymentMethod('efectivo');
    alert(`Venta ${saleId} registrada correctamente.`);
  };

  const handlePermissionToggle = (key: keyof PermissionState) => {
    setPermissions((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleInventoryAdjustment = (productId: number, delta: number) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, stock: Math.max(0, product.stock + delta) } : product,
      ),
    );
  };

  const handleCreateUser = () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      alert('Completa nombre, correo y contraseña.');
      return;
    }

    const exists = users.some((user) => user.email.toLowerCase() === newUserForm.email.toLowerCase());
    if (exists) {
      alert('Ese correo ya existe.');
      return;
    }

    const user: User = {
      id: Date.now(),
      name: newUserForm.name,
      email: newUserForm.email,
      phone: newUserForm.phone || '0000000000',
      password: newUserForm.password,
      role: newUserForm.role,
    };

    setUsers((current) => [user, ...current]);
    setNewUserForm({ name: '', email: '', phone: '', password: '123456', role: 'cliente' });
    alert(`Usuario ${user.name} creado con rol ${user.role}.`);
  };

  // Save store configuration to local server (/api/setup)
  const handleSaveStore = async () => {
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: storeForm.name, mercadoPagoAccessToken: storeForm.mercadoPagoAccessToken || null }),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      const json = await res.json();
      setStore(json.store || { name: storeForm.name, mercadoPagoAccessToken: storeForm.mercadoPagoAccessToken });
      // also persist locally so admin can install PWA and keep token in localStorage
      localStorage.setItem('fruteria-steve-store', JSON.stringify({ name: storeForm.name, mercadoPagoAccessToken: storeForm.mercadoPagoAccessToken }));
      alert('Configuración guardada.');
    } catch (err) {
      alert('Error guardando configuración. Asegúrate de que el servidor esté corriendo localmente.');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">🍏</div>
          <div>
            <h1>Frutería Steve</h1>
            <small>PWA • Tienda + Caja</small>
          </div>
        </div>

        <nav className="nav">
          {visibleTabs.map((tab) => (
            <button key={tab} className={tab === activeTab ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>

        <div className="user-box">
          {activeUser ? (
            <>
              <strong>{activeUser.name}</strong>
              <span>{activeUser.role}</span>
              <button className="secondary-button" onClick={handleLogout}>Cerrar sesión</button>
            </>
          ) : (
            <div className="login-card">
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="Email"
              />
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((current) => ({ ...current, password: e.target.value }))}
                placeholder="Contraseña"
              />
              <button className="primary-button" onClick={handleLogin}>Iniciar sesión</button>
            </div>
          )}
        </div>

        {installPrompt && (
          <button
            className="primary-button"
            onClick={() => {
              (installPrompt as any).prompt();
              setInstallPrompt(null);
            }}
          >
            Instalar app
          </button>
        )}
      </aside>

      <main className="content">
        {activeTab === 'inicio' && (
          <section className="panel-grid">
            <div className="stat-card green">
              <span>Ventas del día</span>
              <strong>{currency.format(dailyTotal)}</strong>
            </div>
            <div className="stat-card">
              <span>Pedidos</span>
              <strong>{orderCount}</strong>
            </div>
            <div className="stat-card">
              <span>Stock total</span>
              <strong>{totalStock}</strong>
            </div>
            <div className="stat-card red">
              <span>Productos bajos</span>
              <strong>{lowStockProducts.length}</strong>
            </div>

            <div className="wide-card">
              <h3>
                {activeUser ? `Panel ${activeUser.role}` : 'Panel público'}
              </h3>
              <ul className="summary-list">
                {activeUser?.role === 'admin' && (
                  <>
                    <li>Administrador: controla catálogo, permisos, usuarios y reportes.</li>
                    <li>Gestión del inventario por producto y alertas de stock bajo.</li>
                    <li>Supervisión de caja, pedidos y ventas diarias.</li>
                  </>
                )}
                {activeUser?.role === 'cajero' && (
                  <>
                    <li>Cajero: genera ventas directas con cobro en efectivo, tarjeta o digital.</li>
                    <li>Consulta inventario y también puede registrar bajas de stock.</li>
                    <li>Revisa reportes rápidos de cobros y ventas del día.</li>
                  </>
                )}
                {activeUser?.role === 'cliente' && (
                  <>
                    <li>Cliente: navega el catálogo, añade productos al carrito y confirma pedidos.</li>
                    <li>Consulta su historial de pedidos y estado de pago.</li>
                    <li>Puede recoger la compra en tienda con código de pickup.</li>
                  </>
                )}
                {!activeUser && (
                  <>
                    <li>Catalogo visible en modo público para explorar productos.</li>
                    <li>Inicia sesión para acceder según tu rol.</li>
                    <li>Cliente, cajero y administrador tienen vista independiente.</li>
                  </>
                )}
              </ul>
            </div>
          </section>
        )}

        {activeTab === 'catalogo' && (
          <section className="panel">
            <div className="toolbar">
              <input
                type="text"
                placeholder="Buscar producto..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="card-grid">
              {filteredProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <div className="emoji">{product.image}</div>
                  <h3>{product.name}</h3>
                  <span className="chip">{product.category}</span>
                  <p>{product.description}</p>
                  <div className="meta-row">
                    <strong>{currency.format(product.price)}</strong>
                    <span>{product.stock} en stock</span>
                  </div>
                  <button className="primary-button" onClick={() => handleAddProductToCart(product.id)}>
                    Agregar al carrito
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'carrito' && (
          <section className="panel">
            <h3>Carrito de compras</h3>
            {cartItems.length === 0 ? (
              <p>Tu carrito está vacío.</p>
            ) : (
              <>
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {currency.format(item.price)} / {item.unit}
                      </small>
                    </div>
                    <div className="quantity-row">
                      <button onClick={() => handleUpdateCartQty(item.id, -1)}>-</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => handleUpdateCartQty(item.id, 1)}>+</button>
                    </div>
                    <strong>{currency.format(item.subtotal)}</strong>
                    <button className="danger-button" onClick={() => handleRemoveCartItem(item.id)}>
                      Eliminar
                    </button>
                  </div>
                ))}
                <div className="checkout-box">
                  <h4>Total: {currency.format(cartTotal)}</h4>
                  <button className="primary-button" onClick={handleCreateOrder}>Confirmar pedido</button>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'pedido' && (
          <section className="panel">
            <h3>Pedidos</h3>
            {orders.length === 0 ? (
              <p>No hay pedidos aún.</p>
            ) : (
              <div className="list-stack">
                {orders.map((order) => (
                  <div key={order.id} className="order-card">
                    <div className="row-between">
                      <strong>{order.id}</strong>
                      <span className="chip">{order.status}</span>
                    </div>
                    <p>{order.items.length} productos</p>
                    <p>Pago: {order.paymentStatus}</p>
                    <p>Importe: {currency.format(order.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'caja' && (
          <section className="panel">
            {activeUser && activeUser.role !== 'cliente' ? (
              <>
                <div className="toolbar">
                  <input
                    type="text"
                    placeholder="Buscar producto en caja"
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                  />
                </div>

                <div className="pos-layout">
                  <div className="pos-products">
                    {prodPosList.map((product) => (
                      <button key={product.id} className="pos-product" onClick={() => handleAddToPos(product.id)}>
                        <span>{product.image}</span>
                        <div>
                          <strong>{product.name}</strong>
                          <small>{currency.format(product.price)}</small>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="pos-ticket">
                    <h3>Ticket de venta</h3>
                    {posItemsData.length === 0 ? (
                      <p>Sin productos.</p>
                    ) : (
                      <>
                        {posItemsData.map((item) => (
                          <div key={item.id} className="cart-item compact">
                            <div>
                              <strong>{item.name}</strong>
                              <small>{currency.format(item.price)}</small>
                            </div>
                            <div className="quantity-row">
                              <button onClick={() => handleUpdatePosQty(item.id, -1)}>-</button>
                              <span>{item.quantity}</span>
                              <button onClick={() => handleUpdatePosQty(item.id, 1)}>+</button>
                            </div>
                            <strong>{currency.format(item.subtotal)}</strong>
                          </div>
                        ))}
                        <div className="checkout-box">
                          <label>
                            Método de pago:
                            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                              <option value="efectivo">Efectivo</option>
                              <option value="tarjeta">Tarjeta</option>
                              <option value="digital">Digital</option>
                            </select>
                          </label>
                          <h4>Total: {currency.format(posTotal)}</h4>
                          <button className="primary-button" onClick={handleFinalizeSale}>Cobrar</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="wide-card">
                <h3>Acceso restringido</h3>
                <p>El cliente solo puede navegar el catálogo y confirmar pedidos.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'inventario' && (
          <section className="panel">
            <h3>Inventario</h3>
            <div className="list-stack">
              {products.map((product) => (
                <div key={product.id} className="inventory-row">
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.category}</small>
                  </div>
                  <span className={product.stock <= 5 ? 'alert-badge' : 'ok-badge'}>
                    {product.stock} {product.unit}
                  </span>
                  <div className="mini-actions">
                    <button onClick={() => handleInventoryAdjustment(product.id, 5)}>+5</button>
                    <button onClick={() => handleInventoryAdjustment(product.id, -1)}>-1</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'admin' && (
          <section className="panel">
            {activeUser?.role === 'admin' ? (
              <>
                <h3>Panel administrativo</h3>

                <div className="admin-card">
                  <h4>Configuración de tienda</h4>
                  <div className="switch-grid">
                    <input placeholder="Nombre de la tienda" value={storeForm.name} onChange={(e) => setStoreForm((c) => ({ ...c, name: e.target.value }))} />
                    <input placeholder="Token Mercado Pago" value={storeForm.mercadoPagoAccessToken} onChange={(e) => setStoreForm((c) => ({ ...c, mercadoPagoAccessToken: e.target.value }))} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="primary-button" onClick={handleSaveStore}>Guardar configuración</button>
                      <button className="secondary-button" onClick={() => { setStoreForm({ name: '', mercadoPagoAccessToken: '' }); localStorage.removeItem('fruteria-steve-store'); alert('Formulario limpiado'); }}>Limpiar</button>
                    </div>
                    {store && (
                      <div style={{ marginTop: 8 }}>
                        <small>Tienda guardada: <strong>{store.name}</strong></small>
                        <div>
                          <small>MP token: <strong>{store.mercadoPagoAccessToken ? (store.mercadoPagoAccessToken.slice(0, 6) + '••••') : 'no configurado'}</strong></small>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-card">
                  <h4>Permisos por rol</h4>
                  <div className="switch-grid">
                    {(Object.keys(permissions) as Array<keyof PermissionState>).map((key) => (
                      <label key={key} className="switch-row">
                        <span>{key}</span>
                        <input type="checkbox" checked={permissions[key]} onChange={() => handlePermissionToggle(key)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="admin-card">
                  <h4>Crear usuario</h4>
                  <div className="switch-grid">
                    <input placeholder="Nombre" value={newUserForm.name} onChange={(e) => setNewUserForm((c) => ({ ...c, name: e.target.value }))} />
                    <input placeholder="Correo" value={newUserForm.email} onChange={(e) => setNewUserForm((c) => ({ ...c, email: e.target.value }))} />
                    <input placeholder="Teléfono" value={newUserForm.phone} onChange={(e) => setNewUserForm((c) => ({ ...c, phone: e.target.value }))} />
                    <input type="password" placeholder="Contraseña" value={newUserForm.password} onChange={(e) => setNewUserForm((c) => ({ ...c, password: e.target.value }))} />
                    <select value={newUserForm.role} onChange={(e) => setNewUserForm((c) => ({ ...c, role: e.target.value as Role }))}>
                      <option value="admin">Admin</option>
                      <option value="cajero">Cajero</option>
                      <option value="cliente">Cliente</option>
                    </select>
                    <button className="primary-button" onClick={handleCreateUser}>Guardar usuario</button>
                  </div>
                </div>

                <div className="admin-card">
                  <h4>Productos</h4>
                  <div className="list-stack compact">
                    {products.map((product) => (
                      <div key={product.id} className="inventory-row">
                        <div>
                          <strong>{product.name}</strong>
                          <small>{currency.format(product.price)}</small>
                        </div>
                        <button
                          className={product.active ? 'primary-button' : 'secondary-button'}
                          onClick={() => setProducts((current) => current.map((p) => p.id === product.id ? { ...p, active: !p.active } : p))}
                        >
                          {product.active ? 'Activo' : 'Inactivo'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="wide-card">
                <h3>Acceso restringido</h3>
                <p>Solo el administrador puede administrar usuarios, productos y permisos.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'reportes' && (
          <section className="panel">
            <h3>Reportes y estadísticas</h3>
            <div className="card-grid">
              <div className="stat-card">
                <span>Ventas registradas</span>
                <strong>{sales.length}</strong>
              </div>
              <div className="stat-card">
                <span>Ingreso total</span>
                <strong>{currency.format(dailyTotal)}</strong>
              </div>
              <div className="stat-card">
                <span>Mercancía baja</span>
                <strong>{lowStockProducts.length}</strong>
              </div>
            </div>

            <div className="report-table">
              {sales.map((sale) => (
                <div key={sale.id} className="report-row">
                  <span>{sale.id}</span>
                  <span>{sale.paymentMethod}</span>
                  <span>{currency.format(sale.total)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
