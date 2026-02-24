import { Link } from 'react-router-dom';
import { Button } from '@/components/common/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary p-4">
      <h1 className="text-6xl font-bold text-text-muted">404</h1>
      <p className="mt-4 text-lg text-text-secondary">Page not found</p>
      <Link to="/" className="mt-6">
        <Button variant="secondary">Go to Dashboard</Button>
      </Link>
    </div>
  );
}
