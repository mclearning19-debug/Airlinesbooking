import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAirports, getConfig } from '../services/api';
import useAsync from '../hooks/useAsync';
import AsyncView from '../components/AsyncView';
import { toDateInput } from '../utils';

export default function Home() {
  const state = useAsync(() => Promise.all([getAirports(), getConfig()]));
  return (
    <>
      <section className="hero">
        <h1>Where to next?</h1>
        <p>Search flights, pick your seats and book in minutes.</p>
      </section>
      <AsyncView state={state}>{([airports, config]) => <SearchForm airports={airports} config={config} />}</AsyncView>
    </>
  );
}

function SearchForm({ airports, config }) {
  const navigate = useNavigate();
  const today = toDateInput(new Date());
  const last = toDateInput(new Date(Date.now() + config.searchDays * 86_400_000));
  const [form, setForm] = useState({ from: 'JFK', to: 'LAX', date: today, passengers: 1 });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const error = form.from === form.to ? 'Choose different departure and arrival airports.' : !form.date ? 'Pick a date.' : '';

  const submit = (e) => {
    e.preventDefault();
    if (error) return;
    navigate(`/flights?${new URLSearchParams(form)}`);
  };

  const options = airports.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>);
  return (
    <form className="card search-card" onSubmit={submit}>
      <label className="field">From<select className="input" value={form.from} onChange={set('from')}>{options}</select></label>
      <label className="field">To<select className="input" value={form.to} onChange={set('to')}>{options}</select></label>
      <label className="field">Date<input className="input" type="date" min={today} max={last} value={form.date} onChange={set('date')} /></label>
      <label className="field">Passengers
        <select className="input" value={form.passengers} onChange={set('passengers')}>
          {Array.from({ length: config.maxPassengers }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <button className="btn btn-primary" disabled={!!error}>Search flights</button>
      {error && <p className="error search-error">{error}</p>}
    </form>
  );
}
