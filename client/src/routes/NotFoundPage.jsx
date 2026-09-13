import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div className="mt-16 flex flex-col items-start gap-4">
      <h1 className="text-4xl font-bold text-primary-text-color">404</h1>
      <p className="text-secondary-text-color">
        We could not find that page.
      </p>
      <Link to="/" className="text-blue-800 underline">
        Back to home
      </Link>
    </div>
  );
};

export default NotFoundPage;
