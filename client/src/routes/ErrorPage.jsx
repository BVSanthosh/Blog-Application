import { Link, useRouteError } from "react-router-dom";

/**
 * Router-level errorElement. Without one, any render error anywhere in the
 * tree replaced the whole app with react-router's default stack-trace screen.
 */
const ErrorPage = () => {
  const error = useRouteError();
  console.error(error);

  return (
    <div className="p-8 flex flex-col items-start gap-4">
      <h1 className="text-3xl font-bold text-primary-text-color">Something went wrong</h1>
      <p className="text-secondary-text-color">
        The page failed to load. Refreshing usually helps.
      </p>
      {import.meta.env.DEV && (
        <pre className="text-xs bg-white p-4 rounded-xl overflow-x-auto max-w-full">
          {error?.stack ?? String(error)}
        </pre>
      )}
      <Link to="/" className="text-blue-800 underline">
        Back to home
      </Link>
    </div>
  );
};

export default ErrorPage;
