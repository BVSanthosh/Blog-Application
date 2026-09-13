import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

import MainLayout from "./layouts/MainLayout.jsx";
import HomePage from "./routes/HomePage.jsx";
import PostListPage from "./routes/PostListPage.jsx";
import SinglePostPage from "./routes/SinglePostPage.jsx";
import LoginPage from "./routes/LoginPage.jsx";
import RegisterPage from "./routes/RegisterPage.jsx";
import NotFoundPage from "./routes/NotFoundPage.jsx";
import ErrorPage from "./routes/ErrorPage.jsx";

// The rich-text editor is roughly half the bundle and is only reachable at
// /write, so it loads on demand rather than for every reader.
const WritePage = lazy(() => import("./routes/WritePage.jsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Blog content changes rarely; this stops a refetch every time the
      // window regains focus.
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      // Retrying a 404 or a 401 only delays showing the real message.
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/posts", element: <PostListPage /> },
      {
        path: "/write",
        element: (
          <Suspense fallback={<div className="mt-8">Loading editor...</div>}>
            <WritePage />
          </Suspense>
        ),
      },
      { path: "/login/*", element: <LoginPage /> },
      { path: "/register/*", element: <RegisterPage /> },
      // Keep last: "/:slug" would otherwise swallow /posts, /write and /login.
      { path: "/:slug", element: <SinglePostPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

const root = createRoot(document.getElementById("root"));

if (!PUBLISHABLE_KEY) {
  // Throwing here left the user with a blank white page and a console error.
  root.render(
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Configuration error</h1>
      <p>
        <code>VITE_CLERK_PUBLISHABLE_KEY</code> is not set. Copy{" "}
        <code>client/.env.example</code> to <code>client/.env</code> and add your Clerk
        publishable key.
      </p>
    </div>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <ToastContainer position="bottom-right" />
        </QueryClientProvider>
      </ClerkProvider>
    </StrictMode>,
  );
}
