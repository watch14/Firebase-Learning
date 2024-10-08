import { createBrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import ScrollToTop from "./utils/ScrollToTop.jsx";
import ProtectedRoute from "./utils/ProtectedRoute.jsx";

import Auth from "./components/Auth.jsx";
import Dashboard from "./components/Dashboard.jsx";
import NotFound from "./components/NotFound.jsx";
import Profile from "./components/Profile.jsx";
import TodoList from "./components/TodoList.jsx";
import Category from "./components/Category.jsx";
import Files from "./components/Files.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <>
        <ScrollToTop />
        <App />
      </>
    ),
    children: [
      {
        path: "/auth",
        element: <ProtectedRoute element={<Auth />} isRestricted={true} />,
      },
      {
        path: "/",
        element: (
          <ProtectedRoute element={<Dashboard />} isRestricted={false} />
        ),
      },
      {
        path: "/profile",
        element: <ProtectedRoute element={<Profile />} isRestricted={false} />,
      },
      {
        path: "/todo",
        element: <ProtectedRoute element={<TodoList />} isRestricted={false} />,
      },
      {
        path: "/category",
        element: <ProtectedRoute element={<Category />} isRestricted={false} />,
      },
      {
        path: "/files",
        element: <ProtectedRoute element={<Files />} isRestricted={false} />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

export default router;
