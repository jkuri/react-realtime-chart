import { Header } from "./components/header";
import { Demo } from "./pages/demo";

function App() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      <Header />
      <div className="container mx-auto p-4 max-w-5xl">
        <div className="w-full h-64 sm:h-96 p-4 border rounded-md my-4 sm:my-6">
          <Demo />
        </div>
      </div>
    </div>
  );
}

export default App;
