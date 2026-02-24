import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotFound from '../NotFound';

// Wrapper for router context
const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('NotFound Page', () => {
  it('renders 404 error code', () => {
    renderWithRouter(<NotFound />);
    
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders page not found message', () => {
    renderWithRouter(<NotFound />);
    
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('renders descriptive text', () => {
    renderWithRouter(<NotFound />);
    
    expect(screen.getByText(/doesn't exist or has been moved/)).toBeInTheDocument();
  });

  it('renders Go to Dashboard link', () => {
    renderWithRouter(<NotFound />);
    
    const dashboardLink = screen.getByRole('link', { name: /Go to Dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/');
  });

  it('renders Go Back button', () => {
    renderWithRouter(<NotFound />);
    
    expect(screen.getByRole('button', { name: /Go Back/i })).toBeInTheDocument();
  });

  it('calls window.history.back when Go Back is clicked', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    
    renderWithRouter(<NotFound />);
    
    fireEvent.click(screen.getByRole('button', { name: /Go Back/i }));
    
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('has proper styling classes for dark mode support', () => {
    renderWithRouter(<NotFound />);
    
    const container = screen.getByText('404').closest('div');
    expect(container?.parentElement?.parentElement).toHaveClass('dark:bg-gray-900');
  });
});
