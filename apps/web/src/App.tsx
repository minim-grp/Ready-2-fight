import { Routes, Route } from "react-router-dom";

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Ready 2 Fight</h1>
        <p className="mt-2 text-slate-400">Combat Readiness Score Platform</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
