import { Header } from "./components/header";
import { Demo } from "./pages/demo";

function App() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      <Header />
      <div className="container mx-auto max-w-7xl p-4">
        <Demo />
      </div>
    </div>
  );
}

export default App;
