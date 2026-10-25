import { formatPrice } from '../utils';

const COLUMNS = ['A', 'B', 'C', null, 'D', 'E', 'F']; // null = aisle

// seats: [{ seat, row, letter, cabin, price, taken }] from the server. mine: Map(seat -> passenger index).
export default function SeatMap({ seats, mine, onToggle }) {
  const bySeat = new Map(seats.map((s) => [s.seat, s]));
  const rows = [...new Set(seats.map((s) => s.row))];
  let lastCabin = null;
  return (
    <div className="seatmap" role="group" aria-label="Seat map">
      <div className="seat-row seat-head">
        {COLUMNS.map((c, i) => <span key={i} className="seat-cell muted small">{c}</span>)}
      </div>
      {rows.map((row) => {
        const cabin = bySeat.get(`${row}${seats.find((s) => s.row === row).letter}`).cabin;
        const banner = cabin !== lastCabin && (
          <div className="cabin-banner">{cabin} · {formatPrice(seats.find((s) => s.cabin === cabin).price)} per seat</div>
        );
        lastCabin = cabin;
        return (
          <div key={row}>
            {banner}
            <div className="seat-row">
              {COLUMNS.map((letter, i) => {
                if (!letter) return <span key={i} className="seat-cell aisle muted small">{row}</span>;
                const s = bySeat.get(`${row}${letter}`);
                if (!s) return <span key={i} className="seat-cell" />;
                const owner = mine.get(s.seat);
                const cls = s.taken ? 'taken' : owner !== undefined ? 'mine' : s.cabin === 'Business' ? 'business' : '';
                return (
                  <button
                    key={i}
                    type="button"
                    className={`seat-cell seat ${cls}`}
                    disabled={s.taken}
                    aria-label={`Seat ${s.seat}, ${s.cabin}, ${formatPrice(s.price)}${s.taken ? ', taken' : ''}`}
                    aria-pressed={owner !== undefined}
                    onClick={() => onToggle(s.seat)}
                  >
                    {owner !== undefined ? owner + 1 : ''}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="seat-legend muted small">
        <span><i className="seat-swatch" /> Available</span>
        <span><i className="seat-swatch business" /> Business</span>
        <span><i className="seat-swatch mine" /> Your pick</span>
        <span><i className="seat-swatch taken" /> Taken</span>
      </div>
    </div>
  );
}
