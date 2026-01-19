import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
    const { user, logout } = useAuth();

    const getLinkClass = ({ isActive }: { isActive: boolean }) =>
        isActive
            ? "inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded-md text-blue-700 bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            : "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors";

    return (
        <nav className="bg-white border-b border-gray-200" aria-label="Global">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 flex items-center mr-8">
                            <span className="font-extrabold text-2xl text-blue-700 tracking-tight">Puente</span>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                            <NavLink to="/" className={getLinkClass}>Dashboard</NavLink>
                            <NavLink to="/create" className={getLinkClass}>New Remittance</NavLink>
                            <NavLink to="/receive" className={getLinkClass}>Receive</NavLink>
                            <NavLink to="/admin" className={getLinkClass}>Admin</NavLink>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {user && (
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                                    {user.email}
                                </span>
                                <button
                                    onClick={logout}
                                    className="text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    aria-label="Sign out"
                                >
                                    Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
