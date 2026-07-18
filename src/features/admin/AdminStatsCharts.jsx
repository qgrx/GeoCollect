/**
 * Graphiques de l'onglet Stats admin (Recharts, thème sombre).
 * Remplace les anciens SVG maison : tooltips, axes et échelles gérés par la lib.
 */
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const TICK = { fill: '#8daacc', fontSize: 10, fontFamily: "'Nunito',sans-serif" };
const TOOLTIP_STYLE = {
  contentStyle: { background: '#0c1620', border: '1px solid #ffffff22', borderRadius: 8, fontSize: 12, fontFamily: "'Nunito',sans-serif" },
  labelStyle: { color: '#8daacc', fontWeight: 700, marginBottom: 4 },
  itemStyle: { padding: 0 },
};
const GRID = { stroke: '#ffffff10', vertical: false };

const Empty = ({ text }) => (
  <div style={{ color: '#8daacc', padding: '22px 0', textAlign: 'center', fontSize: 12 }}>{text}</div>
);

const fmtDayFr = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

// ── Joueurs en ligne (échantillonné toutes les 30 s) ─────────────────────────
export function OnlineChart({ history = [], hours = 24 }) {
  if (!history.length) return <Empty text="Aucune donnée pour l'instant — l'historique se remplit toutes les 30 s." />;
  const t1 = Date.now(), t0 = t1 - hours * 3600e3;
  const data = history
    .map(p => ({ t: new Date(p.at).getTime(), count: p.count }))
    .filter(p => p.t >= t0);
  const fmtTick = t => hours <= 24
    ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id="onlineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3fb950" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3fb950" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        {/* Domaine = fenêtre demandée (−Nh → maintenant), pas l'étendue des données,
            sinon la courbe s'étire et les heures affichées mentent. */}
        <XAxis dataKey="t" type="number" domain={[t0, t1]} scale="time"
          tickFormatter={fmtTick} tick={TICK} tickLine={false} axisLine={{ stroke: '#ffffff25' }} minTickGap={40} />
        <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP_STYLE}
          labelFormatter={t => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          formatter={v => [`${v} joueur${v > 1 ? 's' : ''}`, 'En ligne']} />
        <Area type="monotone" dataKey="count" stroke="#3fb950" strokeWidth={2}
          fill="url(#onlineFill)" dot={false} activeDot={{ r: 3.5 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Inscriptions par jour ────────────────────────────────────────────────────
export function SignupsChart({ buckets = [] }) {
  if (!buckets.length) return <Empty text="Aucune donnée sur la période." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={buckets} margin={{ top: 8, right: 12, bottom: 0, left: -26 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="date" tickFormatter={fmtDayFr} tick={TICK} tickLine={false}
          axisLine={{ stroke: '#ffffff25' }} minTickGap={24} />
        <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#ffffff0a' }}
          labelFormatter={d => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          formatter={v => [`${v} inscription${v > 1 ? 's' : ''}`, null]} />
        <Bar dataKey="count" fill="#a29bfe" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Geocoins (uniques) par joueur, normaux + shiny empilés ───────────────────
export function GeocoinsChart({ players = [] }) {
  if (!players.length) return <Empty text="Aucune donnée." />;
  // Une colonne par joueur : largeur fixe par barre + conteneur défilant,
  // sinon 200 joueurs sont illisibles en largeur responsive.
  const width = Math.max(640, players.length * 26);
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <BarChart data={players} width={width} height={320} margin={{ top: 8, right: 12, bottom: 0, left: -22 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="pseudo" interval={0} angle={-55} textAnchor="end" height={86}
          tick={{ ...TICK, fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#ffffff25' }} />
        <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#ffffff0a' }} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'Nunito',sans-serif" }} />
        <Bar dataKey="normal" name="Normaux" stackId="gc" fill="#74b9ff" isAnimationActive={false} />
        <Bar dataKey="shiny" name="Shiny" stackId="gc" fill="#f9ca24" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}
