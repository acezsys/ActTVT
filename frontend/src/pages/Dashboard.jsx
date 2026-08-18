import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="page">
      <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
      <p className="hint-text">
        Master Data and user access are live. As the Tender/Bid, Sales, Purchase, Production, Stores,
        and Dispatch/Accounts modules are built, their summaries will appear here.
      </p>
    </div>
  );
}
