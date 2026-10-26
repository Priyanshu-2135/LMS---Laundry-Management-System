
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ShoppingBag, ClipboardList, RefreshCw,
  Plus, Search, Shirt, IndianRupee, Clock3, CheckCircle2,
  PackageCheck, ArrowUpRight, LoaderCircle, X
} from "lucide-react";
import "./App.css";

const API = "http://localhost:5000/api";

const money = value =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2
  }).format(Number(value || 0));

const statuses = [
  "Received", "Washing", "Ironing", "Ready", "Delivered", "Cancelled"
];

function App() {
  const [page, setPage] = useState("overview");
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "Demo Customer",
    phone: "9876543210",
    pickupDate: "",
    notes: ""
  });
  const [quantities, setQuantities] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [s, o, st] = await Promise.all([
        fetch(`${API}/services`),
        fetch(`${API}/orders`),
        fetch(`${API}/admin/stats`)
      ]);

      if (!s.ok || !o.ok || !st.ok) {
        throw new Error("Could not load data. Check the backend.");
      }

      setServices(await s.json());
      setOrders(await o.json());
      setStats(await st.json());
    } catch (e) {
      setError(e.message || "Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedItems = useMemo(
    () => services
      .filter(s => Number(quantities[s.service_id] || 0) > 0)
      .map(s => ({
        serviceId: s.service_id,
        quantity: Number(quantities[s.service_id])
      })),
    [services, quantities]
  );

  const estimate = useMemo(
    () => services.reduce(
      (sum, s) =>
        sum + Number(s.price) * Number(quantities[s.service_id] || 0),
      0
    ),
    [services, quantities]
  );

  const filteredOrders = orders.filter(o => {
    const query = search.toLowerCase();
    return (
      String(o.order_id).includes(query) ||
      o.customer_name.toLowerCase().includes(query) ||
      o.status.toLowerCase().includes(query)
    );
  });

  async function createOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: selectedItems
        })
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Order failed");

      setNotice(
        `Order #${result.orderId} created. Total: ${money(result.totalAmount)}`
      );
      setQuantities({});
      await loadData();
      setPage("orders");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(orderId, status) {
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Update failed");

      setNotice(`Order #${orderId}: ${status}`);
      await loadData();
    } catch (e) {
      setError(e.message);
      await loadData();
    }
  }

  async function recordPayment(orderId) {
    const method = window.prompt("Payment method: Cash, UPI or Card", "Cash");
    if (method === null) return;

    const normalizedMethod =
      method.trim().toLowerCase() === "upi" ? "UPI" :
      method.trim().toLowerCase() === "card" ? "Card" :
      method.trim().toLowerCase() === "cash" ? "Cash" : "";

    if (!normalizedMethod) {
      setError("Choose Cash, UPI or Card.");
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/orders/${orderId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: normalizedMethod })
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Payment failed");

      setNotice(`Payment recorded for order #${orderId}.`);
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Shirt size={24} /></div>
          <div>
            <h2>LaundryHub</h2>
            <span>MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav>
          <button
            className={page === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("overview")}
          >
            <LayoutDashboard size={19} /> Overview
          </button>
          <button
            className={page === "new" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("new")}
          >
            <Plus size={19} /> New order
          </button>
          <button
            className={page === "orders" ? "nav-item active" : "nav-item"}
            onClick={() => setPage("orders")}
          >
            <ClipboardList size={19} /> All orders
            <span className="nav-count">{orders.length}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="online-dot" />
          <div>
            <strong>Local demo</strong>
            <p>MySQL connected via API</p>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">LAUNDRY OPERATIONS</span>
            <h1>
              {page === "overview" ? "Overview" :
               page === "new" ? "Create an order" : "Order management"}
            </h1>
          </div>
          <div className="top-actions">
            <span className="date-label">
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric"
              })}
            </span>
            <button className="icon-button" title="Refresh data" onClick={loadData}>
              <RefreshCw size={18} />
            </button>
            <div className="avatar">A</div>
            <div className="admin-label">
              <strong>Administrator</strong>
              <span>Demo mode</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="alert error-alert">
            <span>{error}</span>
            <button onClick={() => setError("")}><X size={17} /></button>
          </div>
        )}
        {notice && (
          <div className="alert success-alert">
            <span>{notice}</span>
            <button onClick={() => setNotice("")}><X size={17} /></button>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <LoaderCircle className="spin" size={25} />
            Loading application data...
          </div>
        )}

        {!loading && page === "overview" && (
          <section className="page-content">
            <div className="welcome-row">
              <div>
                <h2>Your laundry at a glance</h2>
                <p>Here's what's happening with your orders today.</p>
              </div>
              <button className="primary-button" onClick={() => setPage("new")}>
                <Plus size={18} /> New order
              </button>
            </div>

            <div className="stats-grid">
              <StatCard
                icon={<ShoppingBag />}
                label="Total orders"
                value={stats.total_orders ?? 0}
                detail="All-time orders"
                tone="blue"
              />
              <StatCard
                icon={<Clock3 />}
                label="Active orders"
                value={stats.active_orders ?? 0}
                detail="In the workflow"
                tone="orange"
              />
              <StatCard
                icon={<PackageCheck />}
                label="Ready for pickup"
                value={stats.ready_orders ?? 0}
                detail="Awaiting delivery"
                tone="purple"
              />
              <StatCard
                icon={<IndianRupee />}
                label="Collected revenue"
                value={money(stats.collected_revenue)}
                detail="Recorded payments"
                tone="green"
              />
            </div>

            <div className="content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent orders</h3>
                    <p>Latest customer laundry bookings</p>
                  </div>
                  <button className="text-button" onClick={() => setPage("orders")}>
                    View all <ArrowUpRight size={15} />
                  </button>
                </div>
                <OrderTable
                  orders={orders.slice(0, 5)}
                  onStatus={updateStatus}
                  onPayment={recordPayment}
                  compact
                />
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Popular services</h3>
                    <p>Quantities across non-cancelled orders</p>
                  </div>
                </div>
                <div className="popular-list">
                  {(stats.popular_services || []).map((s, index) => (
                    <div className="popular-item" key={s.name}>
                      <div className={`service-number n${index + 1}`}>
                        {index + 1}
                      </div>
                      <div className="popular-name">
                        <strong>{s.name}</strong>
                        <span>{s.quantity} units ordered</span>
                      </div>
                      <div className="mini-track">
                        <span style={{
                          width: `${Math.min(
                            100,
                            100 * Number(s.quantity) /
                            Math.max(1, ...stats.popular_services.map(x => Number(x.quantity)))
                          )}%`
                        }} />
                      </div>
                    </div>
                  ))}
                  {!stats.popular_services?.length && (
                    <p className="empty-text">Services will appear here.</p>
                  )}
                </div>
                <button className="secondary-button full-button"
                  onClick={() => setPage("new")}>
                  <Plus size={17} /> Create a booking
                </button>
              </section>
            </div>
          </section>
        )}

        {!loading && page === "new" && (
          <section className="page-content narrow-content">
            <div className="welcome-row">
              <div>
                <h2>New laundry booking</h2>
                <p>Enter customer details and select the required services.</p>
              </div>
            </div>

            <form className="panel booking-form" onSubmit={createOrder}>
              <h3>Customer details</h3>
              <div className="form-grid">
                <label>
                  Customer name *
                  <input required maxLength="100"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter full name" />
                </label>
                <label>
                  Phone number *
                  <input required maxLength="20"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="Enter phone number" />
                </label>
                <label>
                  Pickup date
                  <input type="date" min={today}
                    value={form.pickupDate}
                    onChange={e => setForm({ ...form, pickupDate: e.target.value })} />
                </label>
                <label>
                  Special instructions
                  <input maxLength="1000"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. Handle delicate clothes carefully" />
                </label>
              </div>

              <div className="section-rule" />
              <div className="service-heading">
                <div>
                  <h3>Select services</h3>
                  <p>Choose a quantity for at least one service.</p>
                </div>
                <span className="service-count">{services.length} services</span>
              </div>

              <div className="service-grid">
                {services.map(s => (
                  <div className="service-card" key={s.service_id}>
                    <div className="service-card-icon"><Shirt size={22} /></div>
                    <h4>{s.name}</h4>
                    <p>{s.description}</p>
                    <div className="service-price">
                      {money(s.price)} <span>/ {s.unit}</span>
                    </div>
                    <label className="quantity-label">
                      Quantity
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="1"
                        value={quantities[s.service_id] ?? 0}
                        onChange={e => setQuantities({
                          ...quantities,
                          [s.service_id]: Math.max(
                            0, Math.min(1000, Number(e.target.value) || 0)
                          )
                        })}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="order-total">
                <div>
                  <span>Estimated total</span>
                  <strong>{money(estimate)}</strong>
                </div>
                <span className="total-caption">
                  {selectedItems.length} service type(s) selected
                </span>
              </div>

              <button className="primary-button submit-button"
                disabled={busy || selectedItems.length === 0}>
                {busy ? <LoaderCircle className="spin" size={18} /> :
                  <Plus size={18} />}
                {busy ? "Creating order..." : "Place laundry order"}
              </button>
            </form>
          </section>
        )}

        {!loading && page === "orders" && (
          <section className="page-content">
            <div className="welcome-row">
              <div>
                <h2>All laundry orders</h2>
                <p>Review bookings, progress and payment status.</p>
              </div>
              <button className="primary-button" onClick={() => setPage("new")}>
                <Plus size={18} /> New order
              </button>
            </div>

            <section className="panel">
              <div className="orders-toolbar">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by order ID, customer or status..."
                  />
                </div>
                <span className="service-count">
                  {filteredOrders.length} orders
                </span>
              </div>
              <OrderTable
                orders={filteredOrders}
                onStatus={updateStatus}
                onPayment={recordPayment}
              />
            </section>
          </section>
        )}

        <footer className="footer">
          <span>LaundryHub · College project demo</span>
          <span><span className="online-dot" /> Connected through local API</span>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, detail, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </div>
  );
}

function OrderTable({ orders, onStatus, onPayment, compact = false }) {
  if (!orders.length) {
    return (
      <div className="empty-state">
        <ClipboardList size={34} />
        <h3>No orders yet</h3>
        <p>Create your first laundry booking to see it here.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ORDER</th>
            <th>CUSTOMER</th>
            {!compact && <th>SERVICES</th>}
            <th>TOTAL</th>
            <th>STATUS</th>
            <th>PAYMENT</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.order_id}>
              <td>
                <strong className="order-id">#{o.order_id}</strong>
                <span className="cell-sub">
                  {new Date(o.created_at).toLocaleDateString("en-IN")}
                </span>
              </td>
              <td>
                <strong>{o.customer_name}</strong>
                <span className="cell-sub">{o.phone}</span>
              </td>
              {!compact && (
                <td>
                  <div className="item-list">
                    {o.items.map((item, i) => (
                      <span key={i}>
                        {item.service_name} × {item.quantity}
                      </span>
                    ))}
                  </div>
                </td>
              )}
              <td><strong>{money(o.total_amount)}</strong></td>
              <td>
                <select
                  className={`status-select status-${o.status.toLowerCase()}`}
                  value={o.status}
                  disabled={o.status === "Delivered" || o.status === "Cancelled"}
                  onChange={e => onStatus(o.order_id, e.target.value)}
                  aria-label={`Status for order ${o.order_id}`}
                >
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td>
                {o.payment_status === "Paid" ? (
                  <span className="paid-label"><CheckCircle2 size={14} /> Paid</span>
                ) : (
                  <button className="pay-button"
                    onClick={() => onPayment(o.order_id)}>
                    Mark paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
