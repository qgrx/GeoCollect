export const INP = {
  background: '#ffffff12',
  border: '1px solid #ffffff22',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: 8,
  fontFamily: "'Nunito', sans-serif",
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

export const SEL = { ...INP, appearance: 'auto' };

export const BTN = (bg, c = '#fff') => ({
  background: bg,
  border: 'none',
  color: c,
  padding: '9px 18px',
  borderRadius: 50,
  fontFamily: "'Nunito', sans-serif",
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer',
});
