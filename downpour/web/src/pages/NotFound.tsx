import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap center" style={{ padding: '80px 0' }}>
      <div className="kicker">404</div>
      <h1 className="h-page">Washed away</h1>
      <p className="lead" style={{ margin: '0 auto 24px' }}>
        Nothing lives at this address. The storm may have carried it off.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to shelter
      </Link>
    </div>
  );
}
