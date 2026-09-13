import { Outlet } from "react-router-dom";
import NavBar from "../components/NavBar";

const MainLayout = () => {
  return (
    <>
      <NavBar />
      {/* px-4 was missing, so on phones the content sat flush against both
          edges of the screen. */}
      <main className="px-4 md:px-8 lg:px-16 xl:px-32 2xl:px-64 pb-16">
        <Outlet />
      </main>
    </>
  );
};

export default MainLayout;
