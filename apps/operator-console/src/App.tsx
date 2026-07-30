import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CaListPage } from "./pages/CaListPage";
import { CaDetailPage } from "./pages/CaDetailPage";
import { WalletListPage } from "./pages/WalletListPage";
import { WalletDetailPage } from "./pages/WalletDetailPage";
import { AddressesPage } from "./pages/AddressesPage";
import { TasksPage } from "./pages/TasksPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/ca" replace />} />
        <Route path="ca" element={<CaListPage />} />
        <Route path="ca/:mint" element={<CaDetailPage />} />
        <Route path="wallets" element={<WalletListPage />} />
        <Route path="wallets/:walletId" element={<WalletDetailPage />} />
        <Route path="addresses" element={<AddressesPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route
          path="*"
          element={
            <div className="empty">
              Unknown route — 请使用左侧导航或返回 <a href="/ca">/ca</a>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
