import { Analytics } from "@vercel/analytics/react";
import { Header } from "./components/header";
import { Demo } from "./pages/demo";

function App() {
  return (
    <div className="flex min-h-svh w-full flex-col">
      <Header />
      <div className="container mx-auto p-4 max-w-5xl">
        <div className="w-full h-96 p-4 border rounded-md my-12">
          <Demo />
        </div>
      </div>
      <Analytics />
    </div>
  );
}

export default App;
