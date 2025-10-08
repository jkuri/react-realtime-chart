import { Header } from "./components/header";
import { Demo } from "./pages/demo";

function App() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      <Header />
      <div className="container mx-auto p-4 max-w-7xl">
        <Demo />
      </div>
    </div>
  );
}

export default App;
