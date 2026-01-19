import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <Link to="/" className="text-gray-700 hover:text-blue-600 font-medium">Dashboard</Link>
                        <Link to="/create" className="text-gray-700 hover:text-blue-600 font-medium">New Remittance</Link>
                        <Link to="/receive" className="text-gray-700 hover:text-blue-600 font-medium">Receive</Link>
                    </div>
                    <div className="flex items-center gap-4">
                        {user && (
                            <>
                                <span className="text-sm text-gray-700">{user.email}</span>
                                <button
                                    onClick={logout}
                                    className="text-sm text-gray-500 hover:text-gray-900"
                                >
                                    Logout
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
