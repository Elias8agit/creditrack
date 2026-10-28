import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StatusBadge, ErrorBox, SuccessBox } from '../src/components/ui';
import Simulator from '../src/pages/Simulator';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('componentes de UI', () => {
  test('StatusBadge muestra la etiqueta en español y una clase por estado', () => {
    render(<StatusBadge estado="EN_REVISION" />);
    const badge = screen.getByTestId('estado');
    expect(badge).toHaveTextContent('En revisión');
    expect(badge).toHaveClass('badge-en_revision');
  });

  test('ErrorBox lista los detalles de validación del servidor', () => {
    render(<ErrorBox error={{ message: 'Datos inválidos', detalles: ['El monto debe ser numérico', 'El plazo es obligatorio'] }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Datos inválidos');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  test('ErrorBox y SuccessBox no renderizan nada sin contenido', () => {
    const { container } = render(<><ErrorBox error={null} /><SuccessBox message="" /></>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Simulador (API simulada con stub de fetch)', () => {
  // Se aísla el backend: el componente se prueba con respuestas fijas de /products y /products/simulate
  const productos = [{ id: 1, nombre: 'Microcrédito', montoMin: 1000, montoMax: 25000, plazoMin: 3, plazoMax: 24, tasaAnual: 0.24 }];

  function stubFetch(simulacion) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const esCatalogo = url.endsWith('/products');
      const falla = !esCatalogo && Boolean(simulacion.error);
      return { ok: !falla, status: falla ? 400 : 200, json: async () => (esCatalogo ? productos : simulacion) };
    });
  }

  test('muestra los límites del producto y la cuota calculada', async () => {
    const fetchMock = stubFetch({ tasaAnual: 0.24, cuota: 945.6, totalPagar: 11347.15, totalIntereses: 1347.15, tabla: [{ numero: 1, capital: 745.6, interes: 200, cuota: 945.6, saldo: 9254.4 }] });
    render(<MemoryRouter><Simulator /></MemoryRouter>);

    expect(await screen.findByText(/Entre Q1,000.00 y Q25,000.00/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', { name: /Monto/ }), '10000');
    await userEvent.type(screen.getByRole('spinbutton', { name: /Plazo/ }), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    expect(await screen.findByTestId('cuota')).toHaveTextContent('Q945.60');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ productId: 1, monto: 10000, plazoMeses: 12 });
  });

  test('muestra el error del servidor cuando el monto está fuera de rango', async () => {
    stubFetch({ error: 'Parámetros de simulación inválidos', detalles: ['El monto debe estar entre Q1000 y Q25000'] });
    render(<MemoryRouter><Simulator /></MemoryRouter>);

    await screen.findByText(/Entre Q1,000.00/);
    await userEvent.type(screen.getByRole('spinbutton', { name: /Monto/ }), '999');
    await userEvent.type(screen.getByRole('spinbutton', { name: /Plazo/ }), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El monto debe estar entre Q1000 y Q25000');
    expect(screen.queryByTestId('cuota')).not.toBeInTheDocument();
  });
});
