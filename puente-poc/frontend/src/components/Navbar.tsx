import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <Link to="/" className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-bold text-blue-600">Puente</span>
                        </Link>
                    </div>
                    <div className="flex items-center">
                        {user && (
                            <>
                                <span className="text-sm text-gray-700 mr-4">{user.email}</span>
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
