import { useEffect } from "react";

// Marks <body> with .admin-area while any admin screen is mounted, so global
// CSS that lives outside the MUI tree (SweetAlert2 popups, page scrollbars)
// can follow the flat admin design language instead of the storefront one.
// Ref-counted because AdminLogin and AdminLayout can overlap during the
// login → dashboard route swap; a plain add/remove pair could strip the
// class right after the other screen added it.
let mountedAdminScreens = 0;

const useAdminBodyClass = () => {
  useEffect(() => {
    mountedAdminScreens += 1;
    document.body.classList.add("admin-area");
    return () => {
      mountedAdminScreens -= 1;
      if (mountedAdminScreens <= 0) document.body.classList.remove("admin-area");
    };
  }, []);
};

export default useAdminBodyClass;
