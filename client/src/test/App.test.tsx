// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '../pages/admin-page';

describe('AdminPage', () => {
  it('renders admin editor title', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <MemoryRouter>
            <AdminPage />
          </MemoryRouter>
        </NuqsAdapter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('관리자 에디터')).toBeInTheDocument();
  });
});
